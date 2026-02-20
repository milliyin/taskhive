import { createHash, randomBytes, randomUUID } from "crypto";
import db from "@/db/index";
import { agents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { InferSelectModel } from "drizzle-orm";

// ─── Types ──────────────────────────────────────────────────────────
export interface RateHeaders {
  limit: number;
  remaining: number;
  reset: number;
}

export interface AuthResult {
  agent: InferSelectModel<typeof agents>;
  rateHeaders: RateHeaders;
  idempotencyKey: string | null;
}

// ─── Rate Limiter (in-memory sliding window) ─────────────────────────
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT = 100;
const RATE_WINDOW_MS = 60 * 1000;

function checkRateLimit(agentId: number) {
  const now = Date.now();
  const key = `agent_${agentId}`;

  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, []);
  }

  const timestamps = rateLimitMap.get(key)!.filter((t) => t > now - RATE_WINDOW_MS);
  rateLimitMap.set(key, timestamps);

  const remaining = RATE_LIMIT - timestamps.length;
  const reset = Math.ceil((now + RATE_WINDOW_MS) / 1000);

  if (remaining <= 0) {
    return { allowed: false, remaining: 0, reset, limit: RATE_LIMIT };
  }

  timestamps.push(now);
  return { allowed: true, remaining: remaining - 1, reset, limit: RATE_LIMIT };
}

// ─── Idempotency Cache (in-memory, 24h TTL) ─────────────────────────
interface CachedResponse {
  status: number;
  body: string;
  headers: Record<string, string>;
  createdAt: number;
}

const idempotencyCache = new Map<string, CachedResponse>();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

// Cleanup expired keys every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of idempotencyCache) {
    if (now - entry.createdAt > IDEMPOTENCY_TTL_MS) {
      idempotencyCache.delete(key);
    }
  }
}, 10 * 60 * 1000);

/**
 * Check if an idempotency key exists and return cached response.
 * Returns null if no cached response (first request with this key).
 */
export function getIdempotentResponse(agentId: number, idempotencyKey: string): Response | null {
  const cacheKey = `${agentId}:${idempotencyKey}`;
  const cached = idempotencyCache.get(cacheKey);

  if (!cached) return null;

  if (Date.now() - cached.createdAt > IDEMPOTENCY_TTL_MS) {
    idempotencyCache.delete(cacheKey);
    return null;
  }

  return new Response(cached.body, {
    status: cached.status,
    headers: { ...cached.headers, "Idempotency-Replayed": "true" },
  });
}

/**
 * Store a response for an idempotency key.
 */
export function storeIdempotentResponse(
  agentId: number,
  idempotencyKey: string,
  response: Response,
  bodyText: string
): void {
  const cacheKey = `${agentId}:${idempotencyKey}`;
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  idempotencyCache.set(cacheKey, {
    status: response.status,
    body: bodyText,
    headers,
    createdAt: Date.now(),
  });
}

// ─── Response helpers ────────────────────────────────────────────────

export function apiSuccess(data: unknown, meta: Record<string, unknown> = {}, status = 200) {
  const body = {
    ok: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      request_id: `req_${randomUUID().split("-")[0]}`,
      ...meta,
    },
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function apiError(status: number, code: string, message: string, suggestion: string, rateHeaders: RateHeaders | null = null) {
  const body = {
    ok: false,
    error: { code, message, suggestion },
    meta: {
      timestamp: new Date().toISOString(),
      request_id: `req_${randomUUID().split("-")[0]}`,
    },
  };
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (rateHeaders) {
    headers["X-RateLimit-Limit"] = String(rateHeaders.limit);
    headers["X-RateLimit-Remaining"] = String(rateHeaders.remaining);
    headers["X-RateLimit-Reset"] = String(rateHeaders.reset);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

// ─── Auth middleware ─────────────────────────────────────────────────

/**
 * Authenticate an agent via Bearer token.
 * Returns { agent, rateHeaders, idempotencyKey } or a Response (error).
 */
export async function authenticateAgent(request: Request): Promise<AuthResult | Response> {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return apiError(401, "UNAUTHORIZED",
      "Missing or invalid Authorization header",
      "Include header: Authorization: Bearer th_agent_<your-key>"
    );
  }

  const token = authHeader.slice(7);

  if (!token.startsWith("th_agent_") || token.length !== 73) {
    return apiError(401, "UNAUTHORIZED",
      "Invalid API key format",
      "API key must start with 'th_agent_' followed by 64 hex characters"
    );
  }

  // Hash and lookup
  const hash = createHash("sha256").update(token).digest("hex");

  const result = await db
    .select()
    .from(agents)
    .where(eq(agents.apiKeyHash, hash));

  if (result.length === 0) {
    return apiError(401, "UNAUTHORIZED",
      "Invalid API key",
      "Check your API key or generate a new one at /dashboard/my/agents"
    );
  }

  const agent = result[0];

  if (agent.status !== "active") {
    return apiError(403, "FORBIDDEN",
      `Agent is ${agent.status}`,
      "Contact your account administrator"
    );
  }

  // Rate limit
  const rateResult = checkRateLimit(agent.id);
  if (!rateResult.allowed) {
    const waitSeconds = Math.ceil((rateResult.reset * 1000 - Date.now()) / 1000);
    return apiError(429, "RATE_LIMITED",
      `Rate limit exceeded (${RATE_LIMIT} requests/minute)`,
      `Wait ${waitSeconds} seconds before retrying. Check X-RateLimit-Reset header.`,
      rateResult
    );
  }

  // Extract idempotency key (for POST requests)
  const idempotencyKey = request.headers.get("idempotency-key");

  return {
    agent,
    rateHeaders: {
      limit: rateResult.limit,
      remaining: rateResult.remaining,
      reset: rateResult.reset,
    },
    idempotencyKey,
  };
}

/**
 * Add rate limit headers to a success response.
 */
export function withRateHeaders(response: Response, rateHeaders: RateHeaders) {
  response.headers.set("X-RateLimit-Limit", String(rateHeaders.limit));
  response.headers.set("X-RateLimit-Remaining", String(rateHeaders.remaining));
  response.headers.set("X-RateLimit-Reset", String(rateHeaders.reset));
  return response;
}

// ─── Parameter parsing helpers ───────────────────────────────────────

/**
 * Parse a string to a positive integer. Returns NaN if invalid.
 */
export function parseId(value: string): number {
  const n = parseInt(value, 10);
  return isNaN(n) || n < 1 ? NaN : n;
}

/**
 * Parse an optional numeric query param. Returns null if absent, NaN if invalid.
 */
export function parseIntParam(value: string | null): number | null {
  if (value === null) return null;
  const n = parseInt(value, 10);
  return isNaN(n) ? NaN : n;
}

// ─── Key generation utility ──────────────────────────────────────────

export function generateApiKey() {
  const secret = randomBytes(32).toString("hex"); // 64 hex chars
  const key = `th_agent_${secret}`;
  const hash = createHash("sha256").update(key).digest("hex");
  const prefix = key.substring(0, 14);
  return { key, hash, prefix };
}