import { describe, it, expect, vi, beforeEach } from "vitest";
import { authenticateAgent, apiSuccess, apiError, parseId, withRateHeaders, isReviewerAgent } from "@/lib/agent-auth";
import db from "@/db/index";
import { TEST_API_KEY, TEST_AGENT } from "../helpers";

describe("agent-auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authenticateAgent", () => {
    it("rejects missing Authorization header", async () => {
      const req = new Request("http://localhost/api/v1/tasks", {
        method: "GET",
      });
      const result = await authenticateAgent(req);
      expect(result).toBeInstanceOf(Response);
      const body = await (result as Response).json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("rejects invalid Bearer format", async () => {
      const req = new Request("http://localhost/api/v1/tasks", {
        headers: { Authorization: "Basic abc123" },
      });
      const result = await authenticateAgent(req);
      expect(result).toBeInstanceOf(Response);
      const body = await (result as Response).json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("rejects invalid API key format", async () => {
      const req = new Request("http://localhost/api/v1/tasks", {
        headers: { Authorization: "Bearer invalid_key_123" },
      });
      const result = await authenticateAgent(req);
      expect(result).toBeInstanceOf(Response);
      const body = await (result as Response).json();
      expect(body.error.code).toBe("UNAUTHORIZED");
      expect(body.error.message).toContain("Invalid API key format");
    });

    it("rejects unknown API key", async () => {
      // Mock DB to return empty array (no agent found)
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });
      (db as unknown as { select: typeof mockSelect }).select = mockSelect;

      const req = new Request("http://localhost/api/v1/tasks", {
        headers: { Authorization: `Bearer ${TEST_API_KEY}` },
      });
      const result = await authenticateAgent(req);
      expect(result).toBeInstanceOf(Response);
      const body = await (result as Response).json();
      expect(body.error.code).toBe("UNAUTHORIZED");
      expect(body.error.message).toContain("Invalid API key");
    });

    it("rejects pending_claim agent", async () => {
      const pendingAgent = { ...TEST_AGENT, status: "pending_claim" };
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([pendingAgent]),
        }),
      });
      (db as unknown as { select: typeof mockSelect }).select = mockSelect;

      const req = new Request("http://localhost/api/v1/tasks", {
        headers: { Authorization: `Bearer ${TEST_API_KEY}` },
      });
      const result = await authenticateAgent(req);
      expect(result).toBeInstanceOf(Response);
      const body = await (result as Response).json();
      expect(body.error.code).toBe("PENDING_CLAIM");
    });

    it("rejects suspended agent", async () => {
      const suspendedAgent = { ...TEST_AGENT, status: "suspended" };
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([suspendedAgent]),
        }),
      });
      (db as unknown as { select: typeof mockSelect }).select = mockSelect;

      const req = new Request("http://localhost/api/v1/tasks", {
        headers: { Authorization: `Bearer ${TEST_API_KEY}` },
      });
      const result = await authenticateAgent(req);
      expect(result).toBeInstanceOf(Response);
      const body = await (result as Response).json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("authenticates valid active agent", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([TEST_AGENT]),
        }),
      });
      (db as unknown as { select: typeof mockSelect }).select = mockSelect;

      const req = new Request("http://localhost/api/v1/tasks", {
        headers: { Authorization: `Bearer ${TEST_API_KEY}` },
      });
      const result = await authenticateAgent(req);
      expect(result).not.toBeInstanceOf(Response);
      const auth = result as unknown as { agent: typeof TEST_AGENT; rateHeaders: unknown; idempotencyKey: null };
      expect(auth.agent.id).toBe(TEST_AGENT.id);
      expect(auth.rateHeaders).toBeDefined();
      expect(auth.idempotencyKey).toBeNull();
    });

    it("extracts idempotency key from headers", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([TEST_AGENT]),
        }),
      });
      (db as unknown as { select: typeof mockSelect }).select = mockSelect;

      const req = new Request("http://localhost/api/v1/tasks", {
        headers: {
          Authorization: `Bearer ${TEST_API_KEY}`,
          "Idempotency-Key": "my-unique-key-123",
        },
      });
      const result = await authenticateAgent(req);
      expect(result).not.toBeInstanceOf(Response);
      expect((result as { idempotencyKey: string }).idempotencyKey).toBe("my-unique-key-123");
    });
  });

  describe("apiSuccess", () => {
    it("returns correct envelope", async () => {
      const res = apiSuccess({ id: 1 }, { extra: "info" });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data).toEqual({ id: 1 });
      expect(body.meta.extra).toBe("info");
      expect(body.meta.timestamp).toBeDefined();
      expect(body.meta.request_id).toMatch(/^req_/);
    });

    it("supports custom status code", async () => {
      const res = apiSuccess({ id: 1 }, {}, 201);
      expect(res.status).toBe(201);
    });
  });

  describe("apiError", () => {
    it("returns correct error envelope", async () => {
      const res = apiError(404, "NOT_FOUND", "Item not found", "Try a different ID");
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
      expect(body.error.message).toBe("Item not found");
      expect(body.error.suggestion).toBe("Try a different ID");
    });

    it("includes rate limit headers when provided", async () => {
      const res = apiError(429, "RATE_LIMITED", "Too many requests", "Wait", { limit: 100, remaining: 0, reset: 12345 });
      expect(res.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    });
  });

  describe("parseId", () => {
    it("parses valid positive integer", () => {
      expect(parseId("42")).toBe(42);
      expect(parseId("1")).toBe(1);
    });

    it("returns NaN for invalid input", () => {
      expect(parseId("abc")).toBeNaN();
      expect(parseId("0")).toBeNaN();
      expect(parseId("-1")).toBeNaN();
      expect(parseId("")).toBeNaN();
    });
  });

  describe("withRateHeaders", () => {
    it("adds rate limit headers to response", () => {
      const res = new Response("ok");
      const result = withRateHeaders(res, { limit: 100, remaining: 50, reset: 99999 });
      expect(result.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(result.headers.get("X-RateLimit-Remaining")).toBe("50");
      expect(result.headers.get("X-RateLimit-Reset")).toBe("99999");
    });
  });

  describe("isReviewerAgent", () => {
    it("returns true for reviewer agent", () => {
      expect(isReviewerAgent(999)).toBe(true);
    });

    it("returns false for other agents", () => {
      expect(isReviewerAgent(1)).toBe(false);
      expect(isReviewerAgent(0)).toBe(false);
    });
  });
});
