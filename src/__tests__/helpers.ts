// Shared test utilities

import { createHash } from "crypto";

/**
 * Build a mock Request object for testing route handlers.
 */
export function mockRequest(
  method: string,
  url: string,
  body?: object,
  headers?: Record<string, string>
): Request {
  return new Request(url, {
    method,
    headers: {
      Authorization: `Bearer ${TEST_API_KEY}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Parse a Response body as JSON.
 */
export async function parseResponse(response: Response) {
  return response.json() as Promise<{
    ok: boolean;
    data?: unknown;
    error?: { code: string; message: string; suggestion: string };
    meta?: Record<string, unknown>;
  }>;
}

// ─── Test constants ────────────────────────────────────────────────

export const TEST_API_KEY = "th_agent_" + "a".repeat(64);
export const TEST_API_KEY_HASH = createHash("sha256").update(TEST_API_KEY).digest("hex");

export const TEST_AGENT = {
  id: 1,
  name: "test-agent",
  description: "A test agent",
  operatorId: 10,
  apiKeyHash: TEST_API_KEY_HASH,
  apiKeyPrefix: "th_agent_aaaaaa",
  status: "active" as const,
  reputationScore: 50,
  tasksCompleted: 5,
  capabilities: [],
  categoryIds: [],
  hourlyRateCredits: null,
  webhookUrl: null,
  verificationCode: "hive-TEST",
  freelancerLlmKeyEncrypted: null,
  freelancerLlmProvider: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

export const TEST_TASK = {
  id: 42,
  posterId: 20, // Different from agent's operator (10)
  title: "Build a REST API",
  description: "Create a REST API with full CRUD operations and auth.",
  budgetCredits: 200,
  categoryId: 1,
  status: "open" as const,
  claimedByAgentId: null,
  deadline: new Date("2026-04-01"),
  maxRevisions: 2,
  requirements: null,
  autoReviewEnabled: false,
  posterLlmKeyEncrypted: null,
  posterLlmProvider: null,
  posterMaxReviews: null,
  posterReviewsUsed: 0,
  createdAt: new Date("2026-03-01"),
  updatedAt: new Date("2026-03-01"),
};

export const TEST_CLAIM = {
  id: 15,
  taskId: 42,
  agentId: 1,
  proposedCredits: 180,
  message: "I can do this.",
  status: "pending" as const,
  createdAt: new Date("2026-03-01"),
};

export const TEST_DELIVERABLE = {
  id: 8,
  taskId: 42,
  agentId: 1,
  content: "Here is my deliverable content.",
  status: "submitted" as const,
  revisionNotes: null,
  revisionNumber: 0,
  createdAt: new Date("2026-03-01"),
  updatedAt: new Date("2026-03-01"),
};

/**
 * Create a mock DB chain that resolves to a value at the end.
 * Usage: mockDbChain(db, value) — the next chained query returns `value`.
 */
export function mockDbChain(dbMock: Record<string, ReturnType<typeof import("vitest").vi.fn>>, resolveValue: unknown) {
  const chain = {
    from: () => chain,
    where: () => chain,
    set: () => chain,
    values: () => chain,
    returning: () => Promise.resolve(resolveValue),
    leftJoin: () => chain,
    innerJoin: () => chain,
    orderBy: () => chain,
    limit: () => Promise.resolve(resolveValue),
    then: (resolve: (v: unknown) => void) => Promise.resolve(resolveValue).then(resolve),
  };

  // Reset and set up chaining
  for (const key of Object.keys(chain)) {
    if (typeof dbMock[key] === "function") {
      dbMock[key].mockImplementation(
        () => chain
      );
    }
  }

  dbMock.select.mockReturnValue(chain);
  dbMock.insert.mockReturnValue(chain);
  dbMock.update.mockReturnValue(chain);
  dbMock.delete.mockReturnValue(chain);

  return chain;
}
