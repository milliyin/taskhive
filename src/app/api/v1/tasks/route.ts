// Location: src/app/api/v1/tasks/route.ts — GET browse tasks + POST create task
import { authenticateAgent, apiSuccess, apiError, withRateHeaders, parseIntParam, getIdempotentResponse, storeIdempotentResponse } from "@/lib/agent-auth";
import { parseBody, createTaskV1Schema } from "@/lib/schemas";
import db from "@/db/index";
import { tasks, categories, users, webhooks } from "@/db/schema";
import { eq, and, gte, lte, desc, asc, lt, gt, sql, SQL } from "drizzle-orm";
import { PLATFORM } from "@/lib/constants";
import { dispatchWebhook } from "@/lib/webhook-dispatcher";
import { encrypt } from "@/lib/encryption";

export async function GET(request: Request) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { rateHeaders } = auth;

  const { searchParams } = new URL(request.url);

  // Parse params
  const status = searchParams.get("status") || "open";
  const categoryId = searchParams.get("category");
  const minBudget = searchParams.get("min_budget");
  const maxBudget = searchParams.get("max_budget");
  const sort = searchParams.get("sort") || "newest";
  const cursor = searchParams.get("cursor");
  const limitParam = parseInt(searchParams.get("limit") || "20", 10);

  // Validate sort
  const validSorts = ["newest", "oldest", "budget_high", "budget_low"];
  if (!validSorts.includes(sort)) {
    return apiError(400, "INVALID_PARAMETER",
      `Invalid sort value: '${sort}'`,
      `Valid sort values: ${validSorts.join(", ")}`,
      rateHeaders
    );
  }

  // Validate limit
  if (isNaN(limitParam) || limitParam < 1 || limitParam > 100) {
    return apiError(400, "INVALID_PARAMETER",
      "limit must be between 1 and 100",
      "Omit the limit parameter to use the default (20), or set ?limit=50 for larger pages",
      rateHeaders
    );
  }

  // Build conditions
  const conditions: SQL[] = [eq(tasks.status, status as typeof tasks.status.enumValues[number])];

  if (categoryId) {
    const catId = parseIntParam(categoryId);
    if (catId !== null && !isNaN(catId)) conditions.push(eq(tasks.categoryId, catId));
  }
  if (minBudget) {
    const min = parseIntParam(minBudget);
    if (min !== null && !isNaN(min)) conditions.push(gte(tasks.budgetCredits, min));
  }
  if (maxBudget) {
    const max = parseIntParam(maxBudget);
    if (max !== null && !isNaN(max)) conditions.push(lte(tasks.budgetCredits, max));
  }

  // Decode cursor
  if (cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
      if (sort === "newest" || sort === "budget_high") {
        conditions.push(lt(tasks.id, decoded.id));
      } else {
        conditions.push(gt(tasks.id, decoded.id));
      }
    } catch {
      return apiError(400, "INVALID_PARAMETER",
        "Invalid cursor",
        "Do not construct cursors manually. Use the meta.cursor value from a previous GET /api/v1/tasks response",
        rateHeaders
      );
    }
  }

  // Sort
  let orderBy;
  switch (sort) {
    case "newest": orderBy = [desc(tasks.createdAt), desc(tasks.id)]; break;
    case "oldest": orderBy = [asc(tasks.createdAt), asc(tasks.id)]; break;
    case "budget_high": orderBy = [desc(tasks.budgetCredits), desc(tasks.id)]; break;
    case "budget_low": orderBy = [asc(tasks.budgetCredits), asc(tasks.id)]; break;
    default: orderBy = [desc(tasks.createdAt), desc(tasks.id)];
  }

  // Single query with inline claims count subquery (no N+1)
  const results = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      budgetCredits: tasks.budgetCredits,
      status: tasks.status,
      deadline: tasks.deadline,
      maxRevisions: tasks.maxRevisions,
      createdAt: tasks.createdAt,
      categoryId: categories.id,
      categoryName: categories.name,
      categorySlug: categories.slug,
      posterId: users.id,
      posterName: users.name,
      claimsCount: sql<number>`(SELECT COUNT(*)::integer FROM task_claims WHERE task_claims.task_id = tasks.id)`,
    })
    .from(tasks)
    .leftJoin(categories, eq(tasks.categoryId, categories.id))
    .leftJoin(users, eq(tasks.posterId, users.id))
    .where(and(...conditions))
    .orderBy(...orderBy)
    .limit(limitParam + 1);

  const hasMore = results.length > limitParam;
  const page = hasMore ? results.slice(0, limitParam) : results;

  // Map results — no extra queries needed
  const data = page.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    budget_credits: row.budgetCredits,
    category: row.categoryId ? {
      id: row.categoryId,
      name: row.categoryName,
      slug: row.categorySlug,
    } : null,
    status: row.status,
    poster: { id: row.posterId, name: row.posterName },
    claims_count: row.claimsCount || 0,
    deadline: row.deadline,
    max_revisions: row.maxRevisions,
    created_at: row.createdAt,
  }));

  // Build cursor
  const lastItem = page[page.length - 1];
  const nextCursor = hasMore && lastItem
    ? Buffer.from(JSON.stringify({ id: lastItem.id })).toString("base64")
    : null;

  const res = apiSuccess(data, {
    cursor: nextCursor,
    has_more: hasMore,
    count: data.length,
  });

  return withRateHeaders(res, rateHeaders);
}

export async function POST(request: Request) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { agent, rateHeaders, idempotencyKey } = auth;

  // [IDEMPOTENCY] Check cache
  if (idempotencyKey) {
    const cached = getIdempotentResponse(agent.id, idempotencyKey);
    if (cached) return withRateHeaders(cached, rateHeaders);
  }

  // Parse & validate body
  const body = await request.json();
  const parsed = parseBody(createTaskV1Schema, body);
  if (!parsed.success) {
    return apiError(422, "VALIDATION_ERROR", parsed.error, "Required: title (5-200 chars), description (20-5000 chars), budget_credits (integer). Optional: category_id, requirements, deadline (ISO 8601), max_revisions (0-5)", rateHeaders);
  }

  const { title, description, budget_credits, category_id, requirements, deadline, max_revisions,
    auto_review_enabled, poster_llm_provider, poster_llm_key, poster_max_reviews } = parsed.data;

  // Validate deadline is in the future
  if (deadline && new Date(deadline) <= new Date()) {
    return apiError(422, "INVALID_DEADLINE", "Deadline must be in the future", "Use a future ISO 8601 date, e.g. \"2025-12-31T23:59:59Z\"", rateHeaders);
  }

  // Validate category exists (if provided)
  if (category_id) {
    const cat = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, category_id)).then((r) => r[0]);
    if (!cat) {
      return apiError(404, "CATEGORY_NOT_FOUND", `Category ${category_id} does not exist`, "Omit category_id to post without a category, or check available categories on the dashboard", rateHeaders);
    }
  }

  // Check operator's credit balance
  const operator = await db.select().from(users).where(eq(users.id, agent.operatorId)).then((r) => r[0]);
  if (!operator) {
    return apiError(404, "USER_NOT_FOUND", "Agent operator not found", "Your agent's operator account may have been deleted. Contact support via the dashboard", rateHeaders);
  }
  if (operator.creditBalance < budget_credits) {
    return apiError(422, "INSUFFICIENT_CREDITS",
      `Insufficient credits. Balance: ${operator.creditBalance}, required: ${budget_credits}`,
      "Top up credits on the dashboard or reduce budget_credits to fit your balance",
      rateHeaders
    );
  }

  // Validate auto-review settings
  if (auto_review_enabled) {
    if (!poster_llm_provider) {
      return apiError(422, "MISSING_LLM_PROVIDER", "poster_llm_provider is required when auto_review_enabled is true",
        "Set poster_llm_provider to 'openrouter', 'anthropic', or 'openai'", rateHeaders);
    }
    if (!poster_llm_key) {
      return apiError(422, "MISSING_LLM_KEY", "poster_llm_key is required when auto_review_enabled is true",
        "Provide your LLM API key. It will be encrypted at rest and only used for auto-review", rateHeaders);
    }
  }

  // Create task — poster is the agent's operator
  const taskValues: Record<string, unknown> = {
    posterId: agent.operatorId,
    title,
    description,
    requirements: requirements || null,
    budgetCredits: budget_credits,
    categoryId: category_id || null,
    deadline: deadline ? new Date(deadline) : null,
    maxRevisions: max_revisions ?? PLATFORM.MAX_REVISIONS_DEFAULT,
  };

  if (auto_review_enabled) {
    taskValues.autoReviewEnabled = true;
    if (poster_llm_provider) taskValues.posterLlmProvider = poster_llm_provider;
    if (poster_llm_key) taskValues.posterLlmKeyEncrypted = encrypt(poster_llm_key);
    if (poster_max_reviews) taskValues.posterMaxReviews = poster_max_reviews;
  }

  const result = await db
    .insert(tasks)
    .values(taskValues as typeof tasks.$inferInsert)
    .returning();

  const t = result[0];

  const data = {
    id: t.id,
    title: t.title,
    description: t.description,
    requirements: t.requirements,
    budget_credits: t.budgetCredits,
    category_id: t.categoryId,
    status: t.status,
    poster_id: t.posterId,
    deadline: t.deadline,
    max_revisions: t.maxRevisions,
    auto_review_enabled: t.autoReviewEnabled,
    poster_llm_provider: t.posterLlmProvider || null,
    poster_max_reviews: t.posterMaxReviews || null,
    created_at: t.createdAt,
  };

  // Fire task.new_match webhook to all agents with active webhooks
  const agentsWithHooks = await db
    .select({ agentId: webhooks.agentId })
    .from(webhooks)
    .where(eq(webhooks.isActive, true))
    .groupBy(webhooks.agentId);

  await Promise.allSettled(
    agentsWithHooks.map(({ agentId }) =>
      dispatchWebhook(agentId, "task.new_match", {
        task_id: t.id,
        title: t.title,
        budget_credits: t.budgetCredits,
        category_id: t.categoryId,
      })
    )
  );

  const response = withRateHeaders(apiSuccess(data, {}, 201), rateHeaders);

  // [IDEMPOTENCY] Store response
  if (idempotencyKey) {
    const responseBody = JSON.stringify({
      ok: true,
      data,
      meta: { timestamp: new Date().toISOString() },
    });
    storeIdempotentResponse(agent.id, idempotencyKey, response, responseBody);
  }

  return response;
}