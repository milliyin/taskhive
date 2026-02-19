#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// TaskHive Demo Bot — Full Agent Lifecycle
// Run: node demo-bot.js
// ═══════════════════════════════════════════════════════════════════

const BASE_URL = process.env.TASKHIVE_URL || "https://taskhive-six.vercel.app";
const API_KEY = process.env.TASKHIVE_API_KEY || "th_agent_509d2ce7ca2547516ebd375e916893da556e29f0ffd77eabf8c9dd61849d4584";

// ─── Helpers ─────────────────────────────────────────────────────────

function log(emoji, msg) {
  console.log(`  ${emoji}  ${msg}`);
}

function header(title) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"─".repeat(60)}`);
}

async function api(method, path, body = null) {
  const opts = {
    method,
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, opts);
  const data = await res.json();

  if (!data.ok) {
    log("❌", `${method} ${path} → ${res.status}`);
    log("  ", `Error: ${data.error?.message}`);
    log("  ", `Suggestion: ${data.error?.suggestion}`);
    return { ok: false, status: res.status, error: data.error, data: null };
  }

  return { ok: true, status: res.status, data: data.data, meta: data.meta };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║   TaskHive Demo Bot — Full Agent Lifecycle              ║
╚══════════════════════════════════════════════════════════╝
`);
  console.log(`  Target: ${BASE_URL}`);
  console.log(`  API Key: ${API_KEY.substring(0, 20)}...`);

  let passed = 0;
  let failed = 0;

  function check(condition, label) {
    if (condition) {
      log("✅", label);
      passed++;
    } else {
      log("❌", label);
      failed++;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 1: Authenticate — Check agent profile
  // ═══════════════════════════════════════════════════════════════════
  header("Step 1: Authenticate — Get Agent Profile");

  const profile = await api("GET", "/api/v1/agents/me");
  check(profile.ok, "GET /agents/me → 200");
  check(typeof profile.data?.id === "number", `Agent ID: ${profile.data?.id}`);
  check(profile.data?.status === "active", `Status: ${profile.data?.status}`);
  log("📋", `Name: ${profile.data?.name}`);
  log("📋", `Reputation: ${profile.data?.reputation_score}`);
  log("📋", `Tasks completed: ${profile.data?.tasks_completed}`);

  const initialTasksCompleted = profile.data?.tasks_completed || 0;

  // ═══════════════════════════════════════════════════════════════════
  // STEP 2: Check initial credit balance
  // ═══════════════════════════════════════════════════════════════════
  header("Step 2: Check Initial Credits");

  const creditsBefore = await api("GET", "/api/v1/agents/me/credits");
  check(creditsBefore.ok, "GET /agents/me/credits → 200");
  check(typeof creditsBefore.data?.credit_balance === "number", `Balance: ${creditsBefore.data?.credit_balance} credits`);

  const initialBalance = creditsBefore.data?.credit_balance || 0;

  // ═══════════════════════════════════════════════════════════════════
  // STEP 3: Browse open tasks
  // ═══════════════════════════════════════════════════════════════════
  header("Step 3: Browse Available Tasks");

  const browse = await api("GET", "/api/v1/tasks?status=open&sort=budget_high&limit=5");
  check(browse.ok, "GET /tasks?status=open → 200");
  check(Array.isArray(browse.data), `Found ${browse.data?.length || 0} open tasks`);

  if (!browse.data || browse.data.length === 0) {
    log("⚠️", "No open tasks found! Create a task in the Web UI first.");
    log("⚠️", "Visit: " + BASE_URL + "/dashboard/my/tasks");
    console.log(`\n  Results: ${passed} passed | ${failed} failed\n`);
    process.exit(1);
  }

  // Display available tasks
  for (const task of browse.data.slice(0, 3)) {
    log("📌", `Task #${task.id}: "${task.title}" — ${task.budget_credits} credits (${task.claims_count} claims)`);
  }

  // Pick the highest-budget open task
  const target = browse.data[0];
  log("🎯", `Selected: Task #${target.id} — "${target.title}" (${target.budget_credits} credits)`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 4: Get task details
  // ═══════════════════════════════════════════════════════════════════
  header("Step 4: Get Task Details");

  const details = await api("GET", `/api/v1/tasks/${target.id}`);
  check(details.ok, `GET /tasks/${target.id} → 200`);
  check(details.data?.id === target.id, `Task ID matches: ${details.data?.id}`);
  log("📋", `Description: ${details.data?.description?.substring(0, 80)}...`);
  log("📋", `Max revisions: ${details.data?.max_revisions}`);
  log("📋", `Deadline: ${details.data?.deadline || "none"}`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 5: Claim the task
  // ═══════════════════════════════════════════════════════════════════
  header("Step 5: Claim the Task");

  // Propose 90% of budget (competitive pricing)
  const proposedCredits = Math.floor(target.budget_credits * 0.9);

  const claim = await api("POST", `/api/v1/tasks/${target.id}/claims`, {
    proposed_credits: proposedCredits,
    message: "I'm the TaskHive Demo Bot. I can complete this task efficiently with high-quality output. My approach: analyze requirements, implement solution, include tests and documentation.",
  });

  if (claim.ok) {
    check(true, `POST /tasks/${target.id}/claims → 201`);
    check(claim.data?.status === "pending", `Claim status: ${claim.data?.status}`);
    log("📋", `Claim ID: ${claim.data?.id}`);
    log("📋", `Proposed: ${proposedCredits} credits (${Math.floor(proposedCredits / target.budget_credits * 100)}% of budget)`);
  } else if (claim.error?.code === "DUPLICATE_CLAIM") {
    log("⚠️", "Already claimed this task — continuing with existing claim");
    passed++;
  } else if (claim.error?.code === "TASK_NOT_OPEN") {
    log("⚠️", `Task is ${claim.error?.message} — trying next task`);
    // Try the next task
    if (browse.data.length > 1) {
      const fallback = browse.data[1];
      log("🎯", `Falling back to Task #${fallback.id}`);
      const claim2 = await api("POST", `/api/v1/tasks/${fallback.id}/claims`, {
        proposed_credits: Math.floor(fallback.budget_credits * 0.9),
        message: "Demo Bot fallback claim.",
      });
      check(claim2.ok || claim2.error?.code === "DUPLICATE_CLAIM", `Claimed fallback task #${fallback.id}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 6: Verify claim appears in my claims
  // ═══════════════════════════════════════════════════════════════════
  header("Step 6: Verify Claim in My Claims");

  const myClaims = await api("GET", "/api/v1/agents/me/claims");
  check(myClaims.ok, "GET /agents/me/claims → 200");
  check(Array.isArray(myClaims.data), `Total claims: ${myClaims.data?.length || 0}`);

  const pendingClaims = (myClaims.data || []).filter((c) => c.status === "pending");
  const acceptedClaims = (myClaims.data || []).filter((c) => c.status === "accepted");

  log("📋", `Pending: ${pendingClaims.length} | Accepted: ${acceptedClaims.length}`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 7: Attempt delivery (needs accepted claim)
  // ═══════════════════════════════════════════════════════════════════
  header("Step 7: Submit Deliverable");

  // Find a task we have an accepted claim for
  let deliveryTaskId = null;
  let deliveryCredits = 0;

  // Check active tasks
  const myTasks = await api("GET", "/api/v1/agents/me/tasks");
  if (myTasks.ok && myTasks.data?.length > 0) {
    const activeTask = myTasks.data[0];
    deliveryTaskId = activeTask.task_id || activeTask.id;
    deliveryCredits = activeTask.proposed_credits || activeTask.budget_credits;
    log("📋", `Active task found: #${deliveryTaskId}`);
  }

  // Also check accepted claims
  if (!deliveryTaskId && acceptedClaims.length > 0) {
    deliveryTaskId = acceptedClaims[0].task_id;
    deliveryCredits = acceptedClaims[0].proposed_credits;
    log("📋", `Accepted claim found for task: #${deliveryTaskId}`);
  }

  if (deliveryTaskId) {
    const deliverable = await api("POST", `/api/v1/tasks/${deliveryTaskId}/deliverables`, {
      content: `# Task Deliverable — Demo Bot Output

## Summary
This deliverable was generated by the TaskHive Demo Bot to demonstrate the full agent lifecycle.

## Implementation

\`\`\`python
def parse_csv(file_path: str) -> list[dict]:
    """Parse a CSV file and return a list of dictionaries."""
    import csv
    
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        return [dict(row) for row in reader]


def test_parse_csv():
    """Unit tests for parse_csv function."""
    import tempfile, os
    
    # Test 1: Basic CSV
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        f.write('name,age\\nAlice,30\\nBob,25')
        path = f.name
    
    result = parse_csv(path)
    assert len(result) == 2
    assert result[0]['name'] == 'Alice'
    assert result[1]['age'] == '25'
    os.unlink(path)
    
    # Test 2: Empty file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        f.write('')
        path = f.name
    
    result = parse_csv(path)
    assert len(result) == 0
    os.unlink(path)
    
    print("All tests passed!")

if __name__ == '__main__':
    test_parse_csv()
\`\`\`

## Notes
- Handles UTF-8 encoding
- Uses only standard library (csv module)
- Includes edge case tests for empty files
- Type hints and docstrings included

Generated by TaskHive Demo Bot at ${new Date().toISOString()}`,
    });

    if (deliverable.ok) {
      check(true, `POST /tasks/${deliveryTaskId}/deliverables → 201`);
      check(deliverable.data?.status === "submitted", `Deliverable status: ${deliverable.data?.status}`);
      log("📋", `Deliverable ID: ${deliverable.data?.id}`);
      log("📋", `Revision #: ${deliverable.data?.revision_number}`);
      log("📋", `Late: ${deliverable.data?.is_late ? "yes" : "no"}`);
    } else {
      log("⚠️", `Delivery failed: ${deliverable.error?.message}`);
      log("💡", `${deliverable.error?.suggestion}`);
    }
  } else {
    log("⏳", "No accepted claims yet — poster needs to accept a claim first");
    log("💡", `Visit ${BASE_URL}/dashboard/my/tasks to accept a claim`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 8: Check for credit changes
  // ═══════════════════════════════════════════════════════════════════
  header("Step 8: Verify Credits");

  const creditsAfter = await api("GET", "/api/v1/agents/me/credits");
  check(creditsAfter.ok, "GET /agents/me/credits → 200");

  const finalBalance = creditsAfter.data?.credit_balance || 0;
  const balanceChange = finalBalance - initialBalance;

  log("📋", `Initial balance: ${initialBalance} credits`);
  log("📋", `Current balance: ${finalBalance} credits`);
  log("📋", `Change: ${balanceChange >= 0 ? "+" : ""}${balanceChange} credits`);

  if (balanceChange > 0) {
    check(true, `Credits increased by ${balanceChange} (payment received!)`);

    // Verify transaction in ledger
    const transactions = creditsAfter.data?.recent_transactions || [];
    const payment = transactions.find((t) => t.type === "payment");
    if (payment) {
      log("📋", `Payment: +${payment.amount} credits for task`);
      log("📋", `Balance after: ${payment.balance_after}`);
    }
  } else {
    log("ℹ️", "No credit change — deliverable needs to be accepted by poster");
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 9: Check updated profile
  // ═══════════════════════════════════════════════════════════════════
  header("Step 9: Final Profile Check");

  const finalProfile = await api("GET", "/api/v1/agents/me");
  check(finalProfile.ok, "GET /agents/me → 200");

  const newTasksCompleted = finalProfile.data?.tasks_completed || 0;
  log("📋", `Tasks completed: ${initialTasksCompleted} → ${newTasksCompleted}`);
  log("📋", `Reputation: ${finalProfile.data?.reputation_score}`);

  if (newTasksCompleted > initialTasksCompleted) {
    check(true, `tasks_completed incremented: ${initialTasksCompleted} → ${newTasksCompleted}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 10: Test error handling
  // ═══════════════════════════════════════════════════════════════════
  header("Step 10: Error Handling Verification");

  // Non-existent task
  const err404 = await api("GET", "/api/v1/tasks/999999");
  check(err404.status === 404, "Non-existent task → 404");
  check(err404.error?.code === "TASK_NOT_FOUND", `Error code: ${err404.error?.code}`);
  check(typeof err404.error?.suggestion === "string", "Has actionable suggestion");

  // Invalid claim (missing credits)
  const errValidation = await api("POST", `/api/v1/tasks/${target.id}/claims`, {});
  check(errValidation.status === 422 || errValidation.status === 409, `Validation error → ${errValidation.status}`);
  check(typeof errValidation.error?.suggestion === "string", "Validation has suggestion");

  // ═══════════════════════════════════════════════════════════════════
  // Results
  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  RESULTS: ${passed} passed | ${failed} failed`);
  console.log(`${"═".repeat(60)}`);

  if (deliveryTaskId) {
    console.log(`
  ✅ Full lifecycle demonstrated:
     1. Authenticated with API key
     2. Browsed open tasks with filters
     3. Retrieved task details
     4. Claimed a task with competitive pricing
     5. Submitted deliverable with code
     6. Verified credit balance
     7. Checked profile stats
     8. Tested error handling
`);
  } else {
    console.log(`
  ⏳ Partial lifecycle — claim submitted, awaiting acceptance.
  
  To complete the demo:
    1. Visit ${BASE_URL}/dashboard/my/tasks
    2. Accept the bot's claim
    3. Run this script again → it will deliver and verify credits
`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Bot crashed:", err);
  process.exit(1);
});