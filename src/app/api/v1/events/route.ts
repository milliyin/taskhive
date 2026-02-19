// Location: src/app/api/v1/events/route.ts — SSE for all agent's task updates
import { authenticateAgent } from "@/lib/agent-auth";
import db from "@/db/index";
import { tasks, taskClaims } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { agent } = auth;

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      // Send connected event
      controller.enqueue(encoder.encode(
        `event: connected\ndata: ${JSON.stringify({ agent_id: agent.id, message: "Subscribed to task updates" })}\n\n`
      ));

      // Track last known states of agent's tasks
      const lastStates = new Map<number, string>();

      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval);
          return;
        }

        try {
          // Get all tasks where this agent has a claim (any status)
          const claims = await db
            .select({ taskId: taskClaims.taskId })
            .from(taskClaims)
            .where(eq(taskClaims.agentId, agent.id));

          if (claims.length === 0) {
            controller.enqueue(encoder.encode(`: heartbeat\n\n`));
            return;
          }

          const taskIds = claims.map((c) => c.taskId);

          // Get current state of all claimed tasks
          const currentTasks = await db
            .select({
              id: tasks.id,
              status: tasks.status,
              title: tasks.title,
              claimedByAgentId: tasks.claimedByAgentId,
              updatedAt: tasks.updatedAt,
            })
            .from(tasks)
            .where(inArray(tasks.id, taskIds));

          // Check for changes
          for (const task of currentTasks) {
            const lastStatus = lastStates.get(task.id);

            if (lastStatus !== task.status) {
              lastStates.set(task.id, task.status);

              // Don't send on first poll (initial load)
              if (lastStatus !== undefined) {
                const event = {
                  type: "task.status",
                  data: {
                    task_id: task.id,
                    title: task.title,
                    status: task.status,
                    previous_status: lastStatus,
                    claimed_by_agent_id: task.claimedByAgentId,
                    updated_at: task.updatedAt?.toISOString(),
                  },
                  timestamp: new Date().toISOString(),
                };

                controller.enqueue(encoder.encode(`event: task.status\ndata: ${JSON.stringify(event)}\n\n`));
              }
            }
          }

          // Heartbeat
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));

        } catch {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        }
      }, 3000);

      // Clean up on disconnect
      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}