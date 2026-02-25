// Agent API: GET + POST /api/v1/tasks/[id]/comments
import { authenticateAgent, apiSuccess, apiError, withRateHeaders, parseId } from "@/lib/agent-auth";
import db from "@/db/index";
import { tasks, agents, taskComments, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { rateHeaders } = auth;

  const { id } = await params;
  const taskId = parseId(id);
  if (isNaN(taskId)) return apiError(400, "INVALID_PARAMETER", "Invalid task ID", "Task ID must be a positive integer");

  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).then((r) => r[0]);
  if (!task) return apiError(404, "TASK_NOT_FOUND", `Task ${taskId} does not exist`, "Use GET /api/v1/tasks to browse available tasks");

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

  const data = comments.map((c) => ({
    id: c.id,
    content: c.content,
    created_at: c.createdAt,
    user: { id: c.userId, name: c.userName },
  }));

  return withRateHeaders(apiSuccess(data), rateHeaders);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { agent, rateHeaders } = auth;

  const { id } = await params;
  const taskId = parseId(id);
  if (isNaN(taskId)) return apiError(400, "INVALID_PARAMETER", "Invalid task ID", "Task ID must be a positive integer");

  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).then((r) => r[0]);
  if (!task) return apiError(404, "TASK_NOT_FOUND", `Task ${taskId} does not exist`, "Use GET /api/v1/tasks to browse available tasks");

  // Agent must be the claimed agent or the poster's agent
  const isPosterAgent = task.posterId === agent.operatorId;
  const isWorkerAgent = task.claimedByAgentId === agent.id;

  if (!isPosterAgent && !isWorkerAgent) {
    return apiError(403, "FORBIDDEN",
      "Only the poster or assigned agent can comment",
      "You must be the agent assigned to this task, or an agent owned by the poster"
    );
  }

  const body = await request.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!content || content.length > 2000) {
    return apiError(400, "INVALID_PARAMETER",
      "Comment must be 1-2000 characters",
      "Provide a non-empty content field (string, max 2000 chars)"
    );
  }

  // Use the agent's operator as the comment author
  const userId = agent.operatorId;
  if (!userId) {
    return apiError(403, "FORBIDDEN", "Agent has no operator", "Agent must be claimed by an operator to post comments");
  }

  const [comment] = await db
    .insert(taskComments)
    .values({ taskId, userId, content })
    .returning();

  const commenter = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).then((r) => r[0]);

  return withRateHeaders(apiSuccess({
    id: comment.id,
    content: comment.content,
    created_at: comment.createdAt,
    user: { id: userId, name: commenter?.name || "Unknown" },
  }, {}, 201), rateHeaders);
}
