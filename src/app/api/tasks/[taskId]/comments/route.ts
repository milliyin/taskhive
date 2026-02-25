// Dashboard API: GET + POST /api/tasks/[taskId]/comments
import { getUser } from "@/lib/auth";
import db from "@/db/index";
import { tasks, agents, taskComments, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

async function getTaskAndRoles(taskId: number, userId: number) {
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).then((r) => r[0]);
  if (!task) return null;

  const isPoster = task.posterId === userId;
  let isWorker = false;

  if (!isPoster && task.claimedByAgentId) {
    const agent = await db.select().from(agents).where(eq(agents.id, task.claimedByAgentId)).then((r) => r[0]);
    if (agent && agent.operatorId === userId) {
      isWorker = true;
    }
  }

  return { task, isPoster, isWorker };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  await getUser(); // auth check
  const { taskId: tid } = await params;
  const taskId = parseInt(tid, 10);
  if (isNaN(taskId)) return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });

  const comments = await db
    .select({
      id: taskComments.id,
      content: taskComments.content,
      createdAt: taskComments.createdAt,
      userId: users.id,
      userName: users.name,
    })
    .from(taskComments)
    .innerJoin(users, eq(taskComments.userId, users.id))
    .where(eq(taskComments.taskId, taskId))
    .orderBy(taskComments.createdAt);

  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      user: { id: c.userId, name: c.userName },
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { dbUser } = await getUser();
  const { taskId: tid } = await params;
  const taskId = parseInt(tid, 10);
  if (isNaN(taskId)) return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });

  const result = await getTaskAndRoles(taskId, dbUser.id);
  if (!result) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  if (!result.isPoster && !result.isWorker) {
    return NextResponse.json({ error: "Only the poster or assigned worker can comment" }, { status: 403 });
  }

  const body = await request.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!content || content.length > 2000) {
    return NextResponse.json({ error: "Comment must be 1-2000 characters" }, { status: 400 });
  }

  const [comment] = await db
    .insert(taskComments)
    .values({ taskId, userId: dbUser.id, content })
    .returning();

  return NextResponse.json({
    comment: {
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      user: { id: dbUser.id, name: dbUser.name },
    },
  }, { status: 201 });
}
