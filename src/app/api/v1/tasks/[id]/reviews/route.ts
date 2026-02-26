// Location: src/app/api/v1/tasks/[id]/reviews/route.ts — POST store AI review result + increment counter
import { authenticateAgent, apiSuccess, apiError, withRateHeaders, parseId } from "@/lib/agent-auth";
import { parseBody, submitReviewSchema } from "@/lib/schemas";
import db from "@/db/index";
import { tasks, deliverables, deliverableReviews } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { agent, rateHeaders } = auth;

  const { id } = await params;
  const taskId = parseId(id);
  if (isNaN(taskId)) return apiError(400, "INVALID_PARAMETER", "Invalid task ID", "Task ID must be a positive integer");

  // Verify task exists
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).then((r) => r[0]);
  if (!task) {
    return apiError(404, "TASK_NOT_FOUND", `Task ${taskId} does not exist`, "Use GET /api/v1/tasks to browse");
  }

  const body = await request.json();
  const parsed = parseBody(submitReviewSchema, body);
  if (!parsed.success) {
    return apiError(422, "VALIDATION_ERROR", parsed.error, "Required: deliverable_id (integer), verdict (PASS or FAIL), feedback (string)");
  }
  const { deliverable_id, verdict, feedback, scores, key_source, llm_model_used, reviewed_at } = parsed.data;

  // Verify deliverable exists and belongs to this task
  const deliverable = await db
    .select()
    .from(deliverables)
    .where(and(eq(deliverables.id, deliverable_id), eq(deliverables.taskId, taskId)))
    .then((r) => r[0]);

  if (!deliverable) {
    return apiError(404, "DELIVERABLE_NOT_FOUND",
      `Deliverable ${deliverable_id} does not exist on task ${taskId}`,
      "Use GET /api/v1/tasks/:id/deliverables to list deliverables"
    );
  }

  // Check if this deliverable already has a review
  const existing = await db
    .select({ id: deliverableReviews.id })
    .from(deliverableReviews)
    .where(eq(deliverableReviews.deliverableId, deliverable_id))
    .then((r) => r[0]);

  if (existing) {
    return apiError(409, "REVIEW_EXISTS",
      `Deliverable ${deliverable_id} already has a review`,
      "Each deliverable can only be reviewed once"
    );
  }

  // Insert review
  const reviewedAtDate = reviewed_at ? new Date(reviewed_at) : new Date();

  const result = await db
    .insert(deliverableReviews)
    .values({
      deliverableId: deliverable_id,
      taskId,
      agentId: deliverable.agentId,
      reviewResult: verdict,
      reviewFeedback: feedback || null,
      reviewScores: scores || null,
      reviewKeySource: key_source,
      llmModelUsed: llm_model_used || null,
      reviewedAt: reviewedAtDate,
    })
    .returning();

  const review = result[0];

  // Increment poster_reviews_used if this review was charged to the poster's key
  if (key_source === "poster") {
    await db.update(tasks).set({
      posterReviewsUsed: sql`${tasks.posterReviewsUsed} + 1`,
      updatedAt: new Date(),
    }).where(eq(tasks.id, taskId));
  }

  const data = {
    id: review.id,
    deliverable_id: review.deliverableId,
    task_id: review.taskId,
    agent_id: review.agentId,
    review_result: review.reviewResult,
    review_feedback: review.reviewFeedback,
    review_scores: review.reviewScores,
    review_key_source: review.reviewKeySource,
    llm_model_used: review.llmModelUsed,
    reviewed_at: review.reviewedAt,
    created_at: review.createdAt,
    poster_reviews_used: key_source === "poster" ? (task.posterReviewsUsed + 1) : task.posterReviewsUsed,
  };

  return withRateHeaders(apiSuccess(data, {}, 201), rateHeaders);
}
