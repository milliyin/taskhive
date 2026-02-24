// Location: src/app/api/tasks/[taskId]/deliverables/[deliverableId]/route.ts — PATCH accept/revision/reject
import { createClient } from "@/lib/supabase-server";
import db from "@/db/index";
import { users, tasks, deliverables, agents, creditTransactions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { PLATFORM } from "@/lib/constants";
import { dispatchWebhook } from "@/lib/webhook-dispatcher";
import { parseBody, deliverableActionSchema } from "@/lib/schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ taskId: string; deliverableId: string }> }) {
  const { taskId, deliverableId } = await params;

  // ─── Auth ───────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const dbUser = await db.select().from(users).where(eq(users.email, user.email!)).then((r) => r[0]);
  if (!dbUser) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  // ─── Verify task ownership ──────────────────────────────────────────
  const tId = parseInt(taskId);
  if (isNaN(tId)) return NextResponse.json({ ok: false, error: "Invalid task ID" }, { status: 400 });
  const task = await db.select().from(tasks).where(eq(tasks.id, tId)).then((r) => r[0]);
  if (!task || task.posterId !== dbUser.id) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  if (task.status !== "delivered") {
    return NextResponse.json({ ok: false, error: "Task is not in delivered state" }, { status: 400 });
  }

  // ─── Get deliverable ───────────────────────────────────────────────
  const dId = parseInt(deliverableId);
  if (isNaN(dId)) return NextResponse.json({ ok: false, error: "Invalid deliverable ID" }, { status: 400 });
  const deliverable = await db.select().from(deliverables).where(eq(deliverables.id, dId)).then((r) => r[0]);
  if (!deliverable || deliverable.taskId !== task.id) {
    return NextResponse.json({ ok: false, error: "Deliverable not found" }, { status: 404 });
  }
  if (deliverable.status !== "submitted") {
    return NextResponse.json({ ok: false, error: "Deliverable is not in submitted state" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = parseBody(deliverableActionSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  const { action, revisionNotes } = parsed.data;

  const maxDeliveries = task.maxRevisions + 1;
  const revisionsExhausted = deliverable.revisionNumber >= maxDeliveries;

  // ═══════════════════════════════════════════════════════════════════
  // 5a: ACCEPT — always allowed on submitted deliverable
  // ═══════════════════════════════════════════════════════════════════
  if (action === "accept") {
    // 1. Deliverable → accepted
    await db.update(deliverables).set({ status: "accepted" }).where(eq(deliverables.id, dId));

    // 2. Task → completed
    await db.update(tasks).set({ status: "completed", updatedAt: new Date() }).where(eq(tasks.id, task.id));

    // 3. Credit flow — credits are minted, not deducted from poster
    const agent = await db.select().from(agents).where(eq(agents.id, task.claimedByAgentId!)).then((r) => r[0]);

    if (agent) {
      const fee = Math.floor(task.budgetCredits * PLATFORM.PLATFORM_FEE_PERCENT / 100);
      const payment = task.budgetCredits - fee;

      const operator = agent.operatorId ? await db.select().from(users).where(eq(users.id, agent.operatorId)).then((r) => r[0]) : null;

      if (operator) {
        // Ensure balance never goes negative (it shouldn't since we only add)
        const newBalance = Math.max(0, operator.creditBalance + payment);

        await db
          .update(users)
          .set({ creditBalance: newBalance, updatedAt: new Date() })
          .where(eq(users.id, operator.id));

        // Log payment
        await db.insert(creditTransactions).values({
          userId: operator.id,
          amount: payment,
          type: "payment",
          taskId: task.id,
          counterpartyId: dbUser.id,
          description: `Payment for task: ${task.title}`,
          balanceAfter: newBalance,
        });

        // Log platform fee (tracking only)
        await db.insert(creditTransactions).values({
          userId: operator.id,
          amount: fee,
          type: "platform_fee",
          taskId: task.id,
          description: `Platform fee (${PLATFORM.PLATFORM_FEE_PERCENT}%) for task: ${task.title}`,
          balanceAfter: newBalance,
        });
      }

      // Increment tasks_completed
      await db
        .update(agents)
        .set({ tasksCompleted: sql`${agents.tasksCompleted} + 1`, updatedAt: new Date() })
        .where(eq(agents.id, agent.id));
    }

    dispatchWebhook(task.claimedByAgentId!, "deliverable.accepted", {
      deliverable_id: dId,
      task_id: task.id,
      task_title: task.title,
      payment: task.budgetCredits - Math.floor(task.budgetCredits * PLATFORM.PLATFORM_FEE_PERCENT / 100),
    });

    return NextResponse.json({ ok: true, data: { status: "completed" } });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 5b: REQUEST REVISION — only if revisions NOT exhausted
  // ═══════════════════════════════════════════════════════════════════
  if (action === "revision") {
    if (revisionsExhausted) {
      return NextResponse.json(
        { ok: false, error: "Max revisions exhausted. You can only accept or reject." },
        { status: 400 }
      );
    }

    if (!revisionNotes || !revisionNotes.trim()) {
      return NextResponse.json(
        { ok: false, error: "Revision notes are required" },
        { status: 400 }
      );
    }

    await db
      .update(deliverables)
      .set({ status: "revision_requested", revisionNotes: revisionNotes.trim() })
      .where(eq(deliverables.id, dId));

    await db
      .update(tasks)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(eq(tasks.id, task.id));

    dispatchWebhook(task.claimedByAgentId!, "deliverable.revision_requested", {
      deliverable_id: dId,
      task_id: task.id,
      task_title: task.title,
      revision_notes: revisionNotes,
    });

    return NextResponse.json({ ok: true, data: { status: "in_progress" } });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 5c: REJECT (FINAL) — only if max revisions exhausted
  // ═══════════════════════════════════════════════════════════════════
  if (action === "reject") {
    if (!revisionsExhausted) {
      return NextResponse.json(
        { ok: false, error: "Cannot reject until max revisions are exhausted. Request a revision instead." },
        { status: 400 }
      );
    }

    await db.update(deliverables).set({ status: "rejected" }).where(eq(deliverables.id, dId));
    await db
      .update(tasks)
      .set({ status: "disputed", updatedAt: new Date() })
      .where(eq(tasks.id, task.id));

    return NextResponse.json({ ok: true, data: { status: "disputed" } });
  }
}
