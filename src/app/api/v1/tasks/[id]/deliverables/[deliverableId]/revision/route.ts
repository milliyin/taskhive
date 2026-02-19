// Location: src/app/api/v1/tasks/[id]/deliverables/[deliverableId]/revision/route.ts — POST request revision
import { authenticateAgent, apiSuccess, apiError, withRateHeaders } from "@/lib/agent-auth";
import db from "@/db/index";
import { tasks, deliverables, agents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { dispatchWebhook } from "@/lib/webhook-dispatcher";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; deliverableId: string }> }) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { agent, rateHeaders } = auth;

  const { id, deliverableId } = await params;
  const taskId = parseInt(id, 10);
  const dId = parseInt(deliverableId, 10);

  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).then((r) => r[0]);
  if (!task) return apiError(404, "TASK_NOT_FOUND", `Task ${taskId} does not exist`, "Use GET /api/v1/tasks");

  const callingAgent = await db.select().from(agents).where(eq(agents.id, agent.id)).then((r) => r[0]);
  if (task.posterId !== callingAgent!.operatorId) {
    return apiError(403, "FORBIDDEN", "Only the task poster can request revisions", "Restricted to task poster");
  }

  if (task.status !== "delivered") {
    return apiError(409, "INVALID_STATUS", `Task is not in delivered state (status: ${task.status})`, "Wait for submission");
  }

  const del = await db.select().from(deliverables).where(eq(deliverables.id, dId)).then((r) => r[0]);
  if (!del || del.taskId !== taskId) {
    return apiError(404, "DELIVERABLE_NOT_FOUND", `Deliverable ${dId} not found`, "Check deliverables list");
  }

  if (del.status !== "submitted") {
    return apiError(409, "INVALID_STATUS", `Deliverable is ${del.status}, not submitted`, "Only submitted deliverables can be revised");
  }

  // Max revisions check: revision_number must be < max_revisions + 1
  const maxDeliveries = task.maxRevisions + 1;
  if (del.revisionNumber >= maxDeliveries) {
    return apiError(409, "MAX_REVISIONS",
      `Max revisions exhausted (${del.revisionNumber} of ${maxDeliveries} deliveries used)`,
      "You must accept or reject this deliverable. No more revisions allowed."
    );
  }

  const body = await request.json();
  const { revision_notes } = body;

  if (!revision_notes || !revision_notes.trim()) {
    return apiError(422, "VALIDATION_ERROR", "revision_notes is required", "Describe what changes are needed");
  }

  await db.update(deliverables).set({ status: "revision_requested", revisionNotes: revision_notes.trim() }).where(eq(deliverables.id, dId));
  await db.update(tasks).set({ status: "in_progress", updatedAt: new Date() }).where(eq(tasks.id, taskId));

  dispatchWebhook(task.claimedByAgentId!, "deliverable.revision_requested", {
    deliverable_id: dId,
    task_id: taskId,
    task_title: task.title,
    revision_notes,
  });

  return withRateHeaders(
    apiSuccess({ task_id: taskId, deliverable_id: dId, status: "revision_requested" }),
    rateHeaders
  );
}
