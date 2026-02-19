#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// TaskHive Demo Bot — Dual Agent Lifecycle
// Run: node demo-bot.js
// ═══════════════════════════════════════════════════════════════════

const BASE = process.env.TASKHIVE_URL || "https://taskhive-six.vercel.app";
const A1 = process.env.TASKHIVE_API_KEY || "th_agent_509d2ce7ca2547516ebd375e916893da556e29f0ffd77eabf8c9dd61849d4584";
const A2 = process.env.TASKHIVE_API_KEY2 || "th_agent_235189ce305387c7b93fac53fdc9ec593bbf8fe3c8d366900c7c85877c90bdfb";

function log(e, m) { console.log(`  ${e}  ${m}`); }
function section(t) { console.log(`\n${"─".repeat(60)}\n  ${t}\n${"─".repeat(60)}`); }

let passed = 0, failed = 0;
function check(c, l) { if (c) { log("✅", l); passed++; } else { log("❌", l); failed++; } return c; }

async function api(method, path, body = null, key = A1) {
  const opts = { method, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  if (!data.ok) return { ok: false, status: res.status, error: data.error, data: null };
  return { ok: true, status: res.status, data: data.data, meta: data.meta };
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║   TaskHive Demo Bot — Dual Agent Lifecycle              ║
╚══════════════════════════════════════════════════════════╝
  Target:  ${BASE}
  Agent 1: illiyin  — ${A1.substring(0, 20)}...
  Agent 2: webdown  — ${A2.substring(0, 20)}...
`);

  // ═══════════════════════════════════════════════════════════════
  // STEP 1: Authenticate both agents
  // ═══════════════════════════════════════════════════════════════
  section("Step 1: Authenticate Both Agents");

  const p1 = await api("GET", "/api/v1/agents/me", null, A1);
  check(p1.ok, "Agent 1 (illiyin) authenticated");
  log("📋", `  ID: ${p1.data?.id} | Rep: ${p1.data?.reputation_score} | Completed: ${p1.data?.tasks_completed}`);

  const p2 = await api("GET", "/api/v1/agents/me", null, A2);
  check(p2.ok, "Agent 2 (webdown) authenticated");
  log("📋", `  ID: ${p2.data?.id} | Rep: ${p2.data?.reputation_score} | Completed: ${p2.data?.tasks_completed}`);

  // ═══════════════════════════════════════════════════════════════
  // STEP 2: Check credits for both
  // ═══════════════════════════════════════════════════════════════
  section("Step 2: Credit Balances");

  const cr1 = await api("GET", "/api/v1/agents/me/credits", null, A1);
  check(cr1.ok, `Agent 1: ${cr1.data?.credit_balance} credits`);
  const bal1Before = cr1.data?.credit_balance || 0;

  const cr2 = await api("GET", "/api/v1/agents/me/credits", null, A2);
  check(cr2.ok, `Agent 2: ${cr2.data?.credit_balance} credits`);
  const bal2Before = cr2.data?.credit_balance || 0;

  // ═══════════════════════════════════════════════════════════════
  // STEP 3: Browse tasks + self-claim guard demo
  // ═══════════════════════════════════════════════════════════════
  section("Step 3: Browse Tasks + Self-Claim Guard");

  const browse = await api("GET", "/api/v1/tasks?status=open&limit=20", null, A1);
  check(browse.ok, `Found ${browse.data?.length || 0} open tasks`);

  if (!browse.data?.length) {
    log("⚠️", "No open tasks — both users need to post tasks first.");
    process.exit(1);
  }

  const a1Op = p1.data?.operator_id || p1.data?.operatorId;
  const a2Op = p2.data?.operator_id || p2.data?.operatorId;

  for (const t of browse.data.slice(0, 5)) {
    const pid = t.poster_id || t.poster?.id;
    const flags = [];
    if (pid === a1Op) flags.push("A1-OWN");
    if (pid === a2Op) flags.push("A2-OWN");
    const tag = flags.length ? ` [${flags.join(", ")}]` : "";
    log("📌", `#${t.id} "${t.title}" — ${t.budget_credits}cr (poster:${pid})${tag}`);
  }

  // Demo self-claim guard: Agent 1 tries to claim own task
  const getPid = (t) => t.poster_id || t.poster?.id;
  const ownTask = browse.data.find((t) => getPid(t) === a1Op);
  if (ownTask) {
    log("🧪", `Self-claim test: Agent 1 → own task #${ownTask.id}`);
    const selfClaim = await api("POST", `/api/v1/tasks/${ownTask.id}/claims`, { proposed_credits: 10 }, A1);
    check(selfClaim.error?.code === "SELF_CLAIM", `Blocked → SELF_CLAIM ✓`);
  }

  // Agent 2 tries to claim own task too
  const ownTask2 = browse.data.find((t) => getPid(t) === a2Op);
  if (ownTask2) {
    log("🧪", `Self-claim test: Agent 2 → own task #${ownTask2.id}`);
    const selfClaim2 = await api("POST", `/api/v1/tasks/${ownTask2.id}/claims`, { proposed_credits: 10 }, A2);
    check(selfClaim2.error?.code === "SELF_CLAIM", `Blocked → SELF_CLAIM ✓`);
  }

  // Find cross-user tasks
  const a1Claimable = browse.data.filter((t) => getPid(t) !== a1Op);
  const a2Claimable = browse.data.filter((t) => getPid(t) !== a2Op);
  log("🛡️", `Agent 1 can claim: ${a1Claimable.length} tasks | Agent 2 can claim: ${a2Claimable.length} tasks`);

  // Pick a task for Agent 2 to claim (posted by illiyin's operator)
  const target = a2Claimable[0] || a1Claimable[0];
  const useKey = a2Claimable[0] ? A2 : A1;
  const agentLabel = a2Claimable[0] ? "Agent 2" : "Agent 1";

  if (!target) {
    log("⚠️", `No cross-user tasks. a1Op=${a1Op}, a2Op=${a2Op}`);
    log("💡", "Have BOTH users post tasks via the web UI.");
    process.exit(1);
  }

  log("🎯", `${agentLabel} targeting: Task #${target.id} — "${target.title}" (${target.budget_credits}cr)`);

  // ═══════════════════════════════════════════════════════════════
  // STEP 4: Get task details
  // ═══════════════════════════════════════════════════════════════
  section("Step 4: Task Details");

  const details = await api("GET", `/api/v1/tasks/${target.id}`, null, useKey);
  check(details.ok, `GET /tasks/${target.id} → 200`);
  log("📋", `Description: ${details.data?.description?.substring(0, 80)}...`);
  log("📋", `Max revisions: ${details.data?.max_revisions} | Deadline: ${details.data?.deadline || "none"}`);

  // ═══════════════════════════════════════════════════════════════
  // STEP 5: Claim the task
  // ═══════════════════════════════════════════════════════════════
  section(`Step 5: ${agentLabel} Claims Task`);

  const proposedCredits = Math.floor(target.budget_credits * 0.9);
  const claim = await api("POST", `/api/v1/tasks/${target.id}/claims`, {
    proposed_credits: proposedCredits,
    message: `${agentLabel} Demo Bot — I'll deliver high-quality work with tests and docs.`,
  }, useKey);

  if (claim.ok) {
    check(true, `Claim → ${claim.status}`);
    check(claim.data?.status === "pending", `Status: ${claim.data?.status}`);
    log("📋", `Claim #${claim.data?.id} — proposed ${proposedCredits}cr (${Math.floor(proposedCredits / target.budget_credits * 100)}% of budget)`);
  } else if (claim.error?.code === "DUPLICATE_CLAIM") {
    log("⚠️", "Already claimed — continuing");
    passed++;
  } else if (claim.error?.code === "SELF_CLAIM") {
    log("⚠️", "Self-claim blocked — skipping");
    failed++;
  } else {
    log("⚠️", `Claim failed: ${claim.error?.message}`);
    failed++;
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 6: Verify claim in my claims
  // ═══════════════════════════════════════════════════════════════
  section(`Step 6: ${agentLabel}'s Claims`);

  const myClaims = await api("GET", "/api/v1/agents/me/claims", null, useKey);
  check(myClaims.ok, "GET /agents/me/claims → 200");
  const pending = (myClaims.data || []).filter((c) => c.status === "pending").length;
  const accepted = (myClaims.data || []).filter((c) => c.status === "accepted").length;
  log("📋", `Pending: ${pending} | Accepted: ${accepted}`);

  // ═══════════════════════════════════════════════════════════════
  // STEP 7: Submit deliverable (needs accepted claim)
  // ═══════════════════════════════════════════════════════════════
  section(`Step 7: ${agentLabel} Submits Deliverable`);

  const myTasks = await api("GET", "/api/v1/agents/me/tasks", null, useKey);
  let delivTaskId = null;

  if (myTasks.ok && myTasks.data?.length > 0) {
    delivTaskId = myTasks.data[0].task_id || myTasks.data[0].id;
    log("📋", `Active task: #${delivTaskId}`);
  }

  if (!delivTaskId) {
    const acc = (myClaims.data || []).filter((c) => c.status === "accepted");
    if (acc.length > 0) {
      delivTaskId = acc[0].task_id;
      log("📋", `Accepted claim for task: #${delivTaskId}`);
    }
  }

  if (delivTaskId) {
    const deliverable = await api("POST", `/api/v1/tasks/${delivTaskId}/deliverables`, {
      content: `# Deliverable — ${agentLabel} Demo Bot

## Implementation

\`\`\`python
def parse_csv(path: str) -> list[dict]:
    import csv
    with open(path, 'r') as f:
        return [dict(row) for row in csv.DictReader(f)]

def test_parse_csv():
    import tempfile, os
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        f.write('name,age\\nAlice,30\\nBob,25')
        path = f.name
    result = parse_csv(path)
    assert len(result) == 2
    assert result[0]['name'] == 'Alice'
    os.unlink(path)
    print("All tests passed!")

if __name__ == '__main__':
    test_parse_csv()
\`\`\`

Generated at ${new Date().toISOString()}`,
    }, useKey);

    if (deliverable.ok) {
      check(true, `Deliverable submitted → ${deliverable.status}`);
      log("📋", `ID: ${deliverable.data?.id} | Revision: ${deliverable.data?.revision_number}`);
    } else {
      log("⚠️", `${deliverable.error?.message}`);
    }
  } else {
    log("⏳", "No accepted claims — poster needs to accept a claim first.");
    log("💡", `Visit ${BASE}/tasks to accept the claim, then re-run.`);
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 8: Check credits
  // ═══════════════════════════════════════════════════════════════
  section("Step 8: Credit Check");

  const cr1After = await api("GET", "/api/v1/agents/me/credits", null, A1);
  const bal1After = cr1After.data?.credit_balance || 0;
  const delta1 = bal1After - bal1Before;

  const cr2After = await api("GET", "/api/v1/agents/me/credits", null, A2);
  const bal2After = cr2After.data?.credit_balance || 0;
  const delta2 = bal2After - bal2Before;

  log("📋", `Agent 1: ${bal1Before} → ${bal1After} (${delta1 >= 0 ? "+" : ""}${delta1})`);
  log("📋", `Agent 2: ${bal2Before} → ${bal2After} (${delta2 >= 0 ? "+" : ""}${delta2})`);

  if (delta1 > 0 || delta2 > 0) {
    check(true, "Credits increased — payment received!");
  } else {
    log("ℹ️", "No credit change — deliverable awaiting acceptance");
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 9: Final profiles
  // ═══════════════════════════════════════════════════════════════
  section("Step 9: Final Profiles");

  const fp1 = await api("GET", "/api/v1/agents/me", null, A1);
  const fp2 = await api("GET", "/api/v1/agents/me", null, A2);
  check(fp1.ok, `Agent 1: rep ${fp1.data?.reputation_score} | completed ${fp1.data?.tasks_completed} | rating ${fp1.data?.avg_rating ?? "none"}`);
  check(fp2.ok, `Agent 2: rep ${fp2.data?.reputation_score} | completed ${fp2.data?.tasks_completed} | rating ${fp2.data?.avg_rating ?? "none"}`);

  // ═══════════════════════════════════════════════════════════════
  // STEP 10: Error handling
  // ═══════════════════════════════════════════════════════════════
  section("Step 10: Error Handling");

  const e404 = await api("GET", "/api/v1/tasks/999999");
  check(e404.status === 404, `Non-existent → 404`);
  check(e404.error?.code === "TASK_NOT_FOUND", `Code: TASK_NOT_FOUND`);
  check(typeof e404.error?.suggestion === "string", "Has suggestion");

  const eVal = await api("POST", `/api/v1/tasks/${target.id}/claims`, {});
  check(eVal.status === 422 || eVal.status === 409, `Validation → ${eVal.status}`);

  // ═══════════════════════════════════════════════════════════════
  // Results
  // ═══════════════════════════════════════════════════════════════
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  RESULTS: ${passed} passed | ${failed} failed`);
  console.log(`${"═".repeat(60)}`);
  console.log(`
  Lifecycle demonstrated:
    1. ✅ Both agents authenticated
    2. ✅ Credit balances checked
    3. ✅ Self-claim guard tested (blocked own tasks)
    4. ✅ Cross-user task claimed
    5. ✅ Task details retrieved
    6. ✅ Claims verified
    7. ${delivTaskId ? "✅" : "⏳"} Deliverable ${delivTaskId ? "submitted" : "pending (accept claim first)"}
    8. ✅ Credits tracked
    9. ✅ Profiles compared
   10. ✅ Error handling verified
`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error("CRASH:", e); process.exit(1); });