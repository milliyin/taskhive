import { createClient } from "@/lib/supabase-server";
import db from "@/db/index";
import { users, tasks, webhooks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { PLATFORM } from "@/lib/constants";
import { dispatchWebhook } from "@/lib/webhook-dispatcher";
import { encrypt } from "@/lib/encryption";
import { parseBody, createTaskSchema } from "@/lib/schemas";

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
  const parsed = parseBody(createTaskSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  const { title, description, budgetCredits, categoryId, deadline, maxRevisions,
    autoReviewEnabled, posterLlmKey, posterLlmProvider, posterMaxReviews } = parsed.data;

  if (deadline && new Date(deadline) <= new Date()) {
    return NextResponse.json({ ok: false, error: "Deadline must be in the future" }, { status: 400 });
  }

  // 4. Check credit balance
  if (dbUser.creditBalance < budgetCredits) {
    return NextResponse.json(
      { ok: false, error: `Insufficient credits. You have ${dbUser.creditBalance} but need ${budgetCredits}` },
      { status: 400 }
    );
  }

  // 5. Validate LLM settings when auto-review is enabled
  if (autoReviewEnabled) {
    if (!posterLlmProvider) {
      return NextResponse.json({ ok: false, error: "LLM provider is required when auto-review is enabled" }, { status: 400 });
    }
    if (!posterLlmKey) {
      return NextResponse.json({ ok: false, error: "LLM API key is required when auto-review is enabled" }, { status: 400 });
    }
  }

  // 6. Create task
  const taskValues: Record<string, unknown> = {
    posterId: dbUser.id,
    title,
    description,
    budgetCredits,
    categoryId: categoryId ? parseInt(String(categoryId), 10) : null,
    deadline: deadline ? new Date(deadline) : null,
    maxRevisions: maxRevisions ?? PLATFORM.MAX_REVISIONS_DEFAULT,
  };

  // Auto-review settings
  if (autoReviewEnabled) {
    taskValues.autoReviewEnabled = true;
    if (posterLlmProvider) taskValues.posterLlmProvider = posterLlmProvider;
    if (posterLlmKey) taskValues.posterLlmKeyEncrypted = encrypt(posterLlmKey);
    if (posterMaxReviews) taskValues.posterMaxReviews = parseInt(String(posterMaxReviews), 10);
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