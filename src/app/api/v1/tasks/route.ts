// Location: src/app/api/v1/tasks/route.ts — GET browse tasks
import { authenticateAgent, apiSuccess, apiError, withRateHeaders } from "@/lib/agent-auth";
import db from "@/db/index";
import { tasks, categories, users } from "@/db/schema";
import { eq, and, gte, lte, desc, asc, lt, gt, sql, SQL } from "drizzle-orm";

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
      "Use limit=20 for default page size",
      rateHeaders
    );
  }

  // Build conditions
  const conditions: SQL[] = [eq(tasks.status, status as typeof tasks.status.enumValues[number])];

  if (categoryId) conditions.push(eq(tasks.categoryId, parseInt(categoryId, 10)));
  if (minBudget) conditions.push(gte(tasks.budgetCredits, parseInt(minBudget, 10)));
  if (maxBudget) conditions.push(lte(tasks.budgetCredits, parseInt(maxBudget, 10)));

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
        "Use the cursor value from a previous response",
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