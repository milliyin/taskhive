// Dashboard API: POST /api/tasks/[taskId]/submit-work — unified deliverable submission
// Handles: delivery notes, file uploads, and optional GitHub repo (with smart Vercel deploy)
import { getUser } from "@/lib/auth";
import db from "@/db/index";
import { tasks, agents, deliverables, deliverableFiles, githubDeliveries } from "@/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { uploadFile, classifyFileType, isAllowedMimeType, DELIVERABLES_BUCKET, MAX_DELIVERABLE_FILE_SIZE } from "@/lib/storage";
import { parseGitHubUrl, validateRepoExists, validateRepoDeployable } from "@/services/github-utils";
import { parseEnvFile, encryptEnvVars } from "@/services/env-parser";
import { createGitDeployment, deleteDeployment } from "@/services/vercel-deploy";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { dbUser } = await getUser();
  const { taskId: tid } = await params;
  const taskId = parseInt(tid, 10);
  if (isNaN(taskId)) return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });

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

  // Parse form data
  const formData = await request.formData();
  const content = (formData.get("content") as string || "").trim();
  const files = formData.getAll("files") as File[];
  const repoUrl = (formData.get("repoUrl") as string || "").trim();
  const branch = (formData.get("branch") as string || "").trim() || undefined;
  const envFile = formData.get("envFile") as File | null;

  if (!content && files.length === 0 && !repoUrl) {
    return NextResponse.json({ error: "Provide notes, files, or a GitHub link" }, { status: 400 });
  }

  // ── Validate GitHub if provided ───────────────────────────────────
  let ghParsed: { owner: string; repo: string } | null = null;
  let isDeployable = false;
  let envVars: Record<string, string> = {};
  let envVarsEncryptedStr: string | null = null;

  if (repoUrl) {
    ghParsed = parseGitHubUrl(repoUrl);
    if (!ghParsed) {
      return NextResponse.json({ error: "Invalid GitHub URL format. Use https://github.com/owner/repo" }, { status: 422 });
    }

    const exists = await validateRepoExists(ghParsed.owner, ghParsed.repo);
    if (!exists) {
      return NextResponse.json({ error: "Repository not found or not public" }, { status: 422 });
    }

    const deployCheck = await validateRepoDeployable(ghParsed.owner, ghParsed.repo, branch);
    isDeployable = deployCheck.deployable;

    // Parse .env file if provided
    if (envFile && envFile.size > 0) {
      const envContent = await envFile.text();
      envVars = parseEnvFile(envContent);
      if (Object.keys(envVars).length > 0) {
        envVarsEncryptedStr = encryptEnvVars(envVars);
      }
    }
  }

  // ── Delete old Vercel deployments (best-effort) ───────────────────
  if (repoUrl) {
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
  }

  // ── Build deliverable content ─────────────────────────────────────
  let deliverableContent = content;
  if (repoUrl && !content) {
    deliverableContent = `GitHub repo: ${repoUrl}${branch ? ` (branch: ${branch})` : ""}`;
  } else if (repoUrl && content) {
    deliverableContent = `${content}\n\nGitHub repo: ${repoUrl}${branch ? ` (branch: ${branch})` : ""}`;
  }

  // ── Create deliverable ────────────────────────────────────────────
  const [d] = await db
    .insert(deliverables)
    .values({
      taskId,
      agentId: agent.id,
      content: deliverableContent || "",
      revisionNumber,
    })
    .returning();

  // ── Upload files ──────────────────────────────────────────────────
  const uploadedFiles: Array<{ id: number; name: string; file_type: string; size_bytes: number; public_url: string | null }> = [];
  for (const file of files) {
    if (!isAllowedMimeType(file.type)) continue;
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_DELIVERABLE_FILE_SIZE) continue;

    const storagePath = `${taskId}/${d.id}/${Date.now()}-${file.name}`;
    try {
      const { publicUrl } = await uploadFile(DELIVERABLES_BUCKET, storagePath, buffer, file.type);
      const fileType = classifyFileType(file.type, file.name);

      const [inserted] = await db.insert(deliverableFiles).values({
        deliverableId: d.id,
        taskId,
        agentId: agent.id,
        storagePath,
        originalName: file.name,
        mimeType: file.type,
        sizeBytes: buffer.length,
        fileType,
        publicUrl,
      }).returning();

      uploadedFiles.push({
        id: inserted.id,
        name: inserted.originalName,
        file_type: inserted.fileType,
        size_bytes: inserted.sizeBytes,
        public_url: inserted.publicUrl,
      });
    } catch {
      // skip failed uploads
    }
  }

  // ── Handle GitHub delivery ────────────────────────────────────────
  let github: { previewUrl: string | null; deployStatus: string; sourceRepoUrl: string; sourceBranch: string } | null = null;

  if (repoUrl && ghParsed) {
    if (isDeployable) {
      // Deployable → create record + deploy to Vercel
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

        github = {
          previewUrl: result.url,
          deployStatus: "deploying",
          sourceRepoUrl: repoUrl,
          sourceBranch: branch || "main",
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Deployment failed";
        await db.update(githubDeliveries).set({
          deployStatus: "error",
          errorMessage,
          updatedAt: new Date(),
        }).where(eq(githubDeliveries.id, ghDelivery.id));

        github = {
          previewUrl: null,
          deployStatus: "error",
          sourceRepoUrl: repoUrl,
          sourceBranch: branch || "main",
        };
      }
    } else {
      // Not deployable → store link only, no Vercel deploy
      await db
        .insert(githubDeliveries)
        .values({
          deliverableId: d.id,
          sourceRepoUrl: repoUrl,
          sourceBranch: branch || null,
          deployStatus: "skipped",
        })
        .returning();

      github = {
        previewUrl: null,
        deployStatus: "skipped",
        sourceRepoUrl: repoUrl,
        sourceBranch: branch || "main",
      };
    }
  }

  // ── Update task status ────────────────────────────────────────────
  await db.update(tasks).set({ status: "delivered", updatedAt: new Date() }).where(eq(tasks.id, taskId));

  return NextResponse.json({
    ok: true,
    deliverable: {
      id: d.id,
      revisionNumber: d.revisionNumber,
      content: d.content,
      files: uploadedFiles,
      github,
    },
  }, { status: 201 });
}
