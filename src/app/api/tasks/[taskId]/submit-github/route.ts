// Dashboard API: POST /api/tasks/[taskId]/submit-github — deploy GitHub repo as deliverable
import { getUser } from "@/lib/auth";
import db from "@/db/index";
import { tasks, agents, deliverables, githubDeliveries } from "@/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { parseBody, submitGitHubDeliverySchema } from "@/lib/schemas";
import { parseGitHubUrl, validateRepoExists } from "@/services/github-utils";
import { parseEnvFile, encryptEnvVars } from "@/services/env-parser";
import { createGitDeployment, deleteDeployment } from "@/services/vercel-deploy";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { dbUser } = await getUser();
  const { taskId: tid } = await params;
  const taskId = parseInt(tid, 10);
  if (isNaN(taskId))
    return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });

  // Get task
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).then((r) => r[0]);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  // Verify user is the operator of the assigned agent
  if (!task.claimedByAgentId) {
    return NextResponse.json({ error: "Task has no assigned agent" }, { status: 400 });
  }
  const agent = await db.select().from(agents).where(eq(agents.id, task.claimedByAgentId)).then((r) => r[0]);
  if (!agent || agent.operatorId !== dbUser.id) {
    return NextResponse.json({ error: "You are not the operator of the assigned agent" }, { status: 403 });
  }

  // Check task status
  if (!["claimed", "in_progress"].includes(task.status)) {
    return NextResponse.json({ error: `Cannot submit work when task status is '${task.status}'` }, { status: 409 });
  }

  // Check no pending deliverable
  const pending = await db
    .select()
    .from(deliverables)
    .where(and(eq(deliverables.taskId, taskId), eq(deliverables.status, "submitted")));
  if (pending.length > 0) {
    return NextResponse.json({ error: "A deliverable is already submitted and awaiting review" }, { status: 409 });
  }

  // Check revision count
  const existingCount = await db
    .select({ count: sql<number>`COUNT(*)::integer` })
    .from(deliverables)
    .where(eq(deliverables.taskId, taskId));
  const revisionNumber = (existingCount[0]?.count || 0) + 1;
  if (revisionNumber > task.maxRevisions + 1) {
    return NextResponse.json({ error: "Maximum revisions reached" }, { status: 409 });
  }

  // Parse FormData
  const formData = await request.formData();
  const repoUrl = (formData.get("repoUrl") as string || "").trim();
  const branch = (formData.get("branch") as string || "").trim() || undefined;
  const envFile = formData.get("envFile") as File | null;

  // Validate GitHub URL
  const parsed = parseBody(submitGitHubDeliverySchema, { repoUrl, branch });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 422 });
  }

  const ghParsed = parseGitHubUrl(repoUrl);
  if (!ghParsed) {
    return NextResponse.json({ error: "Invalid GitHub URL format" }, { status: 422 });
  }

  // Check repo exists
  const exists = await validateRepoExists(ghParsed.owner, ghParsed.repo);
  if (!exists) {
    return NextResponse.json({ error: "Repository not found or not public" }, { status: 422 });
  }

  // Parse .env file if provided
  let envVars: Record<string, string> = {};
  let envVarsEncryptedStr: string | null = null;
  if (envFile && envFile.size > 0) {
    const envContent = await envFile.text();
    envVars = parseEnvFile(envContent);
    if (Object.keys(envVars).length > 0) {
      envVarsEncryptedStr = encryptEnvVars(envVars);
    }
  }

  // Delete old Vercel deployments for this task (best-effort)
  const oldDeliverableIds = await db
    .select({ id: deliverables.id })
    .from(deliverables)
    .where(eq(deliverables.taskId, taskId))
    .then((rows) => rows.map((r) => r.id));
  if (oldDeliverableIds.length > 0) {
    const oldGhDeliveries = await db
      .select({ vercelDeploymentId: githubDeliveries.vercelDeploymentId })
      .from(githubDeliveries)
      .where(inArray(githubDeliveries.deliverableId, oldDeliverableIds));
    await Promise.allSettled(
      oldGhDeliveries
        .filter((g) => g.vercelDeploymentId)
        .map((g) => deleteDeployment(g.vercelDeploymentId!))
    );
  }

  // Create deliverable record
  const [d] = await db
    .insert(deliverables)
    .values({
      taskId,
      agentId: agent.id,
      content: `GitHub repo: ${repoUrl}${branch ? ` (branch: ${branch})` : ""}`,
      revisionNumber,
    })
    .returning();

  // Create github_deliveries record
  const [ghDelivery] = await db
    .insert(githubDeliveries)
    .values({
      deliverableId: d.id,
      sourceRepoUrl: repoUrl,
      sourceBranch: branch || null,
      deployStatus: "pending",
      envVarsEncrypted: envVarsEncryptedStr,
    })
    .returning();

  // Update task status
  await db.update(tasks).set({ status: "delivered", updatedAt: new Date() }).where(eq(tasks.id, taskId));

  // Deploy to Vercel
  try {
    const result = await createGitDeployment(
      ghParsed.owner,
      ghParsed.repo,
      branch || "main",
      Object.keys(envVars).length > 0 ? envVars : undefined
    );

    await db.update(githubDeliveries).set({
      vercelDeploymentId: result.id,
      previewUrl: result.url,
      deployStatus: "deploying",
      updatedAt: new Date(),
    }).where(eq(githubDeliveries.id, ghDelivery.id));

    return NextResponse.json({
      ok: true,
      deliverable: {
        id: d.id,
        revisionNumber: d.revisionNumber,
        github: {
          previewUrl: result.url,
          deployStatus: "deploying",
        },
      },
    }, { status: 201 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Deployment failed";

    await db.update(githubDeliveries).set({
      deployStatus: "error",
      errorMessage,
      updatedAt: new Date(),
    }).where(eq(githubDeliveries.id, ghDelivery.id));

    // Revert task status
    await db.update(tasks).set({ status: task.status, updatedAt: new Date() }).where(eq(tasks.id, taskId));
    await db.update(deliverables).set({
      status: "rejected",
      revisionNotes: `Deploy failed: ${errorMessage}`,
    }).where(eq(deliverables.id, d.id));

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
