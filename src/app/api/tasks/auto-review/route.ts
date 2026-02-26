// Location: src/app/api/tasks/auto-review/route.ts — POST trigger inline AI review
import { createClient } from "@/lib/supabase-server";
import db from "@/db/index";
import { users, tasks, deliverables, deliverableFiles, deliverableReviews, agents, creditTransactions, githubDeliveries } from "@/db/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { PLATFORM } from "@/lib/constants";
import { decrypt } from "@/lib/encryption";
import { dispatchWebhook } from "@/lib/webhook-dispatcher";
import { deleteDeployment } from "@/services/vercel-deploy";

const REVIEW_PROMPT = `You are a strict code/content reviewer for the TaskHive platform.
You must evaluate a deliverable submission against the task requirements.

## Task
**Title:** {title}
**Description:** {description}
**Requirements:** {requirements}

## Submitted Deliverable (Revision #{revision})
\`\`\`
{content}
\`\`\`

{files_section}

{preview_section}

## Your Job
Evaluate whether this deliverable FULLY meets ALL task requirements. Be strict:
- If ANY requirement is not met, the verdict is FAIL
- 90% completion is still FAIL
- The task either meets the spec or it doesn't
- If a live preview URL is provided, consider whether the deployed site looks complete

## Response Format
Respond ONLY with valid JSON (no markdown, no backticks):
{
  "verdict": "pass" or "fail",
  "feedback": "Detailed explanation of what was done well and what's missing. Be specific and actionable.",
  "scores": {
    "requirements_met": <1-10>,
    "code_quality": <1-10>,
    "completeness": <1-10>
  },
  "missing_requirements": ["list of specific unmet requirements, empty if pass"]
}`;

async function callLlm(provider: string, apiKey: string, prompt: string): Promise<{ verdict: string; feedback: string; scores: Record<string, number>; missing_requirements: string[] }> {
  let url: string;
  let headers: Record<string, string>;
  let body: Record<string, unknown>;
  let model: string;

  if (provider === "openrouter") {
    model = "anthropic/claude-sonnet-4-20250514";
    url = "https://openrouter.ai/api/v1/chat/completions";
    headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
    body = { model, messages: [{ role: "user", content: prompt }], max_tokens: 2000, temperature: 0.1 };
  } else if (provider === "anthropic") {
    model = "claude-sonnet-4-20250514";
    url = "https://api.anthropic.com/v1/messages";
    headers = { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" };
    body = { model, max_tokens: 2000, temperature: 0.1, messages: [{ role: "user", content: prompt }] };
  } else if (provider === "openai") {
    model = "gpt-4o";
    url = "https://api.openai.com/v1/chat/completions";
    headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
    body = { model, messages: [{ role: "user", content: prompt }], max_tokens: 2000, temperature: 0.1 };
  } else {
    throw new Error(`Unknown provider: ${provider}`);
  }

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`LLM API error (${resp.status}): ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  let content: string;

  if (provider === "anthropic") {
    content = data.content[0].text;
  } else {
    content = data.choices[0].message.content;
  }

  // Parse JSON from response (strip markdown fences if present)
  const cleaned = content.trim().replace(/^```json\s*/, "").replace(/```\s*$/, "").trim();
  return JSON.parse(cleaned);
}

export async function POST(request: Request) {
  // ─── Auth ───────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const dbUser = await db.select().from(users).where(eq(users.email, user.email!)).then((r) => r[0]);
  if (!dbUser) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  const { taskId } = await request.json();
  const tId = parseInt(taskId);
  if (isNaN(tId)) return NextResponse.json({ ok: false, error: "Invalid task ID" }, { status: 400 });

  // ─── Verify task ownership + state ──────────────────────────────────
  const task = await db.select().from(tasks).where(eq(tasks.id, tId)).then((r) => r[0]);
  if (!task || task.posterId !== dbUser.id) {
    return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
  }
  if (task.status !== "delivered") {
    return NextResponse.json({ ok: false, error: "Task is not in delivered state" }, { status: 400 });
  }

  // ─── Resolve LLM key: poster profile → freelancer agent ─────────────
  let llmKey: string | null = null;
  let llmProvider: string | null = null;
  let keySource: "poster" | "freelancer" | "none" = "none";

  if (dbUser.llmKeyEncrypted) {
    try {
      llmKey = decrypt(dbUser.llmKeyEncrypted);
      llmProvider = dbUser.llmProvider;
      keySource = "poster";
    } catch { /* ignore */ }
  }

  if (!llmKey && task.claimedByAgentId) {
    const claimedAgent = await db.select().from(agents).where(eq(agents.id, task.claimedByAgentId)).then((r) => r[0]);
    if (claimedAgent?.freelancerLlmKeyEncrypted) {
      try {
        llmKey = decrypt(claimedAgent.freelancerLlmKeyEncrypted);
        llmProvider = claimedAgent.freelancerLlmProvider;
        keySource = "freelancer";
      } catch { /* ignore */ }
    }
  }

  if (!llmKey || !llmProvider) {
    return NextResponse.json({ ok: false, error: "No LLM key configured. Set one in your profile settings." }, { status: 400 });
  }

  // ─── Fetch deliverable + files + GitHub delivery ────────────────────
  const deliverable = await db
    .select()
    .from(deliverables)
    .where(eq(deliverables.taskId, tId))
    .orderBy(desc(deliverables.submittedAt))
    .limit(1)
    .then((r) => r[0]);

  if (!deliverable || deliverable.status !== "submitted") {
    return NextResponse.json({ ok: false, error: "No submitted deliverable found" }, { status: 400 });
  }

  const dFiles = await db.select().from(deliverableFiles).where(eq(deliverableFiles.deliverableId, deliverable.id));

  const ghDelivery = await db
    .select()
    .from(githubDeliveries)
    .where(eq(githubDeliveries.deliverableId, deliverable.id))
    .then((r) => r[0] || null);

  // ─── Build prompt ──────────────────────────────────────────────────
  let filesSection = "";
  if (dFiles.length > 0) {
    const fileList = dFiles.map((f) => `- ${f.originalName} (${f.fileType}, ${f.sizeBytes} bytes): ${f.publicUrl}`).join("\n");
    filesSection = `## Submitted Files\n${fileList}`;
  }

  let previewSection = "";
  if (ghDelivery?.previewUrl && ghDelivery.deployStatus === "ready") {
    previewSection = `## Live Preview\nDeployed at: ${ghDelivery.previewUrl}\nSource: ${ghDelivery.sourceRepoUrl} (branch: ${ghDelivery.sourceBranch || "main"})`;
  } else if (ghDelivery?.sourceRepoUrl) {
    previewSection = `## GitHub Repository\n${ghDelivery.sourceRepoUrl} (branch: ${ghDelivery.sourceBranch || "main"})`;
  }

  const prompt = REVIEW_PROMPT
    .replace("{title}", task.title)
    .replace("{description}", task.description || "")
    .replace("{requirements}", task.requirements || "No specific requirements listed")
    .replace("{revision}", String(deliverable.revisionNumber))
    .replace("{content}", (deliverable.content || "").slice(0, 15000))
    .replace("{files_section}", filesSection)
    .replace("{preview_section}", previewSection);

  // ─── Call LLM ──────────────────────────────────────────────────────
  let result: { verdict: string; feedback: string; scores: Record<string, number>; missing_requirements: string[] };
  let llmModel = `${llmProvider}/unknown`;

  try {
    result = await callLlm(llmProvider, llmKey, prompt);
    llmModel = llmProvider === "openrouter" ? "openrouter/anthropic/claude-sonnet-4-20250514"
      : llmProvider === "anthropic" ? "anthropic/claude-sonnet-4-20250514"
      : "openai/gpt-4o";
  } catch (err) {
    const msg = err instanceof Error ? err.message : "LLM call failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }

  const verdict = result.verdict?.toLowerCase() === "pass" ? "pass" : "fail";
  const feedback = result.feedback || "No feedback provided";
  const now = new Date();

  // ─── Store review ──────────────────────────────────────────────────
  await db.insert(deliverableReviews).values({
    deliverableId: deliverable.id,
    taskId: tId,
    agentId: deliverable.agentId,
    reviewResult: verdict,
    reviewFeedback: feedback,
    reviewScores: result.scores || {},
    reviewKeySource: keySource,
    llmModelUsed: llmModel,
    reviewedAt: now,
  });

  // Increment poster reviews used
  if (keySource === "poster") {
    await db.update(tasks).set({
      posterReviewsUsed: sql`${tasks.posterReviewsUsed} + 1`,
      updatedAt: now,
    }).where(eq(tasks.id, tId));
  }

  // ─── Act on verdict ────────────────────────────────────────────────
  if (verdict === "pass") {
    // Accept deliverable — same logic as dashboard accept
    await db.update(deliverables).set({ status: "accepted" }).where(eq(deliverables.id, deliverable.id));
    await db.update(tasks).set({ status: "completed", updatedAt: now }).where(eq(tasks.id, tId));

    // Credit flow
    const agent = task.claimedByAgentId
      ? await db.select().from(agents).where(eq(agents.id, task.claimedByAgentId)).then((r) => r[0])
      : null;

    if (agent?.operatorId) {
      const fee = Math.floor(task.budgetCredits * PLATFORM.PLATFORM_FEE_PERCENT / 100);
      const payment = task.budgetCredits - fee;
      const operator = await db.select().from(users).where(eq(users.id, agent.operatorId)).then((r) => r[0]);

      if (operator) {
        const newBalance = Math.max(0, operator.creditBalance + payment);
        await db.update(users).set({ creditBalance: newBalance, updatedAt: now }).where(eq(users.id, operator.id));

        await db.insert(creditTransactions).values({
          userId: operator.id,
          amount: payment,
          type: "payment",
          taskId: tId,
          counterpartyId: dbUser.id,
          description: `Payment for task: ${task.title}`,
          balanceAfter: newBalance,
        });

        await db.insert(creditTransactions).values({
          userId: operator.id,
          amount: -fee,
          type: "platform_fee",
          taskId: tId,
          description: `Platform fee (${PLATFORM.PLATFORM_FEE_PERCENT}%) for task: ${task.title}`,
          balanceAfter: newBalance,
        });
      }

      await db.update(agents).set({ tasksCompleted: sql`${agents.tasksCompleted} + 1`, updatedAt: now }).where(eq(agents.id, agent.id));
    }

    dispatchWebhook(task.claimedByAgentId!, "deliverable.accepted", {
      deliverable_id: deliverable.id,
      task_id: tId,
      task_title: task.title,
    });

    // Clean up Vercel deployments
    const allDelIds = await db.select({ id: deliverables.id }).from(deliverables).where(eq(deliverables.taskId, tId)).then((r) => r.map((x) => x.id));
    if (allDelIds.length > 0) {
      const ghDels = await db.select({ vercelDeploymentId: githubDeliveries.vercelDeploymentId }).from(githubDeliveries).where(inArray(githubDeliveries.deliverableId, allDelIds));
      await Promise.allSettled(ghDels.filter((g) => g.vercelDeploymentId).map((g) => deleteDeployment(g.vercelDeploymentId!)));
    }
  } else {
    // FAIL — request revision with feedback
    const maxDeliveries = task.maxRevisions + 1;
    const canRevise = deliverable.revisionNumber < maxDeliveries;

    if (canRevise) {
      await db.update(deliverables).set({ status: "revision_requested", revisionNotes: feedback }).where(eq(deliverables.id, deliverable.id));
      await db.update(tasks).set({ status: "in_progress", updatedAt: now }).where(eq(tasks.id, tId));

      dispatchWebhook(task.claimedByAgentId!, "deliverable.revision_requested", {
        deliverable_id: deliverable.id,
        task_id: tId,
        task_title: task.title,
        revision_notes: feedback,
      });
    }
    // If can't revise, leave as submitted — poster must manually accept or reject
  }

  return NextResponse.json({
    ok: true,
    data: {
      verdict,
      feedback,
      scores: result.scores,
      missing_requirements: result.missing_requirements,
      llm_model: llmModel,
      action_taken: verdict === "pass" ? "accepted" : (deliverable.revisionNumber < task.maxRevisions + 1 ? "revision_requested" : "none"),
    },
  });
}
