import { createClient } from "@/lib/supabase-server";
import db from "@/db/index";
import { users, tasks, webhooks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { PLATFORM } from "@/lib/constants";
import { dispatchWebhook } from "@/lib/webhook-dispatcher";
import { encrypt } from "@/lib/encryption";

export async function POST(request: Request) {
  // 1. Authenticate
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // 2. Get DB user
  const dbUser = await db
    .select()
    .from(users)
    .where(eq(users.email, user.email!))
    .then((r) => r[0]);

  if (!dbUser) {
    return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
  }

  // 3. Parse & validate
  const body = await request.json();
  const { title, description, budgetCredits, categoryId, deadline, maxRevisions,
    autoReviewEnabled, posterLlmKey, posterLlmProvider, posterMaxReviews } = body;

  const errors: string[] = [];

  if (!title || title.length < 5 || title.length > 200)
    errors.push("Title must be 5–200 characters");
  if (!description || description.length < 20 || description.length > 5000)
    errors.push("Description must be 20–5000 characters");
  if (!budgetCredits || budgetCredits < PLATFORM.MIN_TASK_BUDGET)
    errors.push(`Budget must be at least ${PLATFORM.MIN_TASK_BUDGET} credits`);
  if (deadline && new Date(deadline) <= new Date())
    errors.push("Deadline must be in the future");
  if (maxRevisions !== undefined && (maxRevisions < 0 || maxRevisions > 5))
    errors.push("Max revisions must be 0–5");

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, error: errors.join(". ") }, { status: 400 });
  }

  // 4. Create task — no credits locked or deducted
  const taskValues: Record<string, unknown> = {
    posterId: dbUser.id,
    title,
    description,
    budgetCredits,
    categoryId: categoryId ? parseInt(categoryId, 10) : null,
    deadline: deadline ? new Date(deadline) : null,
    maxRevisions: maxRevisions ?? PLATFORM.MAX_REVISIONS_DEFAULT,
  };

  // Auto-review settings
  if (autoReviewEnabled) {
    taskValues.autoReviewEnabled = true;
    if (posterLlmProvider) taskValues.posterLlmProvider = posterLlmProvider;
    if (posterLlmKey) taskValues.posterLlmKeyEncrypted = encrypt(posterLlmKey);
    if (posterMaxReviews) taskValues.posterMaxReviews = parseInt(posterMaxReviews, 10);
  }

  const result = await db
    .insert(tasks)
    .values(taskValues as typeof tasks.$inferInsert)
    .returning();

  const newTask = result[0];

  // Fire task.new_match to all agents with active webhooks
  const agentsWithHooks = await db
    .select({ agentId: webhooks.agentId })
    .from(webhooks)
    .where(eq(webhooks.isActive, true))
    .groupBy(webhooks.agentId);

  // Await so webhooks fire before Vercel freezes the function
  await Promise.allSettled(
    agentsWithHooks.map(({ agentId }) =>
      dispatchWebhook(agentId, "task.new_match", {
        task_id: newTask.id,
        title: newTask.title,
        budget_credits: newTask.budgetCredits,
        category_id: newTask.categoryId,
      })
    )
  );

  return NextResponse.json({ ok: true, data: newTask }, { status: 201 });
}