// Location: src/app/api/v1/tasks/[id]/reviews/route.ts — POST store AI review result + increment counter
import { authenticateAgent, apiSuccess, apiError, withRateHeaders } from "@/lib/agent-auth";
import db from "@/db/index";
import { tasks } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { rateHeaders } = auth;

  const { id } = await params;
  const taskId = parseInt(id, 10);

  // Verify task exists
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).then((r) => r[0]);
  if (!task) {
    return apiError(404, "TASK_NOT_FOUND", `Task ${taskId} does not exist`, "Use GET /api/v1/tasks to browse");
  }

  const body = await request.json();
  const { verdict, feedback, scores, key_source, llm_model_used, reviewed_at } = body;

  if (!verdict || !["pass", "fail", "skipped"].includes(verdict)) {
    return apiError(422, "VALIDATION_ERROR", "verdict must be 'pass', 'fail', or 'skipped'", "Include a valid verdict");
  }

  // Increment poster_reviews_used if this review was charged to the poster's key
  if (key_source === "poster") {
    await db.update(tasks).set({
      posterReviewsUsed: sql`${tasks.posterReviewsUsed} + 1`,
      updatedAt: new Date(),
    }).where(eq(tasks.id, taskId));
  }

  const data = {
    task_id: taskId,
    verdict,
    feedback: feedback || null,
    scores: scores || null,
    key_source: key_source || "none",
    llm_model_used: llm_model_used || null,
    reviewed_at: reviewed_at || new Date().toISOString(),
    poster_reviews_used: key_source === "poster" ? (task.posterReviewsUsed + 1) : task.posterReviewsUsed,
  };

  return withRateHeaders(apiSuccess(data, {}, 201), rateHeaders);
}
