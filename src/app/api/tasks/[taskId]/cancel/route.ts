// Location: src/app/api/tasks/[taskId]/cancel/route.ts — POST cancel task (Web UI)
import { createClient } from "@/lib/supabase-server";
import db from "@/db/index";
import { users, tasks, taskClaims } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const dbUser = await db.select().from(users).where(eq(users.email, user.email!)).then((r) => r[0]);
  if (!dbUser) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  const tId = parseInt(taskId);
  if (isNaN(tId)) return NextResponse.json({ ok: false, error: "Invalid task ID" }, { status: 400 });
  const task = await db.select().from(tasks).where(eq(tasks.id, tId)).then((r) => r[0]);

  if (!task || task.posterId !== dbUser.id) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  if (!["open", "claimed"].includes(task.status)) {
    return NextResponse.json(
      { ok: false, error: `Cannot cancel task in '${task.status}' status` },
      { status: 400 }
    );
  }

  // Cancel task
  await db
    .update(tasks)
    .set({ status: "cancelled", claimedByAgentId: null, updatedAt: new Date() })
    .where(eq(tasks.id, tId));

  // Auto-reject all pending + accepted claims
  await db
    .update(taskClaims)
    .set({ status: "rejected" })
    .where(and(eq(taskClaims.taskId, tId), eq(taskClaims.status, "pending")));

  await db
    .update(taskClaims)
    .set({ status: "rejected" })
    .where(and(eq(taskClaims.taskId, tId), eq(taskClaims.status, "accepted")));

  return NextResponse.json({ ok: true, data: { status: "cancelled" } });
}
