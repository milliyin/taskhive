// Location: src/app/api/tasks/[taskId]/claims/[claimId]/route.js — PATCH accept/reject claim
import { createClient } from "@/lib/supabase-server";
import db from "@/db/index";
import { users, tasks, taskClaims } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function PATCH(request, { params }) {
  const { taskId, claimId } = await params;

  // ─── Auth ───────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await db.select().from(users).where(eq(users.email, user.email)).then((r) => r[0]);
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // ─── Verify task ownership ──────────────────────────────────────────
  const tId = parseInt(taskId);
  const task = await db.select().from(tasks).where(eq(tasks.id, tId)).then((r) => r[0]);
  if (!task || task.posterId !== dbUser.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (task.status !== "open") {
    return NextResponse.json({ error: "Task is not open" }, { status: 400 });
  }

  // ─── Get claim ─────────────────────────────────────────────────────
  const cId = parseInt(claimId);
  const claim = await db.select().from(taskClaims).where(eq(taskClaims.id, cId)).then((r) => r[0]);
  if (!claim || claim.taskId !== tId) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  if (claim.status !== "pending") {
    return NextResponse.json({ error: `Claim is already ${claim.status}` }, { status: 400 });
  }

  const body = await request.json();
  const { action } = body;

  // ═══════════════════════════════════════════════════════════════════
  // ACCEPT CLAIM
  // ═══════════════════════════════════════════════════════════════════
  if (action === "accept") {
    // 1. Accept this claim
    await db.update(taskClaims).set({ status: "accepted" }).where(eq(taskClaims.id, cId));

    // 2. Reject all other pending claims
    await db
      .update(taskClaims)
      .set({ status: "rejected" })
      .where(
        and(
          eq(taskClaims.taskId, tId),
          ne(taskClaims.id, cId),
          eq(taskClaims.status, "pending")
        )
      );

    // 3. Update task status + assign agent
    await db
      .update(tasks)
      .set({
        status: "claimed",
        claimedByAgentId: claim.agentId,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, tId));

    return NextResponse.json({ success: true, status: "claimed", agentId: claim.agentId });
  }

  // ═══════════════════════════════════════════════════════════════════
  // REJECT CLAIM
  // ═══════════════════════════════════════════════════════════════════
  if (action === "reject") {
    await db.update(taskClaims).set({ status: "rejected" }).where(eq(taskClaims.id, cId));
    return NextResponse.json({ success: true, status: "rejected" });
  }

  return NextResponse.json({ error: "Invalid action. Use: accept or reject" }, { status: 400 });
}