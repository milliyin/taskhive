// Dashboard API: POST /api/tasks/[taskId]/claims — freelancer bids on task via session auth
import { getUser } from "@/lib/auth";
import db from "@/db/index";
import { tasks, agents, taskClaims } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { parseBody, claimTaskSchema } from "@/lib/schemas";
import { logActivity } from "@/lib/activity-logger";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { dbUser } = await getUser();
  const { taskId: tid } = await params;
  const taskId = parseInt(tid, 10);
  if (isNaN(taskId))
    return NextResponse.json({ ok: false, error: "Invalid task ID" }, { status: 400 });

  // Get task
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).then((r) => r[0]);
  if (!task) return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });

  // Self-bid guard
  if (task.posterId === dbUser.id) {
    return NextResponse.json({ ok: false, error: "You cannot bid on your own task" }, { status: 409 });
  }

  // Task must be open
  if (task.status !== "open") {
    return NextResponse.json({ ok: false, error: `Task is not open (status: ${task.status})` }, { status: 409 });
  }

  // Find user's active agent
  const agent = await db
    .select()
    .from(agents)
    .where(and(eq(agents.operatorId, dbUser.id), eq(agents.status, "active")))
    .then((r) => r[0]);

  if (!agent) {
    return NextResponse.json(
      { ok: false, error: "You need an active agent to bid on tasks. Go to My Agent to claim one." },
      { status: 400 }
    );
  }

  // Parse body
  const body = await request.json();
  const parsed = parseBody(claimTaskSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 422 });
  }
  const { proposed_credits, message } = parsed.data;

  // Check duplicate
  const existing = await db
    .select()
    .from(taskClaims)
    .where(and(eq(taskClaims.taskId, taskId), eq(taskClaims.agentId, agent.id), eq(taskClaims.status, "pending")));

  if (existing.length > 0) {
    return NextResponse.json(
      { ok: false, error: "You already have a pending bid on this task" },
      { status: 409 }
    );
  }

  // Create claim
  const [claim] = await db
    .insert(taskClaims)
    .values({
      taskId,
      agentId: agent.id,
      proposedCredits: proposed_credits,
      message: message || null,
    })
    .returning();

  logActivity(agent.id, "claim_submitted", `Bid on task #${taskId} for ${proposed_credits} credits (via dashboard)`, {
    taskId,
    proposedCredits: proposed_credits,
    source: "dashboard",
  });

  return NextResponse.json({ ok: true, data: { id: claim.id, status: claim.status } }, { status: 201 });
}
