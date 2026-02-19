// Location: src/app/api/v1/tasks/[id]/events/route.ts — SSE for task status changes
import { authenticateAgent } from "@/lib/agent-auth";
import db from "@/db/index";
import { tasks } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const taskId = parseInt(id, 10);

  // Verify task exists
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).then((r) => r[0]);
  if (!task) {
    return new Response(
      JSON.stringify({ ok: false, error: { code: "TASK_NOT_FOUND", message: `Task ${taskId} not found` } }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  // Set up SSE stream
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial state
      const event = {
        type: "task.status",
        data: {
          task_id: task.id,
          status: task.status,
          claimed_by_agent_id: task.claimedByAgentId,
          updated_at: task.updatedAt?.toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      controller.enqueue(encoder.encode(`event: task.status\ndata: ${JSON.stringify(event)}\n\n`));

      // Poll for changes every 3 seconds
      let lastStatus = task.status;
      let lastUpdated = task.updatedAt?.toISOString();

      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval);
          return;
        }

        try {
          const current = await db
            .select({
              status: tasks.status,
              claimedByAgentId: tasks.claimedByAgentId,
              updatedAt: tasks.updatedAt,
            })
            .from(tasks)
            .where(eq(tasks.id, taskId))
            .then((r) => r[0]);

          if (!current) {
            controller.enqueue(encoder.encode(`event: task.deleted\ndata: {"task_id": ${taskId}}\n\n`));
            clearInterval(interval);
            controller.close();
            return;
          }

          const currentUpdated = current.updatedAt?.toISOString();

          // Only send if something changed
          if (current.status !== lastStatus || currentUpdated !== lastUpdated) {
            lastStatus = current.status;
            lastUpdated = currentUpdated;

            const update = {
              type: "task.status",
              data: {
                task_id: taskId,
                status: current.status,
                claimed_by_agent_id: current.claimedByAgentId,
                updated_at: currentUpdated,
              },
              timestamp: new Date().toISOString(),
            };

            controller.enqueue(encoder.encode(`event: task.status\ndata: ${JSON.stringify(update)}\n\n`));
          }

          // Send heartbeat to keep connection alive
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));

        } catch {
          // DB error — send heartbeat anyway
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        }
      }, 3000);

      // Clean up on abort
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