/**
 * TaskHive API Test Script
 * 
 * Tests all Web UI API endpoints against your running dev server.
 * 
 * Usage:
 *   node test-api.js
 * 
 * Prerequisites:
 *   1. Dev server running (npm run dev)
 *   2. At least one user registered and logged in
 *   3. Update the SESSION_COOKIE below from your browser
 * 
 * How to get your session cookie:
 *   1. Open your app in browser, log in
 *   2. Open DevTools → Application → Cookies
 *   3. Copy the value of the cookie starting with "sb-" (the full name and value)
 */

const BASE_URL = "http://localhost:3000";

// ══════════════════════════════════════════════════════════════════════
// PASTE YOUR SESSION COOKIE HERE
// 
// How to get it:
//   1. Open http://localhost:3000 in browser, log in
//   2. DevTools (F12) → Application tab → Cookies → http://localhost:3000
//   3. Find ALL cookies starting with "sb-" 
//   4. For each one, copy: name=value
//   5. Join them with "; " and paste below
//
// Example:
//   "sb-abcdef-auth-token=eyJhbG....; sb-abcdef-auth-token.0=base64data; sb-abcdef-auth-token.1=moredata"
// ══════════════════════════════════════════════════════════════════════
const SESSION_COOKIE = "sb-wkqrkknmimhzcozlaozo-auth-token=base64-eyJhY2Nlc3NfdG9rZW4iOiJleUpoYkdjaU9pSkZVekkxTmlJc0ltdHBaQ0k2SWpJMU5qVmtaVGxrTFRWa01qY3ROR0V4TWkxaFlURmpMV0UwWlRJM1pEWXlNbVEwTXlJc0luUjVjQ0k2SWtwWFZDSjkuZXlKcGMzTWlPaUpvZEhSd2N6b3ZMM2RyY1hKcmEyNXRhVzFvZW1OdmVteGhiM3B2TG5OMWNHRmlZWE5sTG1OdkwyRjFkR2d2ZGpFaUxDSnpkV0lpT2lJNFlqazBNRGc1WVMwek5ETXdMVFJtTXpRdFlUTXhZeTAzWkdRNFpXSm1OVFJpWWpFaUxDSmhkV1FpT2lKaGRYUm9aVzUwYVdOaGRHVmtJaXdpWlhod0lqb3hOemN4TlRrek9UVTBMQ0pwWVhRaU9qRTNOekUxT1RBek5UUXNJbVZ0WVdsc0lqb2liR1Z6WVdwaE1UYzBOa0JoYkdsaWRHOHVZMjl0SWl3aWNHaHZibVVpT2lJaUxDSmhjSEJmYldWMFlXUmhkR0VpT25zaWNISnZkbWxrWlhJaU9pSmxiV0ZwYkNJc0luQnliM1pwWkdWeWN5STZXeUpsYldGcGJDSmRmU3dpZFhObGNsOXRaWFJoWkdGMFlTSTZleUpsYldGcGJDSTZJbXhsYzJGcVlURTNORFpBWVd4cFluUnZMbU52YlNJc0ltVnRZV2xzWDNabGNtbG1hV1ZrSWpwMGNuVmxMQ0p1WVcxbElqb2liR1Z6WVdwaE1UYzBOa0JoYkdsaWRHOHVZMjl0SWl3aWNHaHZibVZmZG1WeWFXWnBaV1FpT21aaGJITmxMQ0p6ZFdJaU9pSTRZamswTURnNVlTMHpORE13TFRSbU16UXRZVE14WXkwM1pHUTRaV0ptTlRSaVlqRWlmU3dpY205c1pTSTZJbUYxZEdobGJuUnBZMkYwWldRaUxDSmhZV3dpT2lKaFlXd3hJaXdpWVcxeUlqcGJleUp0WlhSb2IyUWlPaUp3WVhOemQyOXlaQ0lzSW5ScGJXVnpkR0Z0Y0NJNk1UYzNNVFU1TURNMU5IMWRMQ0p6WlhOemFXOXVYMmxrSWpvaU5qUmhOMlkyWXpBdE1URXlaUzAwTkRWaExUaGtNbUl0TUdFd09XWXlNbVk1TmpWbElpd2lhWE5mWVc1dmJubHRiM1Z6SWpwbVlXeHpaWDAuRDRkMm9HT3Z6VzFKTzI5UGFET29TMFlCY0swVFpUTEFqd1NndVlUNDNlMGVubEZtTTA2ME1BYU82ZnlxRE5yWlZCMS1NUHpNQUE1ckNPRzRFTDBxM1EiLCJ0b2tlbl90eXBlIjoiYmVhcmVyIiwiZXhwaXJlc19pbiI6MzYwMCwiZXhwaXJlc19hdCI6MTc3MTU5Mzk1NCwicmVmcmVzaF90b2tlbiI6IndsaGs3cWxieDJ5MiIsInVzZXIiOnsiaWQiOiI4Yjk0MDg5YS0zNDMwLTRmMzQtYTMxYy03ZGQ4ZWJmNTRiYjEiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJlbWFpbCI6Imxlc2FqYTE3NDZAYWxpYnRvLmNvbSIsImVtYWlsX2NvbmZpcm1lZF9hdCI6IjIwMjYtMDItMTlUMTk6MzQ6MzEuNjI2MjQzWiIsInBob25lIjoiIiwiY29uZmlybWF0aW9uX3NlbnRfYXQiOiIyMDI2LTAyLTE5VDE5OjM0OjEyLjIwNjkyWiIsImNvbmZpcm1lZF9hdCI6IjIwMjYtMDItMTlUMTk6MzQ6MzEuNjI2MjQzWiIsImxhc3Rfc2lnbl9pbl9hdCI6IjIwMjYtMDItMjBUMTI6MjU6NTQuNTk1OTUyMDI0WiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoibGVzYWphMTc0NkBhbGlidG8uY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsIm5hbWUiOiJsZXNhamExNzQ2QGFsaWJ0by5jb20iLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInN1YiI6IjhiOTQwODlhLTM0MzAtNGYzNC1hMzFjLTdkZDhlYmY1NGJiMSJ9LCJpZGVudGl0aWVzIjpbeyJpZGVudGl0eV9pZCI6IjMyYWI2Yzg1LWM2MmMtNDA0Zi04ZTUxLTI4YjU5NzdjMjA3OCIsImlkIjoiOGI5NDA4OWEtMzQzMC00ZjM0LWEzMWMtN2RkOGViZjU0YmIxIiwidXNlcl9pZCI6IjhiOTQwODlhLTM0MzAtNGYzNC1hMzFjLTdkZDhlYmY1NGJiMSIsImlkZW50aXR5X2RhdGEiOnsiZW1haWwiOiJsZXNhamExNzQ2QGFsaWJ0by5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibmFtZSI6Imxlc2FqYTE3NDZAYWxpYnRvLmNvbSIsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwic3ViIjoiOGI5NDA4OWEtMzQzMC00ZjM0LWEzMWMtN2RkOGViZjU0YmIxIn0sInByb3ZpZGVyIjoiZW1haWwiLCJsYXN0X3NpZ25faW5fYXQiOiIyMDI2LTAyLTE5VDE5OjM0OjEyLjE3MjQ1NVoiLCJjcmVhdGVkX2F0IjoiMjAyNi0wMi0xOVQxOTozNDoxMi4xNzI1MTJaIiwidXBkYXRlZF9hdCI6IjIwMjYtMDItMTlUMTk6MzQ6MTIuMTcyNTEyWiIsImVtYWlsIjoibGVzYWphMTc0NkBhbGlidG8uY29tIn1dLCJjcmVhdGVkX2F0IjoiMjAyNi0wMi0xOVQxOTozNDoxMi4xNDU1OTFaIiwidXBkYXRlZF9hdCI6IjIwMjYtMDItMjBUMTI6MjU6NTQuNjIyMDIzWiIsImlzX2Fub255bW91cyI6ZmFsc2V9LCJ3ZWFrX3Bhc3N3b3JkIjpudWxsfQ";

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let taskId = null;

function log(icon, msg) {
  console.log(`  ${icon} ${msg}`);
}

async function request(method, path, body = null) {
  const opts = {
    method,
    redirect: "manual",
    headers: {
      "Content-Type": "application/json",
      Cookie: SESSION_COOKIE,
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, opts);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

function assert(condition, testName, detail = "") {
  if (condition) {
    passed++;
    log("✅", testName);
  } else {
    failed++;
    log("❌", `${testName} ${detail}`);
  }
}

// ──────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────

async function testCreateTask_Validation() {
  console.log("\n📋 POST /api/tasks — Validation");

  // Missing title
  const r1 = await request("POST", "/api/tasks", {
    description: "This is a valid description with enough characters",
    budgetCredits: 50,
  });
  assert(r1.status === 400, "Rejects missing title", `got ${r1.status}`);

  // Title too short
  const r2 = await request("POST", "/api/tasks", {
    title: "Hi",
    description: "This is a valid description with enough characters",
    budgetCredits: 50,
  });
  assert(r2.status === 400, "Rejects title < 5 chars", `got ${r2.status}`);

  // Description too short
  const r3 = await request("POST", "/api/tasks", {
    title: "Valid title here",
    description: "Too short",
    budgetCredits: 50,
  });
  assert(r3.status === 400, "Rejects description < 20 chars", `got ${r3.status}`);

  // Budget too low
  const r4 = await request("POST", "/api/tasks", {
    title: "Valid title here",
    description: "This is a valid description with enough characters",
    budgetCredits: 5,
  });
  assert(r4.status === 400, "Rejects budget < 10", `got ${r4.status}`);

  // Deadline in the past
  const r5 = await request("POST", "/api/tasks", {
    title: "Valid title here",
    description: "This is a valid description with enough characters",
    budgetCredits: 50,
    deadline: "2020-01-01T00:00:00",
  });
  assert(r5.status === 400, "Rejects past deadline", `got ${r5.status}`);

  // Invalid max revisions
  const r6 = await request("POST", "/api/tasks", {
    title: "Valid title here",
    description: "This is a valid description with enough characters",
    budgetCredits: 50,
    maxRevisions: 10,
  });
  assert(r6.status === 400, "Rejects maxRevisions > 5", `got ${r6.status}`);
}

async function testCreateTask_Success() {
  console.log("\n📋 POST /api/tasks — Success");

  // Minimal task
  const r1 = await request("POST", "/api/tasks", {
    title: "Test task from API script",
    description: "This is a test task created by the automated test script to verify the API works correctly.",
    budgetCredits: 100,
  });
  assert(r1.status === 201, "Creates task with minimal fields", `got ${r1.status}`);
  assert(r1.data.id != null, "Returns task ID", `got ${JSON.stringify(r1.data)}`);
  assert(r1.data.status === "open", "Status is open", `got ${r1.data.status}`);
  assert(r1.data.budgetCredits === 100, "Budget is 100", `got ${r1.data.budgetCredits}`);
  assert(r1.data.maxRevisions === 2, "Default maxRevisions is 2", `got ${r1.data.maxRevisions}`);

  taskId = r1.data.id;

  // Full task with all fields
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const r2 = await request("POST", "/api/tasks", {
    title: "Full test task with all fields",
    description: "This task has every optional field filled in to test the complete creation flow end to end.",
    budgetCredits: 250,
    categoryId: 1,
    deadline: futureDate,
    maxRevisions: 3,
  });
  assert(r2.status === 201, "Creates task with all fields", `got ${r2.status}`);
  assert(r2.data.categoryId === 1, "Category set", `got ${r2.data.categoryId}`);
  assert(r2.data.maxRevisions === 3, "maxRevisions set to 3", `got ${r2.data.maxRevisions}`);
  assert(r2.data.deadline != null, "Deadline set", `got ${r2.data.deadline}`);
}

async function testUnauthorized() {
  console.log("\n🔒 Unauthorized Access");

  const opts = {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Should fail",
      description: "This should not work without auth cookies",
      budgetCredits: 50,
    }),
  };

  const res = await fetch(`${BASE_URL}/api/tasks`, opts);
  assert(res.status === 401, "POST /api/tasks without cookie → 401", `got ${res.status}`);
}

async function testClaimActions() {
  console.log("\n🤝 PATCH /api/tasks/[id]/claims/[id] — Claim Actions");

  if (!taskId) {
    log("⏭️", "Skipped — no task created");
    return;
  }

  // Try to accept a non-existent claim
  const r1 = await request("PATCH", `/api/tasks/${taskId}/claims/99999`, {
    action: "accept",
  });
  // Should fail — claim doesn't exist (but route may return different codes)
  assert(r1.status >= 400, "Rejects non-existent claim", `got ${r1.status}`);

  // Try invalid action
  const r2 = await request("PATCH", `/api/tasks/${taskId}/claims/1`, {
    action: "invalid_action",
  });
  assert(r2.status === 400, "Rejects invalid action", `got ${r2.status}`);
}

async function testDeliverableActions() {
  console.log("\n📦 PATCH /api/tasks/[id]/deliverables/[id] — Deliverable Actions");

  if (!taskId) {
    log("⏭️", "Skipped — no task created");
    return;
  }

  // Task is still "open", so deliverable actions should fail
  const r1 = await request("PATCH", `/api/tasks/${taskId}/deliverables/1`, {
    action: "accept",
  });
  assert(r1.status === 400 || r1.status === 404, "Rejects when task not in delivered state", `got ${r1.status}`);
}

async function testReview() {
  console.log("\n⭐ POST /api/tasks/[id]/review — Review");

  if (!taskId) {
    log("⏭️", "Skipped — no task created");
    return;
  }

  // Task is not completed, so review should fail
  const r1 = await request("POST", `/api/tasks/${taskId}/review`, {
    agentId: 1,
    rating: 5,
  });
  assert(r1.status === 400, "Rejects review on non-completed task", `got ${r1.status}`);

  // Invalid rating
  const r2 = await request("POST", `/api/tasks/${taskId}/review`, {
    agentId: 1,
    rating: 0,
  });
  assert(r2.status === 400, "Rejects rating < 1", `got ${r2.status}`);

  const r3 = await request("POST", `/api/tasks/${taskId}/review`, {
    agentId: 1,
    rating: 6,
  });
  assert(r3.status === 400, "Rejects rating > 5", `got ${r3.status}`);
}

async function testWrongTaskOwner() {
  console.log("\n🚫 Authorization — Wrong Task Owner");

  // Try to access a task ID that likely doesn't belong to this user
  const r1 = await request("PATCH", `/api/tasks/999999/claims/1`, {
    action: "accept",
  });
  assert(r1.status === 404, "Returns 404 for task not owned by user", `got ${r1.status}`);

  const r2 = await request("PATCH", `/api/tasks/999999/deliverables/1`, {
    action: "accept",
  });
  assert(r2.status === 404, "Returns 404 for deliverable on unowned task", `got ${r2.status}`);
}

// ──────────────────────────────────────────────────────────────────────
// Runner
// ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   TaskHive — API Test Suite              ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`\nTarget: ${BASE_URL}`);

  if (SESSION_COOKIE === "PASTE_YOUR_COOKIE_HERE") {
    console.log("\n❌ You need to paste your session cookie first!");
    console.log("   1. Open your app in browser and log in");
    console.log("   2. DevTools → Application → Cookies");
    console.log('   3. Copy all sb-* cookie values');
    console.log("   4. Paste into SESSION_COOKIE in this file\n");
    process.exit(1);
  }

  // Check server is running
  try {
    await fetch(BASE_URL);
  } catch {
    console.log("\n❌ Cannot reach dev server. Make sure 'npm run dev' is running.\n");
    process.exit(1);
  }

  await testUnauthorized();
  await testCreateTask_Validation();
  await testCreateTask_Success();
  await testClaimActions();
  await testDeliverableActions();
  await testReview();
  await testWrongTaskOwner();

  console.log("\n══════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log("══════════════════════════════════════════\n");

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("\n💥 Test runner crashed:", err.message);
  process.exit(1);
});