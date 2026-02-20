/**
 * TaskHive — Comprehensive Agent API Test Suite
 * 
 * Pure HTTP tests — no direct DB access.
 * Covers: auth, envelope, rate limiting, browse, pagination, details,
 *         full lifecycle, edge cases, bulk ops, cancel, withdraw, IDs.
 * 
 * Usage:
 *   node test-agent-api.js
 * 
 * Prerequisites:
 *   - Dev server running (npm run dev)
 *   - Paste your API key and poster cookie below
 */

const BASE_URL = "https://taskhive-six.vercel.app";

// ══════════════════════════════════════════════════════════════════════
// PASTE YOUR VALUES HERE
// ══════════════════════════════════════════════════════════════════════
const API_KEY = "th_agent_509d2ce7ca2547516ebd375e916893da556e29f0ffd77eabf8c9dd61849d4584";
const POSTER_COOKIE = "sb-wkqrkknmimhzcozlaozo-auth-token=base64-eyJhY2Nlc3NfdG9rZW4iOiJleUpoYkdjaU9pSkZVekkxTmlJc0ltdHBaQ0k2SWpJMU5qVmtaVGxrTFRWa01qY3ROR0V4TWkxaFlURmpMV0UwWlRJM1pEWXlNbVEwTXlJc0luUjVjQ0k2SWtwWFZDSjkuZXlKcGMzTWlPaUpvZEhSd2N6b3ZMM2RyY1hKcmEyNXRhVzFvZW1OdmVteGhiM3B2TG5OMWNHRmlZWE5sTG1OdkwyRjFkR2d2ZGpFaUxDSnpkV0lpT2lJNFlqazBNRGc1WVMwek5ETXdMVFJtTXpRdFlUTXhZeTAzWkdRNFpXSm1OVFJpWWpFaUxDSmhkV1FpT2lKaGRYUm9aVzUwYVdOaGRHVmtJaXdpWlhod0lqb3hOemN4TlRrek9UVTBMQ0pwWVhRaU9qRTNOekUxT1RBek5UUXNJbVZ0WVdsc0lqb2liR1Z6WVdwaE1UYzBOa0JoYkdsaWRHOHVZMjl0SWl3aWNHaHZibVVpT2lJaUxDSmhjSEJmYldWMFlXUmhkR0VpT25zaWNISnZkbWxrWlhJaU9pSmxiV0ZwYkNJc0luQnliM1pwWkdWeWN5STZXeUpsYldGcGJDSmRmU3dpZFhObGNsOXRaWFJoWkdGMFlTSTZleUpsYldGcGJDSTZJbXhsYzJGcVlURTNORFpBWVd4cFluUnZMbU52YlNJc0ltVnRZV2xzWDNabGNtbG1hV1ZrSWpwMGNuVmxMQ0p1WVcxbElqb2liR1Z6WVdwaE1UYzBOa0JoYkdsaWRHOHVZMjl0SWl3aWNHaHZibVZmZG1WeWFXWnBaV1FpT21aaGJITmxMQ0p6ZFdJaU9pSTRZamswTURnNVlTMHpORE13TFRSbU16UXRZVE14WXkwM1pHUTRaV0ptTlRSaVlqRWlmU3dpY205c1pTSTZJbUYxZEdobGJuUnBZMkYwWldRaUxDSmhZV3dpT2lKaFlXd3hJaXdpWVcxeUlqcGJleUp0WlhSb2IyUWlPaUp3WVhOemQyOXlaQ0lzSW5ScGJXVnpkR0Z0Y0NJNk1UYzNNVFU1TURNMU5IMWRMQ0p6WlhOemFXOXVYMmxrSWpvaU5qUmhOMlkyWXpBdE1URXlaUzAwTkRWaExUaGtNbUl0TUdFd09XWXlNbVk1TmpWbElpd2lhWE5mWVc1dmJubHRiM1Z6SWpwbVlXeHpaWDAuRDRkMm9HT3Z6VzFKTzI5UGFET29TMFlCY0swVFpUTEFqd1NndVlUNDNlMGVubEZtTTA2ME1BYU82ZnlxRE5yWlZCMS1NUHpNQUE1ckNPRzRFTDBxM1EiLCJ0b2tlbl90eXBlIjoiYmVhcmVyIiwiZXhwaXJlc19pbiI6MzYwMCwiZXhwaXJlc19hdCI6MTc3MTU5Mzk1NCwicmVmcmVzaF90b2tlbiI6IndsaGs3cWxieDJ5MiIsInVzZXIiOnsiaWQiOiI4Yjk0MDg5YS0zNDMwLTRmMzQtYTMxYy03ZGQ4ZWJmNTRiYjEiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJlbWFpbCI6Imxlc2FqYTE3NDZAYWxpYnRvLmNvbSIsImVtYWlsX2NvbmZpcm1lZF9hdCI6IjIwMjYtMDItMTlUMTk6MzQ6MzEuNjI2MjQzWiIsInBob25lIjoiIiwiY29uZmlybWF0aW9uX3NlbnRfYXQiOiIyMDI2LTAyLTE5VDE5OjM0OjEyLjIwNjkyWiIsImNvbmZpcm1lZF9hdCI6IjIwMjYtMDItMTlUMTk6MzQ6MzEuNjI2MjQzWiIsImxhc3Rfc2lnbl9pbl9hdCI6IjIwMjYtMDItMjBUMTI6MjU6NTQuNTk1OTUyMDI0WiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoibGVzYWphMTc0NkBhbGlidG8uY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsIm5hbWUiOiJsZXNhamExNzQ2QGFsaWJ0by5jb20iLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInN1YiI6IjhiOTQwODlhLTM0MzAtNGYzNC1hMzFjLTdkZDhlYmY1NGJiMSJ9LCJpZGVudGl0aWVzIjpbeyJpZGVudGl0eV9pZCI6IjMyYWI2Yzg1LWM2MmMtNDA0Zi04ZTUxLTI4YjU5NzdjMjA3OCIsImlkIjoiOGI5NDA4OWEtMzQzMC00ZjM0LWEzMWMtN2RkOGViZjU0YmIxIiwidXNlcl9pZCI6IjhiOTQwODlhLTM0MzAtNGYzNC1hMzFjLTdkZDhlYmY1NGJiMSIsImlkZW50aXR5X2RhdGEiOnsiZW1haWwiOiJsZXNhamExNzQ2QGFsaWJ0by5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibmFtZSI6Imxlc2FqYTE3NDZAYWxpYnRvLmNvbSIsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwic3ViIjoiOGI5NDA4OWEtMzQzMC00ZjM0LWEzMWMtN2RkOGViZjU0YmIxIn0sInByb3ZpZGVyIjoiZW1haWwiLCJsYXN0X3NpZ25faW5fYXQiOiIyMDI2LTAyLTE5VDE5OjM0OjEyLjE3MjQ1NVoiLCJjcmVhdGVkX2F0IjoiMjAyNi0wMi0xOVQxOTozNDoxMi4xNzI1MTJaIiwidXBkYXRlZF9hdCI6IjIwMjYtMDItMTlUMTk6MzQ6MTIuMTcyNTEyWiIsImVtYWlsIjoibGVzYWphMTc0NkBhbGlidG8uY29tIn1dLCJjcmVhdGVkX2F0IjoiMjAyNi0wMi0xOVQxOTozNDoxMi4xNDU1OTFaIiwidXBkYXRlZF9hdCI6IjIwMjYtMDItMjBUMTI6MjU6NTQuNjIyMDIzWiIsImlzX2Fub255bW91cyI6ZmFsc2V9LCJ3ZWFrX3Bhc3N3b3JkIjpudWxsfQ";

// ──────────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
let skipped = 0;

function section(name) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${name}`);
  console.log(`${"═".repeat(60)}`);
}

function assert(condition, name, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name} — ${detail}`);
  }
}

function skip(name, reason) {
  skipped++;
  console.log(`  ⏭️  ${name} — ${reason}`);
}

// ─── HTTP helpers ────────────────────────────────────────────────────

async function agentReq(method, path, body = null, extraHeaders = {}) {
  const opts = {
    method,
    redirect: "manual",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      ...extraHeaders,
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

async function rawFetch(method, path, headers = {}, body = null) {
  const opts = { method, redirect: "manual", headers: { "Content-Type": "application/json", ...headers } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

async function posterReq(method, path, body = null) {
  const opts = {
    method,
    redirect: "manual",
    headers: { "Content-Type": "application/json", Cookie: POSTER_COOKIE },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

function hasPoster() {
  return POSTER_COOKIE !== "PASTE_YOUR_POSTER_COOKIE_HERE";
}

// Helper to create a task via poster
async function createTask(overrides = {}) {
  const defaults = {
    title: "Test task — " + Date.now(),
    description: "This is a test task created by the automated test suite for API verification purposes.",
    budgetCredits: 200,
    categoryId: 1,
    maxRevisions: 2,
  };
  const res = await posterReq("POST", "/api/tasks", { ...defaults, ...overrides });
  return res.status === 201 ? res.data : null;
}

// ══════════════════════════════════════════════════════════════════════
// 1. AUTHENTICATION
// ══════════════════════════════════════════════════════════════════════

async function testAuth() {
  section("1. Authentication");

  // No header
  const r1 = await rawFetch("GET", "/api/v1/tasks");
  assert(r1.status === 401, "No auth header → 401", `got ${r1.status}`);
  assert(r1.data?.ok === false, "Response ok: false");
  assert(r1.data?.error?.code === "UNAUTHORIZED", "Error code: UNAUTHORIZED", `got ${r1.data?.error?.code}`);
  assert(r1.data?.error?.suggestion != null, "Has suggestion field");
  assert(r1.data?.meta?.timestamp != null, "Error has meta.timestamp");
  assert(r1.data?.meta?.request_id != null, "Error has meta.request_id");

  // Malformed header (not Bearer)
  const r2 = await rawFetch("GET", "/api/v1/tasks", { Authorization: "Basic abc123" });
  assert(r2.status === 401, "Non-Bearer header → 401", `got ${r2.status}`);

  // Invalid key format (too short)
  const r3 = await rawFetch("GET", "/api/v1/tasks", { Authorization: "Bearer th_agent_tooshort" });
  assert(r3.status === 401, "Short key → 401", `got ${r3.status}`);
  assert(r3.data?.error?.suggestion != null, "Short key has suggestion");

  // Wrong prefix
  const r3b = await rawFetch("GET", "/api/v1/tasks", { Authorization: "Bearer xx_wrong_" + "a".repeat(64) });
  assert(r3b.status === 401, "Wrong prefix → 401", `got ${r3b.status}`);

  // Valid format but wrong key (not in DB)
  const fakeKey = "th_agent_" + "a".repeat(64);
  const r4 = await rawFetch("GET", "/api/v1/tasks", { Authorization: `Bearer ${fakeKey}` });
  assert(r4.status === 401, "Wrong key → 401", `got ${r4.status}`);
  assert(r4.data?.error?.code === "UNAUTHORIZED", "Wrong key code: UNAUTHORIZED");
  assert(r4.data?.error?.suggestion != null, "Wrong key has actionable suggestion");

  // Valid key
  const r5 = await agentReq("GET", "/api/v1/tasks");
  assert(r5.status === 200, "Valid key → 200", `got ${r5.status}`);
  assert(r5.data?.ok === true, "Response ok: true");
}

// ══════════════════════════════════════════════════════════════════════
// 2. RESPONSE ENVELOPE
// ══════════════════════════════════════════════════════════════════════

async function testEnvelope() {
  section("2. Response Envelope — Consistent Shape");

  // Success envelope (list)
  const r1 = await agentReq("GET", "/api/v1/tasks");
  assert(r1.data?.ok === true, "Success: ok is true");
  assert(Array.isArray(r1.data?.data), "Success (list): data is array");
  assert(r1.data?.meta != null, "Success: has meta object");
  assert(r1.data?.meta?.timestamp != null, "meta.timestamp present");
  assert(r1.data?.meta?.request_id != null, "meta.request_id present");
  assert(typeof r1.data?.meta?.request_id === "string", "request_id is string");
  assert(r1.data?.meta?.request_id?.startsWith("req_"), "request_id starts with 'req_'", `got '${r1.data?.meta?.request_id}'`);
  assert(r1.data?.meta?.count != null, "meta.count present (list endpoint)");
  assert(r1.data?.meta?.has_more != null, "meta.has_more present");

  // Success envelope (single)
  const r1b = await agentReq("GET", "/api/v1/agents/me");
  assert(r1b.data?.ok === true, "Success (single): ok is true");
  assert(!Array.isArray(r1b.data?.data), "Success (single): data is object, not array");
  assert(r1b.data?.meta != null, "Single: has meta");

  // Error envelope
  const r2 = await agentReq("GET", "/api/v1/tasks?sort=invalid");
  assert(r2.data?.ok === false, "Error: ok is false");
  assert(r2.data?.error != null, "Error: has error object");
  assert(typeof r2.data?.error?.code === "string", "error.code is string");
  assert(typeof r2.data?.error?.message === "string", "error.message is string");
  assert(typeof r2.data?.error?.suggestion === "string", "error.suggestion is string");
  assert(r2.data?.meta != null, "Error: has meta");
  assert(r2.data?.meta?.request_id != null, "Error: has meta.request_id");

  // 404 envelope
  const r3 = await agentReq("GET", "/api/v1/tasks/999999");
  assert(r3.data?.ok === false, "404: ok is false");
  assert(r3.data?.error?.code === "TASK_NOT_FOUND", "404: code is TASK_NOT_FOUND");
  assert(r3.data?.error?.suggestion != null, "404: suggestion is actionable");
}

// ══════════════════════════════════════════════════════════════════════
// 3. RATE LIMITING
// ══════════════════════════════════════════════════════════════════════

async function testRateLimiting() {
  section("3. Rate Limiting");

  const r1 = await agentReq("GET", "/api/v1/tasks");

  const limit = r1.headers.get("x-ratelimit-limit");
  const remaining = r1.headers.get("x-ratelimit-remaining");
  const reset = r1.headers.get("x-ratelimit-reset");

  assert(limit != null, "X-RateLimit-Limit header present", "missing");
  assert(remaining != null, "X-RateLimit-Remaining header present", "missing");
  assert(reset != null, "X-RateLimit-Reset header present", "missing");
  assert(limit === "100", "Limit is 100/min", `got ${limit}`);
  assert(parseInt(remaining) >= 0, "Remaining is non-negative", `got ${remaining}`);
  assert(parseInt(reset) > 0, "Reset is a future timestamp", `got ${reset}`);

  // Verify headers on error responses too
  const r2 = await agentReq("GET", "/api/v1/tasks?sort=bad");
  assert(r2.headers.get("x-ratelimit-limit") != null, "Rate headers on 400 errors too");

  console.log("  ℹ️  Skipping 429 flood test (would require 100+ requests)");
}

// ══════════════════════════════════════════════════════════════════════
// 4. GET /api/v1/tasks — BROWSE
// ══════════════════════════════════════════════════════════════════════

async function testBrowseTasks() {
  section("4. GET /api/v1/tasks — Browse Tasks");

  // Default
  const r1 = await agentReq("GET", "/api/v1/tasks");
  assert(r1.status === 200, "Default browse → 200");
  assert(Array.isArray(r1.data?.data), "Returns array");

  // Task shape
  if (r1.data?.data?.length > 0) {
    const t = r1.data.data[0];
    assert(Number.isInteger(t.id), "id is integer");
    assert(typeof t.title === "string", "Has title (string)");
    assert(typeof t.description === "string", "Has description (string)");
    assert(typeof t.budget_credits === "number", "Has budget_credits (number)");
    assert(typeof t.status === "string", "Has status (string)");
    assert(t.poster != null && typeof t.poster === "object", "Has poster object");
    assert(typeof t.poster?.name === "string", "poster.name is string");
    assert(t.poster?.email === undefined, "poster does NOT expose email");
    assert(typeof t.claims_count === "number", "Has claims_count (number)");
    assert(t.max_revisions != null, "Has max_revisions");
    assert(t.created_at != null, "Has created_at");
  }

  // Filters
  const r2 = await agentReq("GET", "/api/v1/tasks?status=completed");
  assert(r2.status === 200, "Filter status=completed → 200");

  const r3 = await agentReq("GET", "/api/v1/tasks?category=1");
  assert(r3.status === 200, "Filter category=1 → 200");

  const r4 = await agentReq("GET", "/api/v1/tasks?min_budget=50&max_budget=500");
  assert(r4.status === 200, "Filter budget range → 200");

  // All valid sorts
  for (const sort of ["newest", "oldest", "budget_high", "budget_low"]) {
    const r = await agentReq("GET", `/api/v1/tasks?sort=${sort}`);
    assert(r.status === 200, `Sort ${sort} → 200`);
  }

  // Invalid sort
  const r5 = await agentReq("GET", "/api/v1/tasks?sort=random");
  assert(r5.status === 400, "Invalid sort → 400", `got ${r5.status}`);
  assert(r5.data?.error?.code === "INVALID_PARAMETER", "Code: INVALID_PARAMETER");
  assert(r5.data?.error?.suggestion?.includes("newest"), "Suggestion lists valid values");

  // Limit validation
  const r6 = await agentReq("GET", "/api/v1/tasks?limit=0");
  assert(r6.status === 400, "limit=0 → 400", `got ${r6.status}`);

  const r7 = await agentReq("GET", "/api/v1/tasks?limit=999");
  assert(r7.status === 400, "limit=999 → 400", `got ${r7.status}`);

  const r8 = await agentReq("GET", "/api/v1/tasks?limit=2");
  assert(r8.status === 200, "limit=2 → 200");
  assert(r8.data?.data?.length <= 2, "Returns max 2 items", `got ${r8.data?.data?.length}`);

  const r9 = await agentReq("GET", "/api/v1/tasks?limit=1");
  assert(r9.status === 200, "limit=1 → 200");

  const r10 = await agentReq("GET", "/api/v1/tasks?limit=100");
  assert(r10.status === 200, "limit=100 → 200");
}

// ══════════════════════════════════════════════════════════════════════
// 5. PAGINATION (cursor-based)
// ══════════════════════════════════════════════════════════════════════

async function testPagination() {
  section("5. Cursor-Based Pagination");

  const r1 = await agentReq("GET", "/api/v1/tasks?limit=2&status=open");
  assert(r1.status === 200, "Page 1 loads");
  assert(typeof r1.data?.meta?.has_more === "boolean", "has_more is boolean");
  assert(typeof r1.data?.meta?.count === "number", "count is number");

  const seenIds = new Set();
  r1.data?.data?.forEach((t) => seenIds.add(t.id));

  if (r1.data?.meta?.has_more && r1.data?.meta?.cursor) {
    const cursor = r1.data.meta.cursor;
    assert(typeof cursor === "string", "cursor is string");

    // Page 2
    const r2 = await agentReq("GET", `/api/v1/tasks?limit=2&status=open&cursor=${cursor}`);
    assert(r2.status === 200, "Page 2 loads with cursor");

    let hasDuplicate = false;
    r2.data?.data?.forEach((t) => {
      if (seenIds.has(t.id)) hasDuplicate = true;
      seenIds.add(t.id);
    });
    assert(!hasDuplicate, "No duplicate items across pages (deterministic)");

    // Page 2 IDs should all be different from page 1
    assert(r2.data?.data?.length > 0, "Page 2 has results");
  } else {
    console.log("  ℹ️  Only 1 page — create more open tasks to test multi-page pagination");
  }

  // No cursor on last page
  const all = await agentReq("GET", "/api/v1/tasks?limit=100&status=open");
  if (!all.data?.meta?.has_more) {
    assert(all.data?.meta?.cursor == null, "No cursor when has_more=false");
  }

  // Invalid cursor
  const r3 = await agentReq("GET", "/api/v1/tasks?cursor=!!!invalid!!!");
  assert(r3.status === 400, "Invalid cursor → 400", `got ${r3.status}`);
}

// ══════════════════════════════════════════════════════════════════════
// 6. GET /api/v1/tasks/:id — Task Details
// ══════════════════════════════════════════════════════════════════════

async function testTaskDetails() {
  section("6. GET /api/v1/tasks/:id — Task Details");

  // 404
  const r1 = await agentReq("GET", "/api/v1/tasks/999999");
  assert(r1.status === 404, "Non-existent → 404", `got ${r1.status}`);
  assert(r1.data?.error?.code === "TASK_NOT_FOUND", "Code: TASK_NOT_FOUND");
  assert(r1.data?.error?.suggestion != null, "Has actionable suggestion");

  // Real task
  const browse = await agentReq("GET", "/api/v1/tasks?limit=1");
  if (browse.data?.data?.length > 0) {
    const taskId = browse.data.data[0].id;
    const r2 = await agentReq("GET", `/api/v1/tasks/${taskId}`);
    assert(r2.status === 200, `Get task #${taskId} → 200`);
    assert(Number.isInteger(r2.data?.data?.id), "ID is integer");
    assert(r2.data?.data?.claims_count != null, "Has claims_count");
    assert(r2.data?.data?.deliverables_count != null, "Has deliverables_count");
    assert(r2.data?.data?.poster?.name != null, "Has poster name");
  }
}

// ══════════════════════════════════════════════════════════════════════
// 7. FULL LIFECYCLE — Claim → Deliver → Revision → Accept → Credits
// ══════════════════════════════════════════════════════════════════════

async function testFullLifecycle() {
  section("7. Full Lifecycle — Claim → Deliver → Revision → Accept → Review");

  if (!hasPoster()) { skip("Full lifecycle", "POSTER_COOKIE not set"); return {}; }

  const task = await createTask({
    title: "Lifecycle Test — Build a REST API client",
    budgetCredits: 200,
    maxRevisions: 2,
  });
  if (!task) { skip("Full lifecycle", "Could not create task"); return {}; }

  const taskId = task.id;
  console.log(`  📌 Task #${taskId} created`);

  // ─── CLAIM VALIDATION ────────────────────────────────────────────

  // Missing proposed_credits
  const c1 = await agentReq("POST", `/api/v1/tasks/${taskId}/claims`, { message: "hi" });
  assert(c1.status === 422, "Claim: missing credits → 422", `got ${c1.status}`);
  assert(c1.data?.error?.code === "VALIDATION_ERROR", "Code: VALIDATION_ERROR");
  assert(c1.data?.error?.suggestion != null, "Suggestion is actionable");

  // Credits = 0
  const c1b = await agentReq("POST", `/api/v1/tasks/${taskId}/claims`, { proposed_credits: 0 });
  assert(c1b.status === 422, "Claim: credits=0 → 422", `got ${c1b.status}`);

  // Exceeds budget
  const c2 = await agentReq("POST", `/api/v1/tasks/${taskId}/claims`, { proposed_credits: 999 });
  assert(c2.status === 422, "Claim: exceeds budget → 422", `got ${c2.status}`);
  assert(c2.data?.error?.code === "INVALID_CREDITS", "Code: INVALID_CREDITS");

  // Message too long
  const c2b = await agentReq("POST", `/api/v1/tasks/${taskId}/claims`, {
    proposed_credits: 100,
    message: "x".repeat(1001),
  });
  assert(c2b.status === 422, "Claim: message >1000 → 422", `got ${c2b.status}`);

  // Non-existent task
  const c3 = await agentReq("POST", "/api/v1/tasks/999999/claims", { proposed_credits: 100 });
  assert(c3.status === 404, "Claim: non-existent task → 404", `got ${c3.status}`);

  // Valid claim
  const c4 = await agentReq("POST", `/api/v1/tasks/${taskId}/claims`, {
    proposed_credits: 180,
    message: "I can deliver this quickly with proper error handling.",
  });
  assert(c4.status === 201, "Claim: valid → 201", `got ${c4.status}`);
  assert(c4.data?.data?.status === "pending", "Claim status: pending");
  assert(Number.isInteger(c4.data?.data?.id), "Claim ID is integer");
  const claimId = c4.data?.data?.id;

  // Duplicate claim
  const c5 = await agentReq("POST", `/api/v1/tasks/${taskId}/claims`, { proposed_credits: 180 });
  assert(c5.status === 409, "Duplicate claim → 409", `got ${c5.status}`);
  assert(c5.data?.error?.code === "DUPLICATE_CLAIM", "Code: DUPLICATE_CLAIM");

  // List claims
  const c6 = await agentReq("GET", `/api/v1/tasks/${taskId}/claims`);
  assert(c6.status === 200, "List claims → 200");
  assert(c6.data?.data?.length >= 1, "Has at least 1 claim");

  // ─── DELIVER BEFORE ACCEPTED → FAIL ──────────────────────────────

  const d0 = await agentReq("POST", `/api/v1/tasks/${taskId}/deliverables`, { content: "test" });
  assert(d0.status === 403 || d0.status === 409, "Deliver before accepted → 403/409", `got ${d0.status}`);

  // ─── POSTER ACCEPTS CLAIM ────────────────────────────────────────

  const accept = await posterReq("PATCH", `/api/tasks/${taskId}/claims/${claimId}`, { action: "accept" });
  assert(accept.status === 200, "Poster accepts claim → 200", `got ${accept.status}`);

  // Claim on now-claimed task
  const c7 = await agentReq("POST", `/api/v1/tasks/${taskId}/claims`, { proposed_credits: 100 });
  assert(c7.status === 409, "Claim on claimed task → 409", `got ${c7.status}`);
  assert(c7.data?.error?.code === "TASK_NOT_OPEN", "Code: TASK_NOT_OPEN");

  // ─── DELIVERABLE VALIDATION ──────────────────────────────────────

  const d1 = await agentReq("POST", `/api/v1/tasks/${taskId}/deliverables`, { content: "" });
  assert(d1.status === 422, "Empty content → 422", `got ${d1.status}`);

  const d2 = await agentReq("POST", `/api/v1/tasks/${taskId}/deliverables`, {});
  assert(d2.status === 422, "Missing content → 422", `got ${d2.status}`);

  const d2b = await agentReq("POST", "/api/v1/tasks/999999/deliverables", { content: "test" });
  assert(d2b.status === 404, "Deliver to non-existent → 404", `got ${d2b.status}`);

  // Valid deliverable
  const d4 = await agentReq("POST", `/api/v1/tasks/${taskId}/deliverables`, {
    content: "```python\nclass APIClient:\n    def __init__(self, base_url):\n        self.base_url = base_url\n    def get(self, path):\n        return requests.get(f'{self.base_url}{path}').json()\n```",
  });
  assert(d4.status === 201, "Submit deliverable → 201", `got ${d4.status}`);
  assert(d4.data?.data?.revision_number === 1, "Revision #1", `got ${d4.data?.data?.revision_number}`);
  assert(d4.data?.data?.status === "submitted", "Status: submitted");
  const deliverableId1 = d4.data?.data?.id;

  // ─── CONCURRENT DELIVERY GUARD ───────────────────────────────────

  const d4b = await agentReq("POST", `/api/v1/tasks/${taskId}/deliverables`, { content: "second attempt" });
  assert(d4b.status === 409, "Concurrent delivery → 409", `got ${d4b.status}`);
  assert(d4b.data?.error?.code === "DELIVERY_PENDING" || d4b.data?.error?.code === "INVALID_STATUS",
    "Code: DELIVERY_PENDING or INVALID_STATUS", `got ${d4b.data?.error?.code}`);

  // List deliverables
  const d5 = await agentReq("GET", `/api/v1/tasks/${taskId}/deliverables`);
  assert(d5.status === 200, "List deliverables → 200");
  assert(d5.data?.data?.length >= 1, "Has deliverables");

  // ─── POSTER REQUESTS REVISION ────────────────────────────────────

  const rev = await posterReq("PATCH", `/api/tasks/${taskId}/deliverables/${deliverableId1}`, {
    action: "revision",
    revisionNotes: "Add retry logic and timeout handling",
  });
  assert(rev.status === 200, "Poster requests revision → 200", `got ${rev.status}`);

  // ─── AGENT SUBMITS REVISION ──────────────────────────────────────

  const d6 = await agentReq("POST", `/api/v1/tasks/${taskId}/deliverables`, {
    content: "```python\nclass APIClient:\n    def __init__(self, base_url, retries=3, timeout=30):\n        self.base_url = base_url\n        self.retries = retries\n        self.timeout = timeout\n    def get(self, path):\n        for i in range(self.retries):\n            try:\n                return requests.get(f'{self.base_url}{path}', timeout=self.timeout).json()\n            except Exception:\n                if i == self.retries - 1: raise\n```",
  });
  assert(d6.status === 201, "Submit revision → 201", `got ${d6.status}`);
  assert(d6.data?.data?.revision_number === 2, "Revision #2", `got ${d6.data?.data?.revision_number}`);
  const deliverableId2 = d6.data?.data?.id;

  // ─── POSTER ACCEPTS DELIVERABLE ──────────────────────────────────

  const acceptDel = await posterReq("PATCH", `/api/tasks/${taskId}/deliverables/${deliverableId2}`, {
    action: "accept",
  });
  assert(acceptDel.status === 200, "Poster accepts deliverable → 200", `got ${acceptDel.status}`);

  // ─── VERIFY CREDITS ──────────────────────────────────────────────

  const credits = await agentReq("GET", "/api/v1/agents/me/credits");
  assert(credits.status === 200, "Get credits → 200");
  assert(typeof credits.data?.data?.credit_balance === "number", "credit_balance is number");
  assert(credits.data?.data?.credit_balance >= 0, "Balance is non-negative (≥0)");

  const txns = credits.data?.data?.recent_transactions;
  assert(Array.isArray(txns), "recent_transactions is array");

  const paymentTx = txns?.find((t) => t.type === "payment" && t.task_id === taskId);
  assert(paymentTx != null, "Payment transaction exists");
  assert(paymentTx?.amount === 180, "Payment = 200 - 10% fee = 180", `got ${paymentTx?.amount}`);

  const feeTx = txns?.find((t) => t.type === "platform_fee" && t.task_id === taskId);
  assert(feeTx != null, "Platform fee transaction exists");
  assert(feeTx?.amount === -20, "Platform fee = -20", `got ${feeTx?.amount}`);

  // ─── VERIFY AGENT STATS ──────────────────────────────────────────

  const profile = await agentReq("GET", "/api/v1/agents/me");
  assert(profile.data?.data?.tasks_completed >= 1, `tasks_completed ≥ 1 (got ${profile.data?.data?.tasks_completed})`);

  // ─── POSTER REVIEW ───────────────────────────────────────────────

  const agentId = profile.data?.data?.id;

  const review = await posterReq("POST", `/api/tasks/${taskId}/review`, {
    agentId,
    rating: 5,
    qualityScore: 5,
    speedScore: 4,
    comment: "Excellent implementation.",
  });
  assert(review.status === 201, "Submit review → 201", `got ${review.status}`);

  // Duplicate review
  const review2 = await posterReq("POST", `/api/tasks/${taskId}/review`, { agentId, rating: 3 });
  assert(review2.status === 400, "Duplicate review → 400", `got ${review2.status}`);

  // ─── DELIVER TO COMPLETED TASK ───────────────────────────────────

  const dCompleted = await agentReq("POST", `/api/v1/tasks/${taskId}/deliverables`, { content: "late" });
  assert(dCompleted.status === 409, "Deliver to completed task → 409", `got ${dCompleted.status}`);

  return { taskId, claimId };
}

// ══════════════════════════════════════════════════════════════════════
// 8. EDGE CASES
// ══════════════════════════════════════════════════════════════════════

async function testEdgeCases() {
  section("8. Edge Cases");

  if (!hasPoster()) { skip("Edge cases", "POSTER_COOKIE not set"); return; }

  // ─── 8a. Max revisions = 0 (no revisions allowed) ────────────────

  console.log("\n  --- 8a. Max revisions = 0 ---");

  const task0 = await createTask({ title: "Edge: maxRevisions=0", budgetCredits: 50, maxRevisions: 0 });
  if (task0) {
    const claim = await agentReq("POST", `/api/v1/tasks/${task0.id}/claims`, { proposed_credits: 50 });
    if (claim.status === 201) {
      await posterReq("PATCH", `/api/tasks/${task0.id}/claims/${claim.data.data.id}`, { action: "accept" });

      const del = await agentReq("POST", `/api/v1/tasks/${task0.id}/deliverables`, { content: "Only attempt" });
      assert(del.status === 201, "Delivery #1 → 201 (maxRevisions=0)", `got ${del.status}`);

      // Poster tries revision → should fail
      const revReq = await posterReq("PATCH", `/api/tasks/${task0.id}/deliverables/${del.data?.data?.id}`, {
        action: "revision",
        revisionNotes: "Want changes",
      });
      assert(revReq.status === 400, "Revision blocked at max → 400", `got ${revReq.status}`);

      // Poster must accept or reject
      const acceptRes = await posterReq("PATCH", `/api/tasks/${task0.id}/deliverables/${del.data?.data?.id}`, {
        action: "accept",
      });
      assert(acceptRes.status === 200, "Poster forced to accept → 200", `got ${acceptRes.status}`);
    }
  }

  // ─── 8b. Cancel task → auto-reject claims ────────────────────────

  console.log("\n  --- 8b. Cancel task → auto-reject claims ---");

  const taskCancel = await createTask({ title: "Edge: cancel test", budgetCredits: 50 });
  if (taskCancel) {
    // Agent claims it
    const claim = await agentReq("POST", `/api/v1/tasks/${taskCancel.id}/claims`, { proposed_credits: 50 });
    assert(claim.status === 201, "Claim created for cancel test");

    // Poster cancels
    const cancel = await posterReq("POST", `/api/tasks/${taskCancel.id}/cancel`);
    assert(cancel.status === 200, "Poster cancels task → 200", `got ${cancel.status}`);

    // Verify task is cancelled
    const taskDetail = await agentReq("GET", `/api/v1/tasks/${taskCancel.id}`);
    assert(taskDetail.data?.data?.status === "cancelled", "Task status → cancelled", `got ${taskDetail.data?.data?.status}`);

    // Verify claims were auto-rejected
    const claims = await agentReq("GET", `/api/v1/tasks/${taskCancel.id}/claims`);
    const pendingClaims = claims.data?.data?.filter((c) => c.status === "pending");
    assert(pendingClaims?.length === 0, "No pending claims remain (auto-rejected)");

    // Try to claim cancelled task
    const claimCancelled = await agentReq("POST", `/api/v1/tasks/${taskCancel.id}/claims`, { proposed_credits: 50 });
    assert(claimCancelled.status === 409, "Claim on cancelled task → 409", `got ${claimCancelled.status}`);
    assert(claimCancelled.data?.error?.code === "TASK_NOT_OPEN", "Code: TASK_NOT_OPEN");
  }

  // ─── 8c. Withdraw claim → task reverts to open ───────────────────

  console.log("\n  --- 8c. Withdraw claim ---");

  const taskWithdraw = await createTask({ title: "Edge: withdraw test", budgetCredits: 80 });
  if (taskWithdraw) {
    const claim = await agentReq("POST", `/api/v1/tasks/${taskWithdraw.id}/claims`, { proposed_credits: 80 });
    const claimId = claim.data?.data?.id;

    if (claimId) {
      // Accept claim first
      await posterReq("PATCH", `/api/tasks/${taskWithdraw.id}/claims/${claimId}`, { action: "accept" });

      // Agent withdraws
      const withdraw = await agentReq("POST", `/api/v1/tasks/${taskWithdraw.id}/claims/${claimId}/withdraw`);
      assert(withdraw.status === 200, "Withdraw accepted claim → 200", `got ${withdraw.status}`);
      assert(withdraw.data?.data?.status === "withdrawn", "Claim status: withdrawn");
      assert(withdraw.data?.data?.task_reverted === true, "Task reverted to open");

      // Verify task is open again
      const detail = await agentReq("GET", `/api/v1/tasks/${taskWithdraw.id}`);
      assert(detail.data?.data?.status === "open", "Task back to open", `got ${detail.data?.data?.status}`);
      assert(detail.data?.data?.claimed_by_agent_id == null, "No claimed agent");

      // Withdraw already-withdrawn → fail
      const withdraw2 = await agentReq("POST", `/api/v1/tasks/${taskWithdraw.id}/claims/${claimId}/withdraw`);
      assert(withdraw2.status === 409, "Withdraw already-withdrawn → 409", `got ${withdraw2.status}`);
    }
  }

  // ─── 8d. Deliver without claiming ─────────────────────────────────

  console.log("\n  --- 8d. Deliver without claiming ---");

  const taskNoClaim = await createTask({ title: "Edge: no claim delivery", budgetCredits: 50 });
  if (taskNoClaim) {
    const r = await agentReq("POST", `/api/v1/tasks/${taskNoClaim.id}/deliverables`, { content: "surprise!" });
    assert(r.status === 403, "Deliver without claim → 403", `got ${r.status}`);
    assert(r.data?.error?.code === "NOT_CLAIMED_BY_YOU", "Code: NOT_CLAIMED_BY_YOU");
  }

  // ─── 8e. Content too long (>50000) ────────────────────────────────

  console.log("\n  --- 8e. Content >50000 chars ---");

  const taskLong = await createTask({ title: "Edge: long content", budgetCredits: 50 });
  if (taskLong) {
    const claim = await agentReq("POST", `/api/v1/tasks/${taskLong.id}/claims`, { proposed_credits: 50 });
    if (claim.status === 201) {
      await posterReq("PATCH", `/api/tasks/${taskLong.id}/claims/${claim.data.data.id}`, { action: "accept" });
      const r = await agentReq("POST", `/api/v1/tasks/${taskLong.id}/deliverables`, { content: "x".repeat(50001) });
      assert(r.status === 422, "Content >50000 → 422", `got ${r.status}`);
    }
  }

  // ─── 8f. Late delivery (past deadline) ────────────────────────────

  console.log("\n  --- 8f. Late delivery (past deadline) ---");

  const pastDeadline = new Date(Date.now() - 86400000).toISOString(); // yesterday
  const taskLate = await createTask({
    title: "Edge: late delivery",
    budgetCredits: 50,
    deadline: pastDeadline,
  });
  if (taskLate) {
    const claim = await agentReq("POST", `/api/v1/tasks/${taskLate.id}/claims`, { proposed_credits: 50 });
    if (claim.status === 201) {
      await posterReq("PATCH", `/api/tasks/${taskLate.id}/claims/${claim.data.data.id}`, { action: "accept" });
      const r = await agentReq("POST", `/api/v1/tasks/${taskLate.id}/deliverables`, { content: "Late work" });
      assert(r.status === 201, "Late delivery still accepted → 201", `got ${r.status}`);
      assert(r.data?.data?.is_late === true, "is_late flag is true", `got ${r.data?.data?.is_late}`);
      if (r.data?.meta?.warning) {
        assert(r.data.meta.warning.includes("deadline"), "Warning mentions deadline");
      }
    }
  }

  // ─── 8g. Cancel already in-progress task → fail ───────────────────

  console.log("\n  --- 8g. Cancel limits ---");

  // Can't cancel completed task
  const completedTasks = await agentReq("GET", "/api/v1/tasks?status=completed&limit=1");
  if (completedTasks.data?.data?.length > 0) {
    const cid = completedTasks.data.data[0].id;
    const r = await posterReq("POST", `/api/tasks/${cid}/cancel`);
    assert(r.status === 400, "Cancel completed task → 400", `got ${r.status}`);
  }
}

// ══════════════════════════════════════════════════════════════════════
// 9. BULK OPERATIONS
// ══════════════════════════════════════════════════════════════════════

async function testBulk() {
  section("9. POST /api/v1/tasks/bulk/claims — Bulk Operations");

  if (!hasPoster()) { skip("Bulk operations", "POSTER_COOKIE not set"); return; }

  const t1 = await createTask({ title: "Bulk test 1", budgetCredits: 100 });
  const t2 = await createTask({ title: "Bulk test 2", budgetCredits: 150 });

  if (!t1 || !t2) { skip("Bulk claims", "Could not create tasks"); return; }

  // Empty claims
  const b1 = await agentReq("POST", "/api/v1/tasks/bulk/claims", { claims: [] });
  assert(b1.status === 422, "Empty array → 422", `got ${b1.status}`);

  // Missing claims field
  const b1b = await agentReq("POST", "/api/v1/tasks/bulk/claims", {});
  assert(b1b.status === 422, "Missing claims field → 422", `got ${b1b.status}`);

  // Too many (>10)
  const b2 = await agentReq("POST", "/api/v1/tasks/bulk/claims", {
    claims: Array.from({ length: 11 }, (_, i) => ({ task_id: i + 1, proposed_credits: 10 })),
  });
  assert(b2.status === 422, ">10 claims → 422", `got ${b2.status}`);

  // Partial success: 2 valid + 1 non-existent
  const b3 = await agentReq("POST", "/api/v1/tasks/bulk/claims", {
    claims: [
      { task_id: t1.id, proposed_credits: 80, message: "Bulk 1" },
      { task_id: t2.id, proposed_credits: 120 },
      { task_id: 999999, proposed_credits: 50 },
    ],
  });
  assert(b3.status === 200, "Bulk claim → 200", `got ${b3.status}`);

  const summary = b3.data?.data?.summary;
  assert(summary?.total === 3, "Total: 3", `got ${summary?.total}`);
  assert(summary?.succeeded === 2, "Succeeded: 2", `got ${summary?.succeeded}`);
  assert(summary?.failed === 1, "Failed: 1", `got ${summary?.failed}`);

  const results = b3.data?.data?.results;
  assert(results?.length === 3, "3 individual results");

  const ok1 = results?.find((r) => r.task_id === t1.id);
  assert(ok1?.ok === true, `Task ${t1.id}: ok=true`);
  assert(ok1?.claim_id != null, "Has claim_id");

  const fail1 = results?.find((r) => r.task_id === 999999);
  assert(fail1?.ok === false, "Task 999999: ok=false");
  assert(fail1?.error?.code != null, "Has error code");

  // Duplicate in follow-up bulk
  const b4 = await agentReq("POST", "/api/v1/tasks/bulk/claims", {
    claims: [{ task_id: t1.id, proposed_credits: 80 }],
  });
  assert(b4.status === 200, "Bulk with existing claim → 200 (partial)");
  assert(b4.data?.data?.results?.[0]?.ok === false, "Duplicate fails individually");
  assert(b4.data?.data?.summary?.failed === 1, "Failed: 1");
}

// ══════════════════════════════════════════════════════════════════════
// 10. AGENT PROFILE ENDPOINTS
// ══════════════════════════════════════════════════════════════════════

async function testAgentEndpoints() {
  section("10. Agent Profile Endpoints");

  // GET /agents/me
  const r1 = await agentReq("GET", "/api/v1/agents/me");
  assert(r1.status === 200, "GET /agents/me → 200");
  assert(Number.isInteger(r1.data?.data?.id), "id is integer");
  assert(typeof r1.data?.data?.name === "string", "Has name");
  assert(r1.data?.data?.reputation_score != null, "Has reputation_score");
  assert(r1.data?.data?.tasks_completed != null, "Has tasks_completed");

  const agentId = r1.data?.data?.id;

  // PATCH /agents/me — valid
  const r2 = await agentReq("PATCH", "/api/v1/agents/me", { description: "Updated via test at " + Date.now() });
  assert(r2.status === 200, "PATCH /agents/me → 200");

  // PATCH with empty body
  const r3 = await agentReq("PATCH", "/api/v1/agents/me", {});
  assert(r3.status === 422, "PATCH empty body → 422", `got ${r3.status}`);

  // GET /agents/me/claims
  const r4 = await agentReq("GET", "/api/v1/agents/me/claims");
  assert(r4.status === 200, "GET /agents/me/claims → 200");
  assert(Array.isArray(r4.data?.data), "Returns array");

  // GET /agents/me/tasks
  const r5 = await agentReq("GET", "/api/v1/agents/me/tasks");
  assert(r5.status === 200, "GET /agents/me/tasks → 200");
  assert(Array.isArray(r5.data?.data), "Returns array");

  // GET /agents/me/credits
  const r6 = await agentReq("GET", "/api/v1/agents/me/credits");
  assert(r6.status === 200, "GET /agents/me/credits → 200");
  assert(typeof r6.data?.data?.credit_balance === "number", "credit_balance is number");
  assert(r6.data?.data?.credit_balance >= 0, "Balance ≥ 0 (never negative)");
  assert(Array.isArray(r6.data?.data?.recent_transactions), "Has transactions array");

  // GET /agents/:id — public profile
  if (agentId) {
    const r7 = await agentReq("GET", `/api/v1/agents/${agentId}`);
    assert(r7.status === 200, `GET /agents/${agentId} → 200`);
    assert(r7.data?.data?.name != null, "Public profile has name");
  }

  // Non-existent agent
  const r8 = await agentReq("GET", "/api/v1/agents/999999");
  assert(r8.status === 404, "Non-existent agent → 404", `got ${r8.status}`);
  assert(r8.data?.error?.code === "AGENT_NOT_FOUND", "Code: AGENT_NOT_FOUND");
}

// ══════════════════════════════════════════════════════════════════════
// 11. INTEGER IDs — All API IDs must be integers
// ══════════════════════════════════════════════════════════════════════

async function testIntegerIds() {
  section("11. Integer IDs Verification");

  // Tasks
  const r1 = await agentReq("GET", "/api/v1/tasks?limit=3");
  if (r1.data?.data?.length > 0) {
    r1.data.data.forEach((t, i) => {
      assert(Number.isInteger(t.id), `Task[${i}].id = ${t.id} is integer`);
      if (t.poster?.id) assert(Number.isInteger(t.poster.id), `Task[${i}].poster.id is integer`);
      if (t.category?.id) assert(Number.isInteger(t.category.id), `Task[${i}].category.id is integer`);
    });
  }

  // Agent
  const r2 = await agentReq("GET", "/api/v1/agents/me");
  assert(Number.isInteger(r2.data?.data?.id), "Agent id is integer");

  // Claims
  const r3 = await agentReq("GET", "/api/v1/agents/me/claims");
  if (r3.data?.data?.length > 0) {
    const c = r3.data.data[0];
    assert(Number.isInteger(c.id), "Claim id is integer");
    assert(Number.isInteger(c.task_id), "Claim task_id is integer");
  }

  // Transactions
  const r4 = await agentReq("GET", "/api/v1/agents/me/credits");
  if (r4.data?.data?.recent_transactions?.length > 0) {
    const tx = r4.data.data.recent_transactions[0];
    assert(Number.isInteger(tx.id), "Transaction id is integer");
  }
}

// ══════════════════════════════════════════════════════════════════════
// RUNNER
// ══════════════════════════════════════════════════════════════════════

async function run() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   TaskHive — Comprehensive Agent API Test Suite         ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`\nTarget: ${BASE_URL}`);
  console.log(`API Key: ${API_KEY.substring(0, 20)}...`);
  console.log(`Poster:  ${hasPoster() ? "configured" : "NOT SET (lifecycle tests will skip)"}`);

  if (API_KEY === "PASTE_YOUR_AGENT_API_KEY_HERE") {
    console.log("\n❌ Paste your API key in the API_KEY variable!\n");
    process.exit(1);
  }

  try { await fetch(BASE_URL, { redirect: "manual" }); } catch {
    console.log("\n❌ Cannot reach dev server. Run 'npm run dev' first.\n");
    process.exit(1);
  }

  await testAuth();
  await testEnvelope();
  await testRateLimiting();
  await testBrowseTasks();
  await testPagination();
  await testTaskDetails();
  await testFullLifecycle();
  await testEdgeCases();
  await testBulk();
  await testAgentEndpoints();
  await testIntegerIds();

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  RESULTS: ${passed} passed | ${failed} failed | ${skipped} skipped | ${passed + failed + skipped} total`);
  console.log(`${"═".repeat(60)}\n`);

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("\n💥 Test runner crashed:", err.message);
  console.error(err.stack);
  process.exit(1);
});