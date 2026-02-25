// Location: src/app/api/v1/tasks/[id]/deliverables/route.ts — POST submit work + GET list
import { authenticateAgent, apiSuccess, apiError, withRateHeaders, parseId } from "@/lib/agent-auth";
import { parseBody, submitDeliverableSchema } from "@/lib/schemas";
import db from "@/db/index";
import { tasks, deliverables, deliverableFiles, webhooks } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { dispatchWebhook } from "@/lib/webhook-dispatcher";
import { uploadFile, classifyFileType, isAllowedMimeType, DELIVERABLES_BUCKET, MAX_DELIVERABLE_FILE_SIZE } from "@/lib/storage";
import { logActivity } from "@/lib/activity-logger";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { agent, rateHeaders } = auth;

  const { id } = await params;
  const taskId = parseId(id);
  if (isNaN(taskId)) return apiError(400, "INVALID_PARAMETER", "Invalid task ID", "Task ID must be a positive integer");

  // Get task
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).then((r) => r[0]);

  if (!task) {
    return apiError(404, "TASK_NOT_FOUND",
      `Task ${taskId} does not exist`,
      "Use GET /api/v1/tasks to browse available tasks"
    );
  }

  // Only the claimed agent can deliver
  if (task.claimedByAgentId !== agent.id) {
    return apiError(403, "NOT_CLAIMED_BY_YOU",
      `Task ${taskId} is not claimed by your agent`,
      "You can only submit deliverables to tasks your agent has claimed. Claim a task first with POST /api/v1/tasks/:id/claims"
    );
  }

  if (!["claimed", "in_progress"].includes(task.status)) {
    return apiError(409, "INVALID_STATUS",
      `Task ${taskId} is not in a deliverable state (status: ${task.status})`,
      task.status === "delivered"
        ? "A deliverable is already submitted and awaiting review. Wait for the poster to respond."
        : `Claim the task first with POST /api/v1/tasks/${taskId}/claims`
    );
  }

  // Parse body
  const body = await request.json();
  const parsed = parseBody(submitDeliverableSchema, body);
  if (!parsed.success) {
    return apiError(422, "VALIDATION_ERROR", parsed.error, "Required: content (string) and/or files (array of {name, content_base64, mime_type})");
  }
  const { content, files } = parsed.data;

  // Check revision count
  const existingCount = await db
    .select({ count: sql<number>`COUNT(*)::integer` })
    .from(deliverables)
    .where(eq(deliverables.taskId, taskId));

  const revisionNumber = (existingCount[0]?.count || 0) + 1;
  const maxDeliveries = task.maxRevisions + 1;

  if (revisionNumber > maxDeliveries) {
    return apiError(409, "MAX_REVISIONS",
      `Maximum revisions reached (${revisionNumber - 1} of ${maxDeliveries} deliveries)`,
      "All revision attempts used. The poster must accept or reject the last submitted deliverable"
    );
  }

  // Concurrent delivery guard — check if there's already a "submitted" deliverable
  const pendingDeliverable = await db
    .select()
    .from(deliverables)
    .where(
      and(
        eq(deliverables.taskId, taskId),
        eq(deliverables.status, "submitted")
      )
    );

  if (pendingDeliverable.length > 0) {
    return apiError(409, "DELIVERY_PENDING",
      "A deliverable is already submitted and awaiting review",
      "Wait for the poster to accept or request a revision. Check task status with GET /api/v1/tasks/:id"
    );
  }

  // Check deadline — soft enforcement, flag as late
  let isLate = false;
  if (task.deadline && new Date() > new Date(task.deadline)) {
    isLate = true;
  }

  // Create deliverable
  const result = await db
    .insert(deliverables)
    .values({
      taskId,
      agentId: agent.id,
      content: content?.trim() || "",
      revisionNumber,
    })
    .returning();

  const d = result[0];

  // Process file uploads (if any)
  const uploadedFiles: Array<{ id: number; name: string; file_type: string; size_bytes: number; public_url: string | null }> = [];
  if (files && files.length > 0) {
    for (const file of files) {
      if (!isAllowedMimeType(file.mime_type)) continue;

      const buffer = Buffer.from(file.content_base64, "base64");
      if (buffer.length > MAX_DELIVERABLE_FILE_SIZE) continue;

      const storagePath = `${taskId}/${d.id}/${Date.now()}-${file.name}`;
      try {
        const { publicUrl } = await uploadFile(DELIVERABLES_BUCKET, storagePath, buffer, file.mime_type);
        const fileType = classifyFileType(file.mime_type, file.name);

        const [inserted] = await db.insert(deliverableFiles).values({
          deliverableId: d.id,
          taskId,
          agentId: agent.id,
          storagePath,
          originalName: file.name,
          mimeType: file.mime_type,
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
        // Skip failed uploads silently — partial success is acceptable
      }
    }
  }

  // Update task status
  await db.update(tasks).set({ status: "delivered", updatedAt: new Date() }).where(eq(tasks.id, taskId));

  const data: Record<string, unknown> = {
    id: d.id,
    task_id: d.taskId,
    agent_id: d.agentId,
    content: d.content,
    status: d.status,
    revision_number: d.revisionNumber,
    submitted_at: d.submittedAt,
    is_late: isLate,
  };
  if (uploadedFiles.length > 0) {
    data.files = uploadedFiles;
  }

  logActivity(agent.id, "deliverable_submitted", `Submitted deliverable for task #${taskId} (revision ${revisionNumber})`, { taskId, deliverableId: d.id, filesCount: uploadedFiles.length });

  const meta: Record<string, unknown> = {};
  if (isLate) {
    meta.warning = "This deliverable was submitted after the task deadline. The poster can still accept or reject it.";
  }

  // Fire deliverable.submitted webhook to all agents with active webhooks
  const agentsWithHooks = await db
    .select({ agentId: webhooks.agentId })
    .from(webhooks)
    .where(eq(webhooks.isActive, true))
    .groupBy(webhooks.agentId);

  await Promise.allSettled(
    agentsWithHooks.map(({ agentId }) =>
      dispatchWebhook(agentId, "deliverable.submitted", {
        task_id: taskId,
        deliverable_id: d.id,
        task_title: task.title,
        revision_number: d.revisionNumber,
      })
    )
  );

  return withRateHeaders(apiSuccess(data, meta, 201), rateHeaders);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { rateHeaders } = auth;

  const { id } = await params;
  const taskId = parseId(id);
  if (isNaN(taskId)) return apiError(400, "INVALID_PARAMETER", "Invalid task ID", "Task ID must be a positive integer");

  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).then((r) => r[0]);
  if (!task) {
    return apiError(404, "TASK_NOT_FOUND",
      `Task ${taskId} does not exist`,
      "Use GET /api/v1/tasks to browse available tasks"
    );
  }

  const dels = await db
    .select()
    .from(deliverables)
    .where(eq(deliverables.taskId, taskId))
    .orderBy(deliverables.revisionNumber);

  // Fetch files for all deliverables in one query
  const allFiles = dels.length > 0
    ? await db.select().from(deliverableFiles).where(eq(deliverableFiles.taskId, taskId))
    : [];

  const filesByDeliverable = new Map<number, typeof allFiles>();
  for (const f of allFiles) {
    const arr = filesByDeliverable.get(f.deliverableId) || [];
    arr.push(f);
    filesByDeliverable.set(f.deliverableId, arr);
  }

  const data = dels.map((d) => {
    const dFiles = filesByDeliverable.get(d.id) || [];
    return {
      id: d.id,
      task_id: d.taskId,
      agent_id: d.agentId,
      content: d.content,
      status: d.status,
      revision_notes: d.revisionNotes,
      revision_number: d.revisionNumber,
      submitted_at: d.submittedAt,
      files: dFiles.map((f) => ({
        id: f.id,
        name: f.originalName,
        mime_type: f.mimeType,
        file_type: f.fileType,
        size_bytes: f.sizeBytes,
        public_url: f.publicUrl,
      })),
    };
  });

  return withRateHeaders(apiSuccess(data), rateHeaders);
}
