// Dashboard API: POST /api/tasks/[taskId]/sync-github — re-deploy latest from same GitHub repo
import { getUser } from "@/lib/auth";
import db from "@/db/index";
import { tasks, agents, deliverables, githubDeliveries } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { parseGitHubUrl } from "@/services/github-utils";
import { decryptEnvVars } from "@/services/env-parser";
import { createGitDeployment } from "@/services/vercel-deploy";

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

  // Find latest github delivery for this task
  const latestDeliverable = await db
    .select({ id: deliverables.id })
    .from(deliverables)
    .where(eq(deliverables.taskId, taskId))
    .orderBy(desc(deliverables.submittedAt))
    .limit(1)
    .then((r) => r[0]);

  if (!latestDeliverable) {
    return NextResponse.json({ error: "No deliverable found for this task" }, { status: 404 });
  }

  const ghDelivery = await db
    .select()
    .from(githubDeliveries)
    .where(eq(githubDeliveries.deliverableId, latestDeliverable.id))
    .then((r) => r[0]);

  if (!ghDelivery) {
    return NextResponse.json({ error: "No GitHub delivery found" }, { status: 404 });
  }

  // Guard: not already deploying
  if (ghDelivery.deployStatus === "deploying") {
    return NextResponse.json({ error: "A deployment is already in progress" }, { status: 409 });
  }

  // Parse repo URL
  const ghParsed = parseGitHubUrl(ghDelivery.sourceRepoUrl);
  if (!ghParsed) {
    return NextResponse.json({ error: "Invalid stored GitHub URL" }, { status: 500 });
  }

  // Decrypt stored env vars
  let envVars: Record<string, string> | undefined;
  if (ghDelivery.envVarsEncrypted) {
    try {
      envVars = decryptEnvVars(ghDelivery.envVarsEncrypted);
    } catch {
      return NextResponse.json({ error: "Failed to decrypt environment variables" }, { status: 500 });
    }
  }

  // Deploy
  try {
    const result = await createGitDeployment(
      ghParsed.owner,
      ghParsed.repo,
      ghDelivery.sourceBranch || "main",
      envVars && Object.keys(envVars).length > 0 ? envVars : undefined
    );

    await db.update(githubDeliveries).set({
      vercelDeploymentId: result.id,
      previewUrl: result.url,
      deployStatus: "deploying",
      errorMessage: null,
      updatedAt: new Date(),
    }).where(eq(githubDeliveries.id, ghDelivery.id));

    return NextResponse.json({
      ok: true,
      github: {
        previewUrl: result.url,
        deployStatus: "deploying",
      },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Deployment failed";

    await db.update(githubDeliveries).set({
      deployStatus: "error",
      errorMessage,
      updatedAt: new Date(),
    }).where(eq(githubDeliveries.id, ghDelivery.id));

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
