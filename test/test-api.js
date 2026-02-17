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
const SESSION_COOKIE = "sb-wkqrkknmimhzcozlaozo-auth-token=base64-eyJhY2Nlc3NfdG9rZW4iOiJleUpoYkdjaU9pSkZVekkxTmlJc0ltdHBaQ0k2SWpJMU5qVmtaVGxrTFRWa01qY3ROR0V4TWkxaFlURmpMV0UwWlRJM1pEWXlNbVEwTXlJc0luUjVjQ0k2SWtwWFZDSjkuZXlKcGMzTWlPaUpvZEhSd2N6b3ZMM2RyY1hKcmEyNXRhVzFvZW1OdmVteGhiM3B2TG5OMWNHRmlZWE5sTG1OdkwyRjFkR2d2ZGpFaUxDSnpkV0lpT2lKbU5Ea3pOelpoTnkwd1kyTTNMVFE1Wm1JdFlUZzVOeTFtT0RobVltUmhOVGhpTkdJaUxDSmhkV1FpT2lKaGRYUm9aVzUwYVdOaGRHVmtJaXdpWlhod0lqb3hOemN4TXpRd05EQTFMQ0pwWVhRaU9qRTNOekV6TXpZNE1EVXNJbVZ0WVdsc0lqb2lhV3hzYVhscGJtUmxjMmxuYm5OQVoyMWhhV3d1WTI5dElpd2ljR2h2Ym1VaU9pSWlMQ0poY0hCZmJXVjBZV1JoZEdFaU9uc2ljSEp2ZG1sa1pYSWlPaUpsYldGcGJDSXNJbkJ5YjNacFpHVnljeUk2V3lKbGJXRnBiQ0pkZlN3aWRYTmxjbDl0WlhSaFpHRjBZU0k2ZXlKbGJXRnBiQ0k2SW1sc2JHbDVhVzVrWlhOcFoyNXpRR2R0WVdsc0xtTnZiU0lzSW1WdFlXbHNYM1psY21sbWFXVmtJanAwY25WbExDSnVZVzFsSWpvaWFXeHNhWGxwYmlJc0luQm9iMjVsWDNabGNtbG1hV1ZrSWpwbVlXeHpaU3dpYzNWaUlqb2laalE1TXpjMllUY3RNR05qTnkwME9XWmlMV0U0T1RjdFpqZzRabUprWVRVNFlqUmlJbjBzSW5KdmJHVWlPaUpoZFhSb1pXNTBhV05oZEdWa0lpd2lZV0ZzSWpvaVlXRnNNU0lzSW1GdGNpSTZXM3NpYldWMGFHOWtJam9pY0dGemMzZHZjbVFpTENKMGFXMWxjM1JoYlhBaU9qRTNOekV6TXpZNE1EVjlYU3dpYzJWemMybHZibDlwWkNJNklqVm1NMkk1WXpnekxUbGxNREV0TkdGak15MDVPR1EzTFRRek1EWXlOemsxTTJWak5DSXNJbWx6WDJGdWIyNTViVzkxY3lJNlptRnNjMlY5LkJXTGpwQmpyYm5FZ2pVelFXS0VTZHRIU0NIdENqRE5xQ004LVc2VlUwOUVSdGdwV2xPczJyNjFwOXdxZWNCTVAweXpDVUVVdzlNWjBjUnRMZHNVaVNRIiwidG9rZW5fdHlwZSI6ImJlYXJlciIsImV4cGlyZXNfaW4iOjM2MDAsImV4cGlyZXNfYXQiOjE3NzEzNDA0MDUsInJlZnJlc2hfdG9rZW4iOiJpbHJmdW80d2hyaTciLCJ1c2VyIjp7ImlkIjoiZjQ5Mzc2YTctMGNjNy00OWZiLWE4OTctZjg4ZmJkYTU4YjRiIiwiYXVkIjoiYXV0aGVudGljYXRlZCIsInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiZW1haWwiOiJpbGxpeWluZGVzaWduc0BnbWFpbC5jb20iLCJlbWFpbF9jb25maXJtZWRfYXQiOiIyMDI2LTAyLTE3VDEzOjM5OjIwLjI0MTUzNloiLCJwaG9uZSI6IiIsImNvbmZpcm1hdGlvbl9zZW50X2F0IjoiMjAyNi0wMi0xN1QxMzozODozNy4yMDAyNDVaIiwiY29uZmlybWVkX2F0IjoiMjAyNi0wMi0xN1QxMzozOToyMC4yNDE1MzZaIiwibGFzdF9zaWduX2luX2F0IjoiMjAyNi0wMi0xN1QxNDowMDowNS42NjcwNTU0NzhaIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWwiOiJpbGxpeWluZGVzaWduc0BnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibmFtZSI6ImlsbGl5aW4iLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInN1YiI6ImY0OTM3NmE3LTBjYzctNDlmYi1hODk3LWY4OGZiZGE1OGI0YiJ9LCJpZGVudGl0aWVzIjpbeyJpZGVudGl0eV9pZCI6IjNjODNiODg1LTEyMzYtNGJhYi05YmRkLTg4NGNlODBiY2I1YyIsImlkIjoiZjQ5Mzc2YTctMGNjNy00OWZiLWE4OTctZjg4ZmJkYTU4YjRiIiwidXNlcl9pZCI6ImY0OTM3NmE3LTBjYzctNDlmYi1hODk3LWY4OGZiZGE1OGI0YiIsImlkZW50aXR5X2RhdGEiOnsiZW1haWwiOiJpbGxpeWluZGVzaWduc0BnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibmFtZSI6ImlsbGl5aW4iLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInN1YiI6ImY0OTM3NmE3LTBjYzctNDlmYi1hODk3LWY4OGZiZGE1OGI0YiJ9LCJwcm92aWRlciI6ImVtYWlsIiwibGFzdF9zaWduX2luX2F0IjoiMjAyNi0wMi0xN1QxMzozODozNy4xODI3MDhaIiwiY3JlYXRlZF9hdCI6IjIwMjYtMDItMTdUMTM6Mzg6MzcuMTgzMjA2WiIsInVwZGF0ZWRfYXQiOiIyMDI2LTAyLTE3VDEzOjM4OjM3LjE4MzIwNloiLCJlbWFpbCI6ImlsbGl5aW5kZXNpZ25zQGdtYWlsLmNvbSJ9XSwiY3JlYXRlZF9hdCI6IjIwMjYtMDItMTdUMTM6Mzg6MzcuMTU0NjI1WiIsInVwZGF0ZWRfYXQiOiIyMDI2LTAyLTE3VDE0OjAwOjA1LjY5NzQyOFoiLCJpc19hbm9ueW1vdXMiOmZhbHNlfSwid2Vha19wYXNzd29yZCI6bnVsbH0";

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