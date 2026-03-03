import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/v1/tasks/[id]/rollback/route";
import db from "@/db/index";
import { TEST_API_KEY, TEST_AGENT, TEST_TASK, parseResponse } from "../../helpers";

// Mock authenticateAgent to return our test agent
vi.mock("@/lib/agent-auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/agent-auth")>();
  return {
    ...original,
    authenticateAgent: vi.fn(),
  };
});

import { authenticateAgent } from "@/lib/agent-auth";
const mockAuth = vi.mocked(authenticateAgent);

/**
 * Creates a thenable mock chain that resolves like:
 * db.select().from(X).where(Y).then(fn) => fn(resolvedRows)
 *
 * The route code does: .then((r) => r[0]) — so resolvedRows should be an array.
 */
function mockSelectChain(...callResults: unknown[][]) {
  let callIndex = 0;
  const mockSelect = vi.fn().mockImplementation(() => {
    const currentResult = callResults[callIndex] ?? [];
    callIndex++;
    const chain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          // Return a thenable that resolves to currentResult
          const thenable = {
            then: (fn: (v: unknown[]) => unknown) => Promise.resolve(fn(currentResult)),
          };
          return thenable;
        }),
      }),
    };
    return chain;
  });
  return mockSelect;
}

describe("POST /api/v1/tasks/:id/rollback", () => {
  const rateHeaders = { limit: 100, remaining: 99, reset: 999999 };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ agent: TEST_AGENT as never, rateHeaders, idempotencyKey: null });
  });

  function createRequest() {
    return new Request("http://localhost/api/v1/tasks/42/rollback", {
      method: "POST",
      headers: { Authorization: `Bearer ${TEST_API_KEY}` },
    });
  }

  it("rejects invalid task ID", async () => {
    const req = new Request("http://localhost/api/v1/tasks/abc/rollback", {
      method: "POST",
      headers: { Authorization: `Bearer ${TEST_API_KEY}` },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "abc" }) });
    const body = await parseResponse(res);
    expect(res.status).toBe(400);
    expect(body.error?.code).toBe("INVALID_PARAMETER");
  });

  it("returns 404 for non-existent task", async () => {
    (db as unknown as Record<string, unknown>).select = mockSelectChain([]);

    const res = await POST(createRequest(), { params: Promise.resolve({ id: "42" }) });
    const body = await parseResponse(res);
    expect(res.status).toBe(404);
    expect(body.error?.code).toBe("TASK_NOT_FOUND");
  });

  it("rejects non-poster agent", async () => {
    const task = { ...TEST_TASK, posterId: 999 };
    (db as unknown as Record<string, unknown>).select = mockSelectChain([task], [TEST_AGENT]);

    const res = await POST(createRequest(), { params: Promise.resolve({ id: "42" }) });
    const body = await parseResponse(res);
    expect(res.status).toBe(403);
    expect(body.error?.code).toBe("FORBIDDEN");
  });

  it("rejects rollback from completed status", async () => {
    const task = { ...TEST_TASK, status: "completed", posterId: TEST_AGENT.operatorId };
    (db as unknown as Record<string, unknown>).select = mockSelectChain([task], [TEST_AGENT]);

    const res = await POST(createRequest(), { params: Promise.resolve({ id: "42" }) });
    const body = await parseResponse(res);
    expect(res.status).toBe(409);
    expect(body.error?.code).toBe("INVALID_STATUS");
  });

  it("rejects rollback from open status", async () => {
    const task = { ...TEST_TASK, status: "open", posterId: TEST_AGENT.operatorId };
    (db as unknown as Record<string, unknown>).select = mockSelectChain([task], [TEST_AGENT]);

    const res = await POST(createRequest(), { params: Promise.resolve({ id: "42" }) });
    const body = await parseResponse(res);
    expect(res.status).toBe(409);
    expect(body.error?.code).toBe("INVALID_STATUS");
  });

  it("successfully rolls back a claimed task", async () => {
    const task = {
      ...TEST_TASK,
      status: "claimed",
      posterId: TEST_AGENT.operatorId,
      claimedByAgentId: 5,
      title: "Build a REST API",
    };

    (db as unknown as Record<string, unknown>).select = mockSelectChain([task], [TEST_AGENT]);

    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    (db as unknown as Record<string, unknown>).update = mockUpdate;

    const res = await POST(createRequest(), { params: Promise.resolve({ id: "42" }) });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data).toMatchObject({ task_id: 42, status: "open" });
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });

  it("successfully rolls back an in_progress task", async () => {
    const task = {
      ...TEST_TASK,
      status: "in_progress",
      posterId: TEST_AGENT.operatorId,
      claimedByAgentId: 5,
      title: "Build a REST API",
    };

    (db as unknown as Record<string, unknown>).select = mockSelectChain([task], [TEST_AGENT]);

    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    (db as unknown as Record<string, unknown>).update = mockUpdate;

    const res = await POST(createRequest(), { params: Promise.resolve({ id: "42" }) });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data).toMatchObject({
      task_id: 42,
      status: "open",
      message: "Task rolled back to open. The previously assigned agent has been released.",
    });
  });
});
