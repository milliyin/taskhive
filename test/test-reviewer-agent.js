/**
 * TaskHive — Reviewer Agent & Auto-Review Test Suite
 *
 * Tests all new endpoints and flows introduced by the Reviewer Agent feature:
 *   - Task creation with auto-review fields
 *   - Task detail exposes auto-review fields
 *   - GET /api/v1/tasks/:id/review-config  (decrypted LLM keys)
 *   - POST /api/v1/tasks/:id/reviews       (store AI verdict)
 *   - POST /api/agents/:id/llm-settings    (session-based)
 *   - DELETE /api/agents/:id/llm-settings   (session-based)
 *   - deliverable.submitted webhook fires
 *   - Full auto-review lifecycle
 *
 * Usage:
 *   node test-reviewer-agent.js
 *
 * Prerequisites:
 *   - Dev server or production running
 *   - Paste your API key and poster cookie below
 */

const BASE_URL = process.env.TASKHIVE_URL || "https://taskhive-six.vercel.app";

// ══════════════════════════════════════════════════════════════════════
// PASTE YOUR VALUES HERE
// ══════════════════════════════════════════════════════════════════════
const API_KEY = process.env.TASKHIVE_API_KEY || "th_agent_509d2ce7ca2547516ebd375e916893da556e29f0ffd77eabf8c9dd61849d4584";
const POSTER_COOKIE = process.env.TASKHIVE_POSTER_COOKIE || "sb-wkqrkknmimhzcozlaozo-auth-token=base64-eyJhY2Nlc3NfdG9rZW4iOiJleUpoYkdjaU9pSkZVekkxTmlJc0ltdHBaQ0k2SWpJMU5qVmtaVGxrTFRWa01qY3ROR0V4TWkxaFlURmpMV0UwWlRJM1pEWXlNbVEwTXlJc0luUjVjQ0k2SWtwWFZDSjkuZXlKcGMzTWlPaUpvZEhSd2N6b3ZMM2RyY1hKcmEyNXRhVzFvZW1OdmVteGhiM3B2TG5OMWNHRmlZWE5sTG1OdkwyRjFkR2d2ZGpFaUxDSnpkV0lpT2lJNFlqazBNRGc1WVMwek5ETXdMVFJtTXpRdFlUTXhZeTAzWkdRNFpXSm1OVFJpWWpFaUxDSmhkV1FpT2lKaGRYUm9aVzUwYVdOaGRHVmtJaXdpWlhod0lqb3hOemN4TlRrek9UVTBMQ0pwWVhRaU9qRTNOekUxT1RBek5UUXNJbVZ0WVdsc0lqb2liR1Z6WVdwaE1UYzBOa0JoYkdsaWRHOHVZMjl0SWl3aWNHaHZibVVpT2lJaUxDSmhjSEJmYldWMFlXUmhkR0VpT25zaWNISnZkbWxrWlhJaU9pSmxiV0ZwYkNJc0luQnliM1pwWkdWeWN5STZXeUpsYldGcGJDSmRmU3dpZFhObGNsOXRaWFJoWkdGMFlTSTZleUpsYldGcGJDSTZJbXhsYzJGcVlURTNORFpBWVd4cFluUnZMbU52YlNJc0ltVnRZV2xzWDNabGNtbG1hV1ZrSWpwMGNuVmxMQ0p1WVcxbElqb2liR1Z6WVdwaE1UYzBOa0JoYkdsaWRHOHVZMjl0SWl3aWNHaHZibVZmZG1WeWFXWnBaV1FpT21aaGJITmxMQ0p6ZFdJaU9pSTRZamswTURnNVlTMHpORE13TFRSbU16UXRZVE14WXkwM1pHUTRaV0ptTlRSaVlqRWlmU3dpY205c1pTSTZJbUYxZEdobGJuUnBZMkYwWldRaUxDSmhZV3dpT2lKaFlXd3hJaXdpWVcxeUlqcGJleUp0WlhSb2IyUWlPaUp3WVhOemQyOXlaQ0lzSW5ScGJXVnpkR0Z0Y0NJNk1UYzNNVFU1TURNMU5IMWRMQ0p6WlhOemFXOXVYMmxrSWpvaU5qUmhOMlkyWXpBdE1URXlaUzAwTkRWaExUaGtNbUl0TUdFd09XWXlNbVk1TmpWbElpd2lhWE5mWVc1dmJubHRiM1Z6SWpwbVlXeHpaWDAuRDRkMm9HT3Z6VzFKTzI5UGFET29TMFlCY0swVFpUTEFqd1NndVlUNDNlMGVubEZtTTA2ME1BYU82ZnlxRE5yWlZCMS1NUHpNQUE1ckNPRzRFTDBxM1EiLCJ0b2tlbl90eXBlIjoiYmVhcmVyIiwiZXhwaXJlc19pbiI6MzYwMCwiZXhwaXJlc19hdCI6MTc3MTU5Mzk1NCwicmVmcmVzaF90b2tlbiI6IndsaGs3cWxieDJ5MiIsInVzZXIiOnsiaWQiOiI4Yjk0MDg5YS0zNDMwLTRmMzQtYTMxYy03ZGQ4ZWJmNTRiYjEiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJlbWFpbCI6Imxlc2FqYTE3NDZAYWxpYnRvLmNvbSIsImVtYWlsX2NvbmZpcm1lZF9hdCI6IjIwMjYtMDItMTlUMTk6MzQ6MzEuNjI2MjQzWiIsInBob25lIjoiIiwiY29uZmlybWF0aW9uX3NlbnRfYXQiOiIyMDI2LTAyLTE5VDE5OjM0OjEyLjIwNjkyWiIsImNvbmZpcm1lZF9hdCI6IjIwMjYtMDItMTlUMTk6MzQ6MzEuNjI2MjQzWiIsImxhc3Rfc2lnbl9pbl9hdCI6IjIwMjYtMDItMjBUMTI6MjU6NTQuNTk1OTUyMDI0WiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoibGVzYWphMTc0NkBhbGlidG8uY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsIm5hbWUiOiJsZXNhamExNzQ2QGFsaWJ0by5jb20iLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInN1YiI6IjhiOTQwODlhLTM0MzAtNGYzNC1hMzFjLTdkZDhlYmY1NGJiMSJ9LCJpZGVudGl0aWVzIjpbeyJpZGVudGl0eV9pZCI6IjMyYWI2Yzg1LWM2MmMtNDA0Zi04ZTUxLTI4YjU5NzdjMjA3OCIsImlkIjoiOGI5NDA4OWEtMzQzMC00ZjM0LWEzMWMtN2RkOGViZjU0YmIxIiwidXNlcl9pZCI6IjhiOTQwODlhLTM0MzAtNGYzNC1hMzFjLTdkZDhlYmY1NGJiMSIsImlkZW50aXR5X2RhdGEiOnsiZW1haWwiOiJsZXNhamExNzQ2QGFsaWJ0by5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibmFtZSI6Imxlc2FqYTE3NDZAYWxpYnRvLmNvbSIsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwic3ViIjoiOGI5NDA4OWEtMzQzMC00ZjM0LWEzMWMtN2RkOGViZjU0YmIxIn0sInByb3ZpZGVyIjoiZW1haWwiLCJsYXN0X3NpZ25faW5fYXQiOiIyMDI2LTAyLTE5VDE5OjM0OjEyLjE3MjQ1NVoiLCJjcmVhdGVkX2F0IjoiMjAyNi0wMi0xOVQxOTozNDoxMi4xNzI1MTJaIiwidXBkYXRlZF9hdCI6IjIwMjYtMDItMTlUMTk6MzQ6MTIuMTcyNTEyWiIsImVtYWlsIjoibGVzYWphMTc0NkBhbGlidG8uY29tIn1dLCJjcmVhdGVkX2F0IjoiMjAyNi0wMi0xOVQxOTozNDoxMi4xNDU1OTFaIiwidXBkYXRlZF9hdCI6IjIwMjYtMDItMjBUMTI6MjU6NTQuNjIyMDIzWiIsImlzX2Fub255bW91cyI6ZmFsc2V9LCJ3ZWFrX3Bhc3N3b3JkIjpudWxsfQ";

// ──────────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
let skipped = 0;

function section(name) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${name}`);
  console.log(`${"═".repeat(60)}`);
}

function subsection(name) {
  console.log(`\n  --- ${name} ---`);
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

async function agentReq(method, path, body = null) {
  const opts = {
    method,
    redirect: "manual",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
  };
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

async function createTask(overrides = {}) {
  const defaults = {
    title: "Reviewer Test — " + Date.now(),
    description: "This is a test task for the reviewer agent test suite, verifying auto-review features work end to end.",
    budgetCredits: 200,
    categoryId: 1,
    maxRevisions: 2,
  };
  const res = await posterReq("POST", "/api/tasks", { ...defaults, ...overrides });
  if (res.status !== 201) {
    console.log(`  ⚠️  Task creation failed (${res.status}): ${JSON.stringify(res.data).substring(0, 120)}`);
  }
  return res.status === 201 ? res.data : null;
}

async function checkPosterSession() {
  // Quick check if poster cookie is still valid
  const res = await posterReq("GET", "/api/agents");
  if (res.status === 401 || res.status === 303) {
    console.log("\n  ❌ Poster session cookie has EXPIRED!");
    console.log("     1. Open your app in browser and log in");
    console.log("     2. DevTools (F12) → Application → Cookies");
    console.log("     3. Copy the sb-* cookie value");
    console.log("     4. Paste into POSTER_COOKIE in this file\n");
    return false;
  }
  return true;
}

// ══════════════════════════════════════════════════════════════════════
// 1. CREATE TASK WITH AUTO-REVIEW FIELDS
// ══════════════════════════════════════════════════════════════════════

async function testCreateTaskAutoReview() {
  section("1. Create Task with Auto-Review Fields");

  if (!hasPoster()) { skip("Create task auto-review", "POSTER_COOKIE not set"); return null; }

  const sessionOk = await checkPosterSession();
  if (!sessionOk) { skip("Create task auto-review", "Session expired"); return null; }

  // ─── 1a. Task WITHOUT auto-review (defaults) ──────────────────────
  subsection("1a. Task without auto-review (defaults)");

  const t1 = await createTask({ title: "No auto-review — " + Date.now() });
  if (!t1) { skip("Remaining tests", "Task creation failed (check cookie)"); return null; }
  assert(t1 != null, "Task created without auto-review");
  assert(t1?.autoReviewEnabled === false, "autoReviewEnabled defaults to false", `got ${t1?.autoReviewEnabled}`);
  assert(t1?.posterLlmProvider == null, "posterLlmProvider is null by default");
  assert(t1?.posterMaxReviews == null, "posterMaxReviews is null by default");
  assert(t1?.posterReviewsUsed === 0, "posterReviewsUsed defaults to 0", `got ${t1?.posterReviewsUsed}`);
  // Key should NEVER be in the response
  assert(t1?.posterLlmKeyEncrypted === undefined || t1?.posterLlmKeyEncrypted == null,
    "Encrypted key not exposed in create response (or null)");

  // ─── 1b. Task WITH auto-review ────────────────────────────────────
  subsection("1b. Task with auto-review enabled");

  const t2 = await createTask({
    title: "Auto-review enabled — " + Date.now(),
    autoReviewEnabled: true,
    posterLlmProvider: "openrouter",
    posterLlmKey: "sk-or-test-fake-key-12345",
    posterMaxReviews: 5,
  });
  assert(t2 != null, "Task created with auto-review");
  assert(t2?.autoReviewEnabled === true, "autoReviewEnabled is true", `got ${t2?.autoReviewEnabled}`);
  assert(t2?.posterLlmProvider === "openrouter", "posterLlmProvider saved", `got ${t2?.posterLlmProvider}`);
  assert(t2?.posterMaxReviews === 5, "posterMaxReviews saved", `got ${t2?.posterMaxReviews}`);
  assert(t2?.posterReviewsUsed === 0, "posterReviewsUsed starts at 0", `got ${t2?.posterReviewsUsed}`);

  // ─── 1c. Task with auto-review but no LLM key ─────────────────────
  subsection("1c. Auto-review without LLM key (rely on freelancer key)");

  const t3 = await createTask({
    title: "Auto-review no key — " + Date.now(),
    autoReviewEnabled: true,
  });
  assert(t3 != null, "Task created with auto-review, no key");
  assert(t3?.autoReviewEnabled === true, "autoReviewEnabled is true");
  assert(t3?.posterLlmProvider == null, "No provider set", `got ${t3?.posterLlmProvider}`);

  return { withReview: t2, withoutReview: t1, noKey: t3 };
}

// ══════════════════════════════════════════════════════════════════════
// 2. TASK DETAIL EXPOSES AUTO-REVIEW FIELDS
// ══════════════════════════════════════════════════════════════════════

async function testTaskDetailAutoReview(tasks) {
  section("2. GET /api/v1/tasks/:id — Auto-Review Fields");

  if (!tasks || !tasks.withReview || !tasks.withoutReview) {
    skip("Task detail auto-review", "No tasks from previous step"); return;
  }

  // ─── 2a. Task with auto-review ────────────────────────────────────
  subsection("2a. Task with auto-review enabled");

  const r1 = await agentReq("GET", `/api/v1/tasks/${tasks.withReview.id}`);
  assert(r1.status === 200, "Get auto-review task → 200");
  const d1 = r1.data?.data;
  assert(d1?.auto_review_enabled === true, "auto_review_enabled is true", `got ${d1?.auto_review_enabled}`);
  assert(d1?.poster_llm_provider === "openrouter", "poster_llm_provider = openrouter", `got ${d1?.poster_llm_provider}`);
  assert(d1?.poster_max_reviews === 5, "poster_max_reviews = 5", `got ${d1?.poster_max_reviews}`);
  assert(d1?.poster_reviews_used === 0, "poster_reviews_used = 0", `got ${d1?.poster_reviews_used}`);
  // Encrypted key must NEVER appear in task detail
  assert(d1?.poster_llm_key === undefined, "Encrypted key NOT exposed in detail");
  assert(d1?.poster_llm_key_encrypted === undefined, "poster_llm_key_encrypted NOT exposed");

  // ─── 2b. Task without auto-review ─────────────────────────────────
  subsection("2b. Task without auto-review");

  const r2 = await agentReq("GET", `/api/v1/tasks/${tasks.withoutReview.id}`);
  assert(r2.status === 200, "Get normal task → 200");
  const d2 = r2.data?.data;
  assert(d2?.auto_review_enabled === false, "auto_review_enabled is false", `got ${d2?.auto_review_enabled}`);
  assert(d2?.poster_llm_provider == null, "poster_llm_provider is null");
  assert(d2?.poster_max_reviews == null, "poster_max_reviews is null");
  assert(d2?.poster_reviews_used === 0, "poster_reviews_used is 0");
}

// ══════════════════════════════════════════════════════════════════════
// 3. GET /api/v1/tasks/:id/review-config — DECRYPTED LLM KEYS
// ══════════════════════════════════════════════════════════════════════

async function testReviewConfig(tasks) {
  section("3. GET /api/v1/tasks/:id/review-config — Decrypted LLM Keys");

  if (!tasks || !tasks.withReview) { skip("Review config", "No tasks from previous step"); return; }

  const taskId = tasks.withReview.id;

  // ─── 3a. Unauthorized access (agent not involved in task) ─────────
  subsection("3a. Access control");

  // The test agent may or may not be the poster's agent. If the task is not claimed
  // by this agent and the agent is not the poster's, it should be 403.
  const r1 = await agentReq("GET", `/api/v1/tasks/${taskId}/review-config`);
  // We can't predict the exact result — depends on whether the test agent's operator
  // is the same user as the poster. So test both valid cases:
  if (r1.status === 200) {
    assert(true, "Agent is poster's agent or claimed agent → 200");
    const d = r1.data?.data;
    assert(d?.auto_review_enabled === true, "auto_review_enabled present");
    assert(d?.poster_llm_key != null, "poster_llm_key decrypted (not null)", `got ${d?.poster_llm_key}`);
    assert(d?.poster_llm_key === "sk-or-test-fake-key-12345", "Decrypted key matches original", `got ${d?.poster_llm_key}`);
    assert(d?.poster_llm_provider === "openrouter", "poster_llm_provider present");
    assert(d?.poster_max_reviews === 5, "poster_max_reviews present");
    assert(d?.poster_reviews_used === 0, "poster_reviews_used present");
    assert(d?.freelancer_llm_key === null || d?.freelancer_llm_key === undefined, "No freelancer key yet");
  } else if (r1.status === 403) {
    assert(true, "Agent is not involved → 403 (expected if different operator)");
    assert(r1.data?.error?.code === "FORBIDDEN", "Code: FORBIDDEN");
  } else {
    assert(false, "Unexpected status", `got ${r1.status}`);
  }

  // ─── 3b. Non-existent task ────────────────────────────────────────
  subsection("3b. Non-existent task");

  const r2 = await agentReq("GET", "/api/v1/tasks/999999/review-config");
  assert(r2.status === 404, "Non-existent task → 404", `got ${r2.status}`);
  assert(r2.data?.error?.code === "TASK_NOT_FOUND", "Code: TASK_NOT_FOUND");

  // ─── 3c. No auth ──────────────────────────────────────────────────
  subsection("3c. No authentication");

  const opts = {
    method: "GET",
    redirect: "manual",
    headers: { "Content-Type": "application/json" },
  };
  const res = await fetch(`${BASE_URL}/api/v1/tasks/${taskId}/review-config`, opts);
  assert(res.status === 401, "No auth → 401", `got ${res.status}`);
}

// ══════════════════════════════════════════════════════════════════════
// 4. POST /api/v1/tasks/:id/reviews — STORE AI VERDICT
// ══════════════════════════════════════════════════════════════════════

async function testReviews(tasks) {
  section("4. POST /api/v1/tasks/:id/reviews — Store AI Verdict");

  if (!tasks || !tasks.withReview) { skip("Reviews", "No tasks from previous step"); return; }

  const taskId = tasks.withReview.id;

  // ─── 4a. Valid review (PASS) ──────────────────────────────────────
  subsection("4a. Valid review — PASS verdict");

  const r1 = await agentReq("POST", `/api/v1/tasks/${taskId}/reviews`, {
    verdict: "pass",
    feedback: "All requirements met. Code is clean and well-structured.",
    scores: { requirements: 9, quality: 8, completeness: 10 },
    key_source: "poster",
    llm_model_used: "anthropic/claude-sonnet-4-20250514",
    reviewed_at: new Date().toISOString(),
  });
  assert(r1.status === 201, "Post review → 201", `got ${r1.status}`);
  assert(r1.data?.data?.verdict === "pass", "verdict = pass", `got ${r1.data?.data?.verdict}`);
  assert(r1.data?.data?.feedback != null, "feedback included");
  assert(r1.data?.data?.scores != null, "scores included");
  assert(r1.data?.data?.key_source === "poster", "key_source = poster");
  assert(r1.data?.data?.llm_model_used != null, "llm_model_used included");
  assert(r1.data?.data?.reviewed_at != null, "reviewed_at included");
  assert(r1.data?.data?.task_id === taskId, "task_id matches", `got ${r1.data?.data?.task_id}`);

  // poster_reviews_used should increment
  assert(r1.data?.data?.poster_reviews_used === 1, "poster_reviews_used incremented to 1", `got ${r1.data?.data?.poster_reviews_used}`);

  // ─── 4b. Valid review (FAIL) ──────────────────────────────────────
  subsection("4b. Valid review — FAIL verdict");

  const r2 = await agentReq("POST", `/api/v1/tasks/${taskId}/reviews`, {
    verdict: "fail",
    feedback: "Missing error handling for timeout scenarios.",
    scores: { requirements: 5, quality: 6, completeness: 4 },
    key_source: "poster",
  });
  assert(r2.status === 201, "FAIL review → 201", `got ${r2.status}`);
  assert(r2.data?.data?.verdict === "fail", "verdict = fail");
  assert(r2.data?.data?.poster_reviews_used === 2, "poster_reviews_used incremented to 2", `got ${r2.data?.data?.poster_reviews_used}`);

  // ─── 4c. Review with freelancer key source ─────────────────────────
  subsection("4c. Review with freelancer key source (no poster increment)");

  const r3 = await agentReq("POST", `/api/v1/tasks/${taskId}/reviews`, {
    verdict: "pass",
    feedback: "Looks good.",
    key_source: "freelancer",
  });
  assert(r3.status === 201, "Freelancer-keyed review → 201", `got ${r3.status}`);
  // poster_reviews_used should NOT increment for freelancer key
  assert(r3.data?.data?.poster_reviews_used === 2, "poster_reviews_used stays 2 (freelancer key)", `got ${r3.data?.data?.poster_reviews_used}`);

  // ─── 4d. Review with skipped verdict ──────────────────────────────
  subsection("4d. Skipped verdict (no key available)");

  const r4 = await agentReq("POST", `/api/v1/tasks/${taskId}/reviews`, {
    verdict: "skipped",
    feedback: "No API key available for auto-review.",
    key_source: "none",
  });
  assert(r4.status === 201, "Skipped review → 201", `got ${r4.status}`);
  assert(r4.data?.data?.verdict === "skipped", "verdict = skipped");

  // ─── 4e. Validation errors ─────────────────────────────────────────
  subsection("4e. Validation errors");

  // Missing verdict
  const r5 = await agentReq("POST", `/api/v1/tasks/${taskId}/reviews`, {
    feedback: "No verdict provided",
  });
  assert(r5.status === 422, "Missing verdict → 422", `got ${r5.status}`);
  assert(r5.data?.error?.code === "VALIDATION_ERROR", "Code: VALIDATION_ERROR");

  // Invalid verdict
  const r6 = await agentReq("POST", `/api/v1/tasks/${taskId}/reviews`, {
    verdict: "maybe",
  });
  assert(r6.status === 422, "Invalid verdict 'maybe' → 422", `got ${r6.status}`);

  // Non-existent task
  const r7 = await agentReq("POST", "/api/v1/tasks/999999/reviews", {
    verdict: "pass",
  });
  assert(r7.status === 404, "Non-existent task → 404", `got ${r7.status}`);

  // No auth
  const noAuth = await fetch(`${BASE_URL}/api/v1/tasks/${taskId}/reviews`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ verdict: "pass" }),
  });
  assert(noAuth.status === 401, "No auth → 401", `got ${noAuth.status}`);

  // ─── 4f. Verify counter via task detail ────────────────────────────
  subsection("4f. Verify poster_reviews_used via task detail");

  const detail = await agentReq("GET", `/api/v1/tasks/${taskId}`);
  assert(detail.data?.data?.poster_reviews_used === 2, "Task detail shows poster_reviews_used = 2", `got ${detail.data?.data?.poster_reviews_used}`);
}

// ══════════════════════════════════════════════════════════════════════
// 5. LLM SETTINGS — POST/DELETE /api/agents/:id/llm-settings
// ══════════════════════════════════════════════════════════════════════

async function testLlmSettings() {
  section("5. POST/DELETE /api/agents/:id/llm-settings — Freelancer LLM Key");

  if (!hasPoster()) { skip("LLM settings", "POSTER_COOKIE not set"); return; }

  // The LLM settings endpoint uses session auth (poster cookie), not API key auth.
  // We need an agent that belongs to the poster (cookie user).
  // Try creating a test agent, or reuse one if already created.
  let agentId = null;

  const createRes = await posterReq("POST", "/api/agents", {
    name: "LLM Test Agent — " + Date.now(),
    description: "Temporary agent for testing LLM settings",
    capabilities: ["testing"],
  });

  if (createRes.status === 201 && createRes.data?.id) {
    agentId = createRes.data.id;
    console.log(`  📌 Created test agent ID: ${agentId}`);
  } else {
    // Maybe the user already has an agent — try the API key agent and verify ownership
    const me = await agentReq("GET", "/api/v1/agents/me");
    const candidateId = me.data?.data?.id;
    if (candidateId) {
      // Quick ownership check — if poster can delete llm settings, they own it
      const probe = await posterReq("DELETE", `/api/agents/${candidateId}/llm-settings`);
      if (probe.status === 200) {
        agentId = candidateId;
      }
    }
  }

  if (!agentId) { skip("LLM settings", "Could not find or create agent owned by poster"); return; }

  console.log(`  📌 Agent ID: ${agentId}`);

  // ─── 5a. Set LLM settings ─────────────────────────────────────────
  subsection("5a. Set LLM settings");

  const r1 = await posterReq("POST", `/api/agents/${agentId}/llm-settings`, {
    freelancerLlmProvider: "openrouter",
    freelancerLlmKey: "sk-or-test-freelancer-key-67890",
  });
  assert(r1.status === 200, "Set LLM settings → 200", `got ${r1.status}`);
  assert(r1.data?.ok === true, "Response ok: true");

  // ─── 5b. Set with different provider ──────────────────────────────
  subsection("5b. Update to different provider");

  const r2 = await posterReq("POST", `/api/agents/${agentId}/llm-settings`, {
    freelancerLlmProvider: "anthropic",
    freelancerLlmKey: "sk-ant-test-key-abcdef",
  });
  assert(r2.status === 200, "Update LLM settings → 200", `got ${r2.status}`);

  // ─── 5c. Validation errors ─────────────────────────────────────────
  subsection("5c. Validation errors");

  // Missing provider
  const r3 = await posterReq("POST", `/api/agents/${agentId}/llm-settings`, {
    freelancerLlmKey: "sk-some-key",
  });
  assert(r3.status === 400, "Missing provider → 400", `got ${r3.status}`);

  // Missing key
  const r4 = await posterReq("POST", `/api/agents/${agentId}/llm-settings`, {
    freelancerLlmProvider: "openrouter",
  });
  assert(r4.status === 400, "Missing key → 400", `got ${r4.status}`);

  // Invalid provider
  const r5 = await posterReq("POST", `/api/agents/${agentId}/llm-settings`, {
    freelancerLlmProvider: "invalid_provider",
    freelancerLlmKey: "sk-some-key",
  });
  assert(r5.status === 400, "Invalid provider → 400", `got ${r5.status}`);

  // Empty body
  const r6 = await posterReq("POST", `/api/agents/${agentId}/llm-settings`, {});
  assert(r6.status === 400, "Empty body → 400", `got ${r6.status}`);

  // ─── 5d. Unauthorized (no session cookie) ─────────────────────────
  subsection("5d. Unauthorized access");

  const noAuth = await fetch(`${BASE_URL}/api/agents/${agentId}/llm-settings`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ freelancerLlmProvider: "openrouter", freelancerLlmKey: "sk-test" }),
  });
  assert(noAuth.status === 401, "No session → 401", `got ${noAuth.status}`);

  // ─── 5e. Wrong agent (not owned by poster) ─────────────────────────
  subsection("5e. Wrong agent ID");

  const r7 = await posterReq("POST", "/api/agents/999999/llm-settings", {
    freelancerLlmProvider: "openrouter",
    freelancerLlmKey: "sk-some-key",
  });
  assert(r7.status === 404, "Wrong agent ID → 404", `got ${r7.status}`);

  // ─── 5f. Delete LLM settings ──────────────────────────────────────
  subsection("5f. Delete LLM settings");

  const r8 = await posterReq("DELETE", `/api/agents/${agentId}/llm-settings`);
  assert(r8.status === 200, "Delete LLM settings → 200", `got ${r8.status}`);
  assert(r8.data?.ok === true, "Response ok: true");

  // ─── 5g. Delete again (idempotent) ────────────────────────────────
  subsection("5g. Delete again (idempotent)");

  const r9 = await posterReq("DELETE", `/api/agents/${agentId}/llm-settings`);
  assert(r9.status === 200, "Delete again → 200 (idempotent)", `got ${r9.status}`);

  return agentId;
}

// ══════════════════════════════════════════════════════════════════════
// 6. FULL AUTO-REVIEW LIFECYCLE
// ══════════════════════════════════════════════════════════════════════

async function testAutoReviewLifecycle() {
  section("6. Full Auto-Review Lifecycle");

  if (!hasPoster()) { skip("Auto-review lifecycle", "POSTER_COOKIE not set"); return; }

  // ─── 6a. Create auto-review task ──────────────────────────────────
  subsection("6a. Create task with auto-review");

  const task = await createTask({
    title: "Auto-Review Lifecycle — " + Date.now(),
    budgetCredits: 150,
    maxRevisions: 2,
    autoReviewEnabled: true,
    posterLlmProvider: "openrouter",
    posterLlmKey: "sk-or-lifecycle-test-key",
    posterMaxReviews: 3,
  });

  if (!task) { skip("Auto-review lifecycle", "Could not create task"); return; }
  console.log(`  📌 Task #${task.id} created with auto-review`);

  // Verify via agent API
  const detail = await agentReq("GET", `/api/v1/tasks/${task.id}`);
  assert(detail.data?.data?.auto_review_enabled === true, "Detail confirms auto_review_enabled");

  // ─── 6b. Claim the task ───────────────────────────────────────────
  subsection("6b. Agent claims the task");

  const claim = await agentReq("POST", `/api/v1/tasks/${task.id}/claims`, {
    proposed_credits: 120,
    message: "I can do this with auto-review in mind.",
  });
  assert(claim.status === 201, "Claim → 201", `got ${claim.status}`);
  const claimId = claim.data?.data?.id;

  // Poster accepts claim
  const accept = await posterReq("PATCH", `/api/tasks/${task.id}/claims/${claimId}`, { action: "accept" });
  assert(accept.status === 200, "Poster accepts claim → 200", `got ${accept.status}`);

  // ─── 6c. Check review-config now that task is claimed ─────────────
  subsection("6c. Review config with claimed agent");

  const config = await agentReq("GET", `/api/v1/tasks/${task.id}/review-config`);
  if (config.status === 200) {
    assert(true, "Review config accessible → 200");
    assert(config.data?.data?.auto_review_enabled === true, "Config: auto_review_enabled");
    assert(config.data?.data?.poster_llm_key === "sk-or-lifecycle-test-key", "Config: poster key decrypted");
    assert(config.data?.data?.poster_llm_provider === "openrouter", "Config: poster provider");
    assert(config.data?.data?.poster_max_reviews === 3, "Config: max reviews = 3");
  } else {
    assert(config.status === 403, "Agent not involved → 403 (may be different operator)", `got ${config.status}`);
  }

  // ─── 6d. Submit deliverable ───────────────────────────────────────
  subsection("6d. Submit deliverable");

  const del = await agentReq("POST", `/api/v1/tasks/${task.id}/deliverables`, {
    content: "## Auto-Review Test Deliverable\n\nHere is my implementation with full test coverage and error handling.",
  });
  assert(del.status === 201, "Submit deliverable → 201", `got ${del.status}`);
  assert(del.data?.data?.revision_number === 1, "Revision #1");
  const deliverableId = del.data?.data?.id;

  // ─── 6e. Simulate AI review (FAIL) ────────────────────────────────
  subsection("6e. AI reviewer posts FAIL verdict");

  const failReview = await agentReq("POST", `/api/v1/tasks/${task.id}/reviews`, {
    verdict: "fail",
    feedback: "Missing error handling for network timeouts. Add retry logic with exponential backoff.",
    scores: { requirements: 6, quality: 7, completeness: 4 },
    key_source: "poster",
    llm_model_used: "anthropic/claude-sonnet-4-20250514",
  });
  assert(failReview.status === 201, "FAIL review → 201", `got ${failReview.status}`);
  assert(failReview.data?.data?.poster_reviews_used === 1, "poster_reviews_used = 1");

  // ─── 6f. Poster requests revision (based on AI feedback) ──────────
  subsection("6f. Poster requests revision");

  const revision = await posterReq("PATCH", `/api/tasks/${task.id}/deliverables/${deliverableId}`, {
    action: "revision",
    revisionNotes: "AI review found missing error handling. Please add retry logic.",
  });
  assert(revision.status === 200, "Poster requests revision → 200", `got ${revision.status}`);

  // ─── 6g. Agent resubmits ──────────────────────────────────────────
  subsection("6g. Agent resubmits improved work");

  const del2 = await agentReq("POST", `/api/v1/tasks/${task.id}/deliverables`, {
    content: "## Revised Deliverable\n\nAdded retry logic with exponential backoff and comprehensive timeout handling.",
  });
  assert(del2.status === 201, "Resubmit → 201", `got ${del2.status}`);
  assert(del2.data?.data?.revision_number === 2, "Revision #2", `got ${del2.data?.data?.revision_number}`);
  const deliverableId2 = del2.data?.data?.id;

  // ─── 6h. AI review PASS ───────────────────────────────────────────
  subsection("6h. AI reviewer posts PASS verdict");

  const passReview = await agentReq("POST", `/api/v1/tasks/${task.id}/reviews`, {
    verdict: "pass",
    feedback: "All requirements met. Error handling is comprehensive.",
    scores: { requirements: 9, quality: 9, completeness: 10 },
    key_source: "poster",
    llm_model_used: "anthropic/claude-sonnet-4-20250514",
  });
  assert(passReview.status === 201, "PASS review → 201", `got ${passReview.status}`);
  assert(passReview.data?.data?.poster_reviews_used === 2, "poster_reviews_used = 2");

  // ─── 6i. Poster accepts (auto-complete flow) ─────────────────────
  subsection("6i. Poster accepts deliverable");

  const acceptDel = await posterReq("PATCH", `/api/tasks/${task.id}/deliverables/${deliverableId2}`, {
    action: "accept",
  });
  assert(acceptDel.status === 200, "Poster accepts → 200", `got ${acceptDel.status}`);

  // ─── 6j. Verify final state ───────────────────────────────────────
  subsection("6j. Verify final state");

  const finalDetail = await agentReq("GET", `/api/v1/tasks/${task.id}`);
  assert(finalDetail.data?.data?.status === "completed", "Task completed", `got ${finalDetail.data?.data?.status}`);
  assert(finalDetail.data?.data?.poster_reviews_used === 2, "Final poster_reviews_used = 2", `got ${finalDetail.data?.data?.poster_reviews_used}`);
}

// ══════════════════════════════════════════════════════════════════════
// 7. POSTER MAX REVIEWS LIMIT
// ══════════════════════════════════════════════════════════════════════

async function testMaxReviewsLimit() {
  section("7. Poster Max Reviews Limit Tracking");

  if (!hasPoster()) { skip("Max reviews limit", "POSTER_COOKIE not set"); return; }

  const task = await createTask({
    title: "Max Reviews Limit — " + Date.now(),
    budgetCredits: 100,
    autoReviewEnabled: true,
    posterLlmProvider: "openai",
    posterLlmKey: "sk-test-max-reviews-key",
    posterMaxReviews: 2,
  });

  if (!task) { skip("Max reviews limit", "Could not create task"); return; }

  // Post 2 reviews with poster key source
  const r1 = await agentReq("POST", `/api/v1/tasks/${task.id}/reviews`, {
    verdict: "fail",
    key_source: "poster",
  });
  assert(r1.data?.data?.poster_reviews_used === 1, "After 1st review: used = 1", `got ${r1.data?.data?.poster_reviews_used}`);

  const r2 = await agentReq("POST", `/api/v1/tasks/${task.id}/reviews`, {
    verdict: "pass",
    key_source: "poster",
  });
  assert(r2.data?.data?.poster_reviews_used === 2, "After 2nd review: used = 2", `got ${r2.data?.data?.poster_reviews_used}`);

  // Verify via task detail that the counter matches max
  const detail = await agentReq("GET", `/api/v1/tasks/${task.id}`);
  assert(detail.data?.data?.poster_reviews_used === 2, "Detail: used = 2 (matches max)");
  assert(detail.data?.data?.poster_max_reviews === 2, "Detail: max = 2");

  // Post a 3rd review with freelancer key (should NOT increment poster counter)
  const r3 = await agentReq("POST", `/api/v1/tasks/${task.id}/reviews`, {
    verdict: "pass",
    key_source: "freelancer",
  });
  assert(r3.data?.data?.poster_reviews_used === 2, "Freelancer key: used stays 2", `got ${r3.data?.data?.poster_reviews_used}`);
}

// ══════════════════════════════════════════════════════════════════════
// 8. EXISTING ENDPOINTS STILL WORK (REGRESSION)
// ══════════════════════════════════════════════════════════════════════

async function testRegression() {
  section("8. Regression — Existing Endpoints Unaffected");

  // Browse tasks still works
  const r1 = await agentReq("GET", "/api/v1/tasks?limit=3");
  assert(r1.status === 200, "Browse tasks → 200");
  assert(Array.isArray(r1.data?.data), "Returns array");

  // Task shape still has all original fields
  if (r1.data?.data?.length > 0) {
    const t = r1.data.data[0];
    assert(t.id != null, "Has id");
    assert(t.title != null, "Has title");
    assert(t.description != null, "Has description");
    assert(t.budget_credits != null, "Has budget_credits");
    assert(t.status != null, "Has status");
    assert(t.poster != null, "Has poster");
    assert(t.claims_count != null, "Has claims_count");
    assert(t.max_revisions != null, "Has max_revisions");
    assert(t.created_at != null, "Has created_at");
  }

  // Agent profile still works
  const r2 = await agentReq("GET", "/api/v1/agents/me");
  assert(r2.status === 200, "Agent profile → 200");
  assert(r2.data?.data?.id != null, "Has agent id");
  assert(r2.data?.data?.reputation_score != null, "Has reputation_score");

  // Agent credits still works
  const r3 = await agentReq("GET", "/api/v1/agents/me/credits");
  assert(r3.status === 200, "Agent credits → 200");
  assert(typeof r3.data?.data?.credit_balance === "number", "credit_balance is number");

  // Task detail has both old and new fields
  if (r1.data?.data?.length > 0) {
    const taskId = r1.data.data[0].id;
    const r4 = await agentReq("GET", `/api/v1/tasks/${taskId}`);
    assert(r4.status === 200, "Task detail → 200");
    const d = r4.data?.data;
    // Old fields
    assert(d?.claims_count != null, "Detail: claims_count present");
    assert(d?.deliverables_count != null, "Detail: deliverables_count present");
    // New fields
    assert(d?.auto_review_enabled !== undefined, "Detail: auto_review_enabled present");
    assert(d?.poster_reviews_used !== undefined, "Detail: poster_reviews_used present");
  }

  // Authentication still enforced
  const r5 = await fetch(`${BASE_URL}/api/v1/tasks`, { redirect: "manual" });
  assert(r5.status === 401, "No auth still → 401");

  // Error responses still standard
  const r6 = await agentReq("GET", "/api/v1/tasks?sort=invalid");
  assert(r6.status === 400, "Bad sort still → 400");
  assert(r6.data?.ok === false, "Error: ok = false");
  assert(r6.data?.error?.code != null, "Error has code");
  assert(r6.data?.error?.suggestion != null, "Error has suggestion");
}

// ══════════════════════════════════════════════════════════════════════
// RUNNER
// ══════════════════════════════════════════════════════════════════════

async function run() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   TaskHive — Reviewer Agent & Auto-Review Test Suite    ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`\nTarget: ${BASE_URL}`);
  console.log(`API Key: ${API_KEY.substring(0, 20)}...`);
  console.log(`Poster:  ${hasPoster() ? "configured" : "NOT SET (lifecycle tests will skip)"}`);

  if (API_KEY === "PASTE_YOUR_AGENT_API_KEY_HERE") {
    console.log("\n❌ Paste your API key in the API_KEY variable (or set TASKHIVE_API_KEY env var)!\n");
    process.exit(1);
  }

  // Check server is reachable
  try {
    await fetch(BASE_URL, { redirect: "manual" });
  } catch {
    console.log(`\n❌ Cannot reach ${BASE_URL}. Make sure the server is running.\n`);
    process.exit(1);
  }

  // Check poster session upfront
  if (hasPoster()) {
    const sessionOk = await checkPosterSession();
    if (!sessionOk) {
      console.log("  Lifecycle tests will be skipped. Refresh your cookie and retry.\n");
    }
  }

  // Run all test sections
  const tasks = await testCreateTaskAutoReview();
  await testTaskDetailAutoReview(tasks);
  await testReviewConfig(tasks);
  await testReviews(tasks);
  await testLlmSettings();
  await testAutoReviewLifecycle();
  await testMaxReviewsLimit();
  await testRegression();

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
