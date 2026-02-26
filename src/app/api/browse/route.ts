// Dashboard API: GET /api/browse — browse all open tasks
import { getUser } from "@/lib/auth";
import db from "@/db/index";
import { tasks, categories, users } from "@/db/schema";
import { eq, and, gte, lte, desc, asc, sql, SQL } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  await getUser(); // auth check

  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q");
  const categoryId = searchParams.get("category");
  const minBudget = searchParams.get("min_budget");
  const maxBudget = searchParams.get("max_budget");
  const sort = searchParams.get("sort") || "newest";
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10) || 20, 100);
  const offset = parseInt(searchParams.get("offset") || "0", 10) || 0;

  const conditions: SQL[] = [eq(tasks.status, "open")];

  // Full-text search
  if (query && query.trim().length > 0) {
    const sanitized = query
      .trim()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .map((w) => `${w}:*`)
      .join(" & ");
    if (sanitized) {
      conditions.push(
        sql`(
          to_tsvector('english', coalesce(${tasks.title}, '') || ' ' || coalesce(${tasks.description}, ''))
          @@ to_tsquery('english', ${sanitized})
        )`
      );
    }
  }

  if (categoryId) {
    const id = parseInt(categoryId, 10);
    if (!isNaN(id)) conditions.push(eq(tasks.categoryId, id));
  }
  if (minBudget) {
    const min = parseInt(minBudget, 10);
    if (!isNaN(min)) conditions.push(gte(tasks.budgetCredits, min));
  }
  if (maxBudget) {
    const max = parseInt(maxBudget, 10);
    if (!isNaN(max)) conditions.push(lte(tasks.budgetCredits, max));
  }
  if (searchParams.get("unclaimed") === "true") {
    conditions.push(
      sql`(SELECT COUNT(*)::integer FROM task_claims WHERE task_claims.task_id = tasks.id) = 0`
    );
  }

  let orderBy;
  switch (sort) {
    case "oldest": orderBy = [asc(tasks.createdAt)]; break;
    case "budget_high": orderBy = [desc(tasks.budgetCredits)]; break;
    case "budget_low": orderBy = [asc(tasks.budgetCredits)]; break;
    default: orderBy = [desc(tasks.createdAt)];
  }

  const [results, countResult, allCategories] = await Promise.all([
    db
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
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)::integer` })
      .from(tasks)
      .where(and(...conditions)),
    db.select().from(categories).orderBy(categories.sortOrder),
  ]);

  return NextResponse.json({
    tasks: results.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      budgetCredits: row.budgetCredits,
      status: row.status,
      deadline: row.deadline,
      maxRevisions: row.maxRevisions,
      createdAt: row.createdAt,
      category: row.categoryId ? { id: row.categoryId, name: row.categoryName, slug: row.categorySlug } : null,
      poster: { id: row.posterId, name: row.posterName },
      claimsCount: row.claimsCount || 0,
    })),
    categories: allCategories,
    total: countResult[0]?.count || 0,
  });
}
