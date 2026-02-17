import { createClient } from "@/lib/supabase-server";
import db from "@/db/index";
import { users, tasks, deliverables, agents, creditTransactions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { PLATFORM } from "@/lib/constants";

export async function PATCH(request, { params }) {
  const { taskId, deliverableId } = await params;

  // ─── Auth ───────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await db.select().from(users).where(eq(users.email, user.email)).then((r) => r[0]);
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // ─── Verify task ownership ──────────────────────────────────────────
  const task = await db.select().from(tasks).where(eq(tasks.id, parseInt(taskId))).then((r) => r[0]);
  if (!task || task.posterId !== dbUser.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (task.status !== "delivered") {
    return NextResponse.json({ error: "Task is not in delivered state" }, { status: 400 });
  }

  // ─── Get deliverable ───────────────────────────────────────────────
  const dId = parseInt(deliverableId);
  const deliverable = await db.select().from(deliverables).where(eq(deliverables.id, dId)).then((r) => r[0]);
  if (!deliverable || deliverable.taskId !== task.id) {
    return NextResponse.json({ error: "Deliverable not found" }, { status: 404 });
  }
  if (deliverable.status !== "submitted") {
    return NextResponse.json({ error: "Deliverable is not in submitted state" }, { status: 400 });
  }

  const body = await request.json();
  const { action, revisionNotes } = body;

  // ═══════════════════════════════════════════════════════════════════
  // 5a: ACCEPT
  // ═══════════════════════════════════════════════════════════════════
  if (action === "accept") {
    // 1. Deliverable → accepted
    await db.update(deliverables).set({ status: "accepted" }).where(eq(deliverables.id, dId));

    // 2. Task → completed
    await db.update(tasks).set({ status: "completed", updatedAt: new Date() }).where(eq(tasks.id, task.id));

    // 3. Credit flow
    const agent = await db.select().from(agents).where(eq(agents.id, task.claimedByAgentId)).then((r) => r[0]);

    if (agent) {
      const fee = Math.floor(task.budgetCredits * PLATFORM.PLATFORM_FEE_PERCENT / 100);
      const payment = task.budgetCredits - fee;

      // Get operator
      const operator = await db.select().from(users).where(eq(users.id, agent.operatorId)).then((r) => r[0]);

      if (operator) {
        const newBalance = operator.creditBalance + payment;

        // Update operator balance
        await db
          .update(users)
          .set({ creditBalance: newBalance, updatedAt: new Date() })
          .where(eq(users.id, operator.id));

        // 4. Log payment transaction
        await db.insert(creditTransactions).values({
          userId: operator.id,
          amount: payment,
          type: "payment",
          taskId: task.id,
          counterpartyId: dbUser.id,
          description: `Payment for task: ${task.title}`,
          balanceAfter: newBalance,
        });

        // Log platform fee (for tracking — not deducted from anyone)
        await db.insert(creditTransactions).values({
          userId: operator.id,
          amount: -fee,
          type: "platform_fee",
          taskId: task.id,
          description: `Platform fee (${PLATFORM.PLATFORM_FEE_PERCENT}%) for task: ${task.title}`,
          balanceAfter: newBalance, // fee is already excluded from payment
        });
      }

      // 5. Increment agent's tasks_completed
      await db
        .update(agents)
        .set({
          tasksCompleted: sql`${agents.tasksCompleted} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, agent.id));
    }

    return NextResponse.json({ success: true, status: "completed" });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 5b: REQUEST REVISION
  // ═══════════════════════════════════════════════════════════════════
  if (action === "revision") {
    // Precondition: revision_number < max_revisions + 1
    if (deliverable.revisionNumber >= task.maxRevisions + 1) {
      return NextResponse.json(
        { error: "Max revisions exhausted. You can only accept or reject." },
        { status: 400 }
      );
    }

    if (!revisionNotes || !revisionNotes.trim()) {
      return NextResponse.json(
        { error: "Revision notes are required" },
        { status: 400 }
      );
    }

    // 1. Deliverable → revision_requested
    await db
      .update(deliverables)
      .set({ status: "revision_requested", revisionNotes: revisionNotes.trim() })
      .where(eq(deliverables.id, dId));

    // 2. Task → in_progress
    await db
      .update(tasks)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(eq(tasks.id, task.id));

    return NextResponse.json({ success: true, status: "in_progress" });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 5c: REJECT (FINAL) — only if max revisions exhausted
  // ═══════════════════════════════════════════════════════════════════
  if (action === "reject") {
    if (deliverable.revisionNumber < task.maxRevisions + 1) {
      return NextResponse.json(
        { error: "Cannot reject until max revisions are exhausted. Request a revision instead." },
        { status: 400 }
      );
    }

    // 1. Deliverable → rejected
    await db.update(deliverables).set({ status: "rejected" }).where(eq(deliverables.id, dId));

    // 2. Task → disputed
    await db
      .update(tasks)
      .set({ status: "disputed", updatedAt: new Date() })
      .where(eq(tasks.id, task.id));

    return NextResponse.json({ success: true, status: "disputed" });
  }

  return NextResponse.json({ error: "Invalid action. Use: accept, revision, or reject" }, { status: 400 });
}