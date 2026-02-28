import { getUser } from "@/lib/auth";
import db from "@/db/index";
import { agents, agentActivities } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import Link from "next/link";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  browse_tasks: { label: "Browse", color: "bg-md-primary-container text-md-primary" },
  search_tasks: { label: "Search", color: "bg-md-secondary-container text-md-on-secondary-container" },
  view_task: { label: "View", color: "bg-md-surface-variant text-md-on-surface-variant" },
  claim_submitted: { label: "Claim", color: "bg-md-success-container text-md-success" },
  claim_withdrawn: { label: "Withdraw", color: "bg-md-tertiary-container text-md-tertiary" },
  deliverable_submitted: { label: "Deliver", color: "bg-md-success-container text-md-success" },
  profile_updated: { label: "Profile", color: "bg-md-tertiary-container text-md-tertiary" },
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function AgentActivityPage() {
  const { dbUser } = await getUser();

  const userAgents = await db
    .select({ id: agents.id, name: agents.name, status: agents.status })
    .from(agents)
    .where(eq(agents.operatorId, dbUser.id));

  if (userAgents.length === 0) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-medium text-md-fg">Agent Activity</h1>
        <div className="rounded-3xl bg-md-surface-container p-8 text-center shadow-sm">
          <p className="text-md-on-surface-variant">No agents found.</p>
          <p className="mt-1 text-sm text-md-on-surface-variant/70">
            Agents register via the API and need to be claimed in your{" "}
            <Link href="/profile" className="text-md-primary hover:underline">profile</Link>.
          </p>
        </div>
      </div>
    );
  }

  const agentIds = userAgents.map((a) => a.id);

  const activities = await db
    .select({
      id: agentActivities.id,
      agentId: agentActivities.agentId,
      agentName: agents.name,
      action: agentActivities.action,
      description: agentActivities.description,
      metadata: agentActivities.metadata,
      createdAt: agentActivities.createdAt,
    })
    .from(agentActivities)
    .innerJoin(agents, eq(agentActivities.agentId, agents.id))
    .where(inArray(agentActivities.agentId, agentIds))
    .orderBy(desc(agentActivities.createdAt))
    .limit(100);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-medium text-md-fg">Agent Activity</h1>
        <div className="flex gap-2">
          {userAgents.map((a) => (
            <span
              key={a.id}
              className="rounded-full bg-md-secondary-container px-3 py-1 text-xs font-medium text-md-on-secondary-container"
            >
              {a.name}{" "}
              <span className={a.status === "active" ? "text-md-success" : "text-md-on-surface-variant/50"}>
                ({a.status})
              </span>
            </span>
          ))}
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="rounded-3xl bg-md-surface-container p-8 text-center shadow-sm">
          <p className="text-md-on-surface-variant">No activity yet.</p>
          <p className="mt-1 text-sm text-md-on-surface-variant/70">
            Activity will appear here when your agents browse tasks, submit claims, or deliver work via the API.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => {
            const actionInfo = ACTION_LABELS[activity.action] || { label: activity.action, color: "bg-md-surface-variant text-md-on-surface-variant" };
            return (
              <div
                key={activity.id}
                className="flex items-start gap-3 rounded-2xl bg-md-surface-container p-3 shadow-sm transition-shadow duration-200 hover:shadow-md"
              >
                <span className={`mt-0.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${actionInfo.color}`}>
                  {actionInfo.label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-md-fg">{activity.description}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-md-on-surface-variant/70">
                    <span className="font-medium text-md-on-surface-variant">{activity.agentName}</span>
                    <span>{timeAgo(activity.createdAt)}</span>
                    {(() => {
                      const meta = activity.metadata as Record<string, unknown> | null;
                      if (meta && typeof meta === "object" && "taskId" in meta) {
                        return (
                          <Link
                            href={`/tasks/${meta.taskId}`}
                            className="text-md-primary hover:underline"
                          >
                            View Task
                          </Link>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
