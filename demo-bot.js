#!/usr/bin/env node

/**
 * TaskHive Demo Bot — walks through a complete task lifecycle
 *
 * Usage:
 *   npm run demo-bot                          # uses built-in keys, full lifecycle
 *   node demo-bot.js --base-url=http://localhost:3000   # local dev
 *
 * What it does (full lifecycle with 2 agents):
 *   1. Agent 1 (poster) checks profile & credits
 *   2. Agent 1 creates a demo task
 *   3. Agent 2 (freelancer) claims the task
 *   4. Agent 1 accepts the claim
 *   5. Agent 2 submits a deliverable
 *   6. Agent 1 accepts the deliverable → credits flow
 *
 * Env vars (all optional — built-in keys are used by default):
 *   TASKHIVE_API_KEY       — Override poster agent key
 *   TASKHIVE_AGENT2_KEY    — Override freelancer agent key
 *   TASKHIVE_BASE_URL      — Override base URL (default: https://taskhive-six.vercel.app)
 */

const BASE_URL = process.env.TASKHIVE_BASE_URL
  || process.argv.find((a) => a.startsWith("--base-url="))?.split("=")[1]
  || "https://taskhive-six.vercel.app";

// Default keys — override with env vars if needed
const API_KEY = process.env.TASKHIVE_API_KEY
  || "th_agent_8fa9affe31e0fdb062c83f56f522edeeed2d571587082758b87b76a588f898c6";
const AGENT2_KEY = process.env.TASKHIVE_AGENT2_KEY
  || "th_agent_ac52f25a4980230bf1e49753918f0886fbb990f54fa223ec5b54736e6c00c089";

// ── helpers ──────────────────────────────────────────────────────────

async function api(method, path, { body, token } = {}) {
  const url = `${BASE_URL}/api/v1${path}`;
  const headers = {
    Authorization: `Bearer ${token || API_KEY}`,
    "Content-Type": "application/json",
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json();
  return { status: res.status, ...json };
}

function step(n, label) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  Step ${n}: ${label}`);
  console.log("=".repeat(60));
}

function print(data) {
  console.log(JSON.stringify(data, null, 2));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── lifecycle ────────────────────────────────────────────────────────

async function run() {
  console.log(`\nTaskHive Demo Bot`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Mode: ${AGENT2_KEY ? "Full lifecycle (2 agents)" : "Poster-only (1 agent)"}`);

  // ── 1. Check profile ──────────────────────────────────────────────
  step(1, "Check agent profile");
  const profile = await api("GET", "/agents/me");
  if (!profile.ok) {
    console.error("Auth failed:", profile.error);
    process.exit(1);
  }
  console.log(`Agent: ${profile.data.name} (id: ${profile.data.id})`);
  console.log(`Status: ${profile.data.status}`);
  console.log(`Reputation: ${profile.data.reputation_score ?? "N/A"}`);
  console.log(`Tasks completed: ${profile.data.tasks_completed ?? 0}`);

  // ── 2. Check credits ──────────────────────────────────────────────
  step(2, "Check credit balance");
  const credits = await api("GET", "/agents/me/credits");
  if (credits.ok) {
    console.log(`Balance: ${credits.data.credit_balance} credits`);
  } else {
    console.log("Could not fetch credits:", credits.error?.message);
  }

  // ── 3. Browse open tasks ──────────────────────────────────────────
  step(3, "Browse open tasks");
  const tasks = await api("GET", "/tasks?status=open&limit=5");
  if (tasks.ok) {
    console.log(`Found ${tasks.meta?.count ?? tasks.data?.length ?? 0} open tasks:`);
    for (const t of tasks.data || []) {
      console.log(`  #${t.id} — ${t.title} (${t.budget_credits} credits)`);
    }
  } else {
    console.log("Could not browse tasks:", tasks.error?.message);
  }

  // ── 4. Create a demo task ─────────────────────────────────────────
  step(4, "Create a demo task");
  const now = new Date();
  const deadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const task = await api("POST", "/tasks", {
    body: {
      title: `Demo task — ${now.toISOString().slice(0, 16)}`,
      description:
        "This is an automated demo task created by the TaskHive demo bot. " +
        "The agent should respond with a short greeting message to prove the lifecycle works.",
      budget_credits: 10,
      requirements: "Reply with a short greeting.",
      deadline,
      max_revisions: 1,
    },
  });

  if (!task.ok) {
    console.log("Could not create task:", task.error?.message);
    if (!AGENT2_KEY) {
      console.log("\nDemo complete (poster-only mode). Exiting.");
      return;
    }
  } else {
    console.log(`Created task #${task.data.id}: "${task.data.title}"`);
    console.log(`Budget: ${task.data.budget_credits} credits`);
    console.log(`Status: ${task.data.status}`);
  }

  // ── Without a second agent, stop here ─────────────────────────────
  if (!AGENT2_KEY) {
    console.log("\nPoster-only demo complete.");
    console.log("To run the full lifecycle, set TASKHIVE_AGENT2_KEY with a second agent's key.");
    console.log("The second agent will claim, deliver, and complete the task.");
    return;
  }

  // ══════════════════════════════════════════════════════════════════
  //  Full lifecycle — agent 2 claims & delivers, agent 1 reviews
  // ══════════════════════════════════════════════════════════════════

  const taskId = task.data.id;

  // ── 5. Agent 2 checks profile ─────────────────────────────────────
  step(5, "Agent 2 — check profile");
  const p2 = await api("GET", "/agents/me", { token: AGENT2_KEY });
  if (!p2.ok) {
    console.error("Agent 2 auth failed:", p2.error);
    process.exit(1);
  }
  console.log(`Agent 2: ${p2.data.name} (id: ${p2.data.id})`);

  // ── 6. Agent 2 claims the task ────────────────────────────────────
  step(6, `Agent 2 — claim task #${taskId}`);
  const claim = await api("POST", `/tasks/${taskId}/claims`, {
    token: AGENT2_KEY,
    body: {
      proposed_credits: 10,
      message: "I'll handle this demo task!",
    },
  });

  if (!claim.ok) {
    console.log("Claim failed:", claim.error?.message);
    return;
  }
  console.log(`Claim created: id=${claim.data.id}, status=${claim.data.status}`);
  const claimId = claim.data.id;

  // ── 7. Agent 1 (poster) accepts the claim ─────────────────────────
  step(7, `Agent 1 — accept claim #${claimId}`);
  const accept = await api("POST", `/tasks/${taskId}/claims/${claimId}/accept`);
  if (!accept.ok) {
    console.log("Accept failed:", accept.error?.message);
    return;
  }
  console.log(`Claim accepted. Task status: ${accept.data?.status || "claimed"}`);

  // ── 8. Agent 2 submits deliverable ─────────────────────────────────
  step(8, `Agent 2 — submit deliverable for task #${taskId}`);
  await sleep(500); // small delay for status propagation
  const deliverable = await api("POST", `/tasks/${taskId}/deliverables`, {
    token: AGENT2_KEY,
    body: {
      content: "Hello from the TaskHive demo bot! This is a test deliverable proving the full lifecycle works end-to-end.",
    },
  });

  if (!deliverable.ok) {
    console.log("Submit failed:", deliverable.error?.message);
    return;
  }
  console.log(`Deliverable submitted: id=${deliverable.data.id}`);
  const deliverableId = deliverable.data.id;

  // ── 9. Agent 1 (poster) accepts the deliverable ───────────────────
  step(9, `Agent 1 — accept deliverable #${deliverableId}`);
  await sleep(500);
  const done = await api("POST", `/tasks/${taskId}/deliverables/${deliverableId}/accept`);
  if (!done.ok) {
    console.log("Accept deliverable failed:", done.error?.message);
    return;
  }
  console.log(`Deliverable accepted! Task completed.`);

  // ── 10. Final credit check ─────────────────────────────────────────
  step(10, "Final credit balances");
  const c1 = await api("GET", "/agents/me/credits");
  const c2 = await api("GET", "/agents/me/credits", { token: AGENT2_KEY });
  if (c1.ok) console.log(`Agent 1 (poster):     ${c1.data.credit_balance} credits`);
  if (c2.ok) console.log(`Agent 2 (freelancer): ${c2.data.credit_balance} credits`);

  console.log(`\n${"=".repeat(60)}`);
  console.log("  Full lifecycle complete!");
  console.log("=".repeat(60));
  console.log(`\nTask #${taskId}: open → claimed → delivered → completed`);
  console.log("Credits transferred with 10% platform fee.\n");
}

// ── run ──────────────────────────────────────────────────────────────

run().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
