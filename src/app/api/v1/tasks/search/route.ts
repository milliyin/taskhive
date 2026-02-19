// Location: src/app/api/v1/tasks/search/route.ts — Full-text search on tasks
import { authenticateAgent, apiSuccess, apiError, withRateHeaders } from "@/lib/agent-auth";
import db from "@/db/index";
import { tasks, categories, users } from "@/db/schema";
import { eq, and, sql, desc, lt, SQL } from "drizzle-orm";

export async function GET(request: Request) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { rateHeaders } = auth;

  const { searchParams } = new URL(request.url);

  const query = searchParams.get("q");
  const status = searchParams.get("status") || "open";
  const categoryId = searchParams.get("category");
  const minBudget = searchParams.get("min_budget");
  const maxBudget = searchParams.get("max_budget");
  const cursor = searchParams.get("cursor");
  const limitParam = parseInt(searchParams.get("limit") || "20", 10);

  // Validate query
  if (!query || query.trim().length === 0) {
    return apiError(400, "INVALID_PARAMETER",
      "Search query is required",
      "Include ?q=your+search+terms",
      rateHeaders
    );
  }

  if (query.length > 200) {
    return apiError(400, "INVALID_PARAMETER",
      "Search query must be 200 characters or fewer",
      "Shorten your search query",
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

  // Build search query — convert user input to tsquery format
  // Split on spaces, join with & for AND matching, add :* for prefix matching
  const sanitized = query
    .trim()
    .replace(/[^\w\s]/g, " ")    // Remove special chars
    .split(/\s+/)                 // Split on whitespace
    .filter((w) => w.length > 0)  // Remove empty
    .map((w) => `${w}:*`)         // Prefix matching
    .join(" & ");                  // AND logic

  if (!sanitized) {
    return apiError(400, "INVALID_PARAMETER",
      "Search query contains no valid terms",
      "Use alphanumeric search terms",
      rateHeaders
    );
  }

  // Build conditions
  const conditions: SQL[] = [
    eq(tasks.status, status as typeof tasks.status.enumValues[number]),
    sql`(
      to_tsvector('english', coalesce(${tasks.title}, '') || ' ' || coalesce(${tasks.description}, ''))
      @@ to_tsquery('english', ${sanitized})
    )`,
  ];

  if (categoryId) conditions.push(eq(tasks.categoryId, parseInt(categoryId, 10)));
  if (minBudget) conditions.push(sql`${tasks.budgetCredits} >= ${parseInt(minBudget, 10)}`);
  if (maxBudget) conditions.push(sql`${tasks.budgetCredits} <= ${parseInt(maxBudget, 10)}`);

  // Cursor pagination
  if (cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
      conditions.push(lt(tasks.id, decoded.id));
    } catch {
      return apiError(400, "INVALID_PARAMETER",
        "Invalid cursor",
        "Use the cursor value from a previous response",
        rateHeaders
      );
    }
  }

  // Query with relevance ranking
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
      rank: sql<number>`ts_rank(
        to_tsvector('english', coalesce(${tasks.title}, '') || ' ' || coalesce(${tasks.description}, '')),
        to_tsquery('english', ${sanitized})
      )`,
    })
    .from(tasks)
    .leftJoin(categories, eq(tasks.categoryId, categories.id))
    .leftJoin(users, eq(tasks.posterId, users.id))
    .where(and(...conditions))
    .orderBy(
      desc(sql`ts_rank(
        to_tsvector('english', coalesce(${tasks.title}, '') || ' ' || coalesce(${tasks.description}, '')),
        to_tsquery('english', ${sanitized})
      )`),
      desc(tasks.id)
    )
    .limit(limitParam + 1);

  const hasMore = results.length > limitParam;
  const page = hasMore ? results.slice(0, limitParam) : results;

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
    relevance: Math.round((row.rank || 0) * 1000) / 1000,
  }));

  const lastItem = page[page.length - 1];
  const nextCursor = hasMore && lastItem
    ? Buffer.from(JSON.stringify({ id: lastItem.id })).toString("base64")
    : null;

  const res = apiSuccess(data, {
    query,
    cursor: nextCursor,
    has_more: hasMore,
    count: data.length,
  });

  return withRateHeaders(res, rateHeaders);
}