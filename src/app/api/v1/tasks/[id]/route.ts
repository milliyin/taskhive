// Location: src/app/api/v1/tasks/[id]/route.ts — GET task details
import { authenticateAgent, apiSuccess, apiError, withRateHeaders, parseId } from "@/lib/agent-auth";
import db from "@/db/index";
import { tasks, categories, users, taskClaims, deliverables } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { rateHeaders } = auth;

  const { id } = await params;
  const taskId = parseId(id);
  if (isNaN(taskId)) return apiError(400, "INVALID_PARAMETER", "Invalid task ID", "Task ID must be a positive integer");

  const result = await db
    .select({
      task: tasks,
      categoryId: categories.id,
      categoryName: categories.name,
      categorySlug: categories.slug,
      posterName: users.name,
      posterId: users.id,
    })
    .from(tasks)
    .leftJoin(categories, eq(tasks.categoryId, categories.id))
    .leftJoin(users, eq(tasks.posterId, users.id))
    .where(eq(tasks.id, taskId));

  if (result.length === 0) {
    return apiError(404, "TASK_NOT_FOUND",
      `Task ${taskId} does not exist`,
      "Use GET /api/v1/tasks to browse available tasks"
    );
  }

  const row = result[0];
  const t = row.task;

  const claimsCount = await db
    .select({ count: sql<number>`COUNT(*)::integer` })
    .from(taskClaims)
    .where(eq(taskClaims.taskId, taskId));

  const deliverablesCount = await db
    .select({ count: sql<number>`COUNT(*)::integer` })
    .from(deliverables)
    .where(eq(deliverables.taskId, taskId));

  const data = {
    id: t.id,
    title: t.title,
    description: t.description,
    requirements: t.requirements,
    budget_credits: t.budgetCredits,
    category: row.categoryId ? {
      id: row.categoryId,
      name: row.categoryName,
      slug: row.categorySlug,
    } : null,
    status: t.status,
    poster: { id: row.posterId, name: row.posterName },
    claimed_by_agent_id: t.claimedByAgentId,
    claims_count: claimsCount[0]?.count || 0,
    deliverables_count: deliverablesCount[0]?.count || 0,
    deadline: t.deadline,
    max_revisions: t.maxRevisions,
    // Auto-review fields (never expose encrypted key)
    auto_review_enabled: t.autoReviewEnabled,
    poster_llm_provider: t.posterLlmProvider,
    poster_max_reviews: t.posterMaxReviews,
    poster_reviews_used: t.posterReviewsUsed,
    created_at: t.createdAt,
  };

  return withRateHeaders(apiSuccess(data), rateHeaders);
}
