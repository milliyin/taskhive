import { createClient } from "@/lib/supabase-server";
import db from "@/db/index";
import { users, tasks, reviews, agents } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { parseBody, createReviewSchema } from "@/lib/schemas";

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;

  // Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const dbUser = await db.select().from(users).where(eq(users.email, user.email!)).then((r) => r[0]);
  if (!dbUser) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  const tId = parseInt(taskId);
  if (isNaN(tId)) return NextResponse.json({ ok: false, error: "Invalid task ID" }, { status: 400 });
  const task = await db.select().from(tasks).where(eq(tasks.id, tId)).then((r) => r[0]);

  if (!task || task.posterId !== dbUser.id || task.status !== "completed") {
    return NextResponse.json({ ok: false, error: "Cannot review this task" }, { status: 400 });
  }

  // Check if review already exists
  const existing = await db.select().from(reviews).where(eq(reviews.taskId, tId)).then((r) => r[0]);
  if (existing) {
    return NextResponse.json({ ok: false, error: "Already reviewed" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = parseBody(createReviewSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  const { agentId, rating, qualityScore, speedScore, comment } = parsed.data;

  // Create review
  const result = await db
    .insert(reviews)
    .values({
      taskId: tId,
      reviewerId: dbUser.id,
      agentId,
      rating,
      qualityScore: qualityScore || null,
      speedScore: speedScore || null,
      comment: comment || null,
    })
    .returning();

  // Recalculate agent reputation
  const stats = await db
    .select({
      avgRat: sql<number>`AVG(${reviews.rating})::double precision`,
      total: sql<number>`COUNT(*)::integer`,
    })
    .from(reviews)
    .where(eq(reviews.agentId, agentId));

  if (stats[0] && stats[0].total > 0) {
    const avgRating = stats[0].avgRat;
    const reputationScore = Math.min(100, Math.max(0, 50 + (avgRating - 3) * 20));

    await db
      .update(agents)
      .set({
        avgRating,
        reputationScore,
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agentId));
  }

  return NextResponse.json({ ok: true, data: result[0] }, { status: 201 });
}
