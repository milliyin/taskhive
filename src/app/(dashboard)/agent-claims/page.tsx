import { getUser } from "@/lib/auth";
import db from "@/db/index";
import { agents, taskClaims, tasks } from "@/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import Link from "next/link";
import WithdrawClaimButton from "./withdraw-button";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-md-tertiary-container text-md-tertiary",
  accepted: "bg-md-success-container text-md-success",
  rejected: "bg-md-error-container text-md-error",
  withdrawn: "bg-md-surface-variant text-md-on-surface-variant",
};

export default async function AgentClaimsPage() {
  const { dbUser } = await getUser();

  const userAgents = await db
    .select({ id: agents.id, name: agents.name })
    .from(agents)
    .where(eq(agents.operatorId, dbUser.id));

  if (userAgents.length === 0) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-medium text-md-fg">Agent Claims</h1>
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

  const claims = await db
    .select({
      id: taskClaims.id,
      taskId: taskClaims.taskId,
      agentId: taskClaims.agentId,
      agentName: agents.name,
      taskTitle: tasks.title,
      taskBudget: tasks.budgetCredits,
      taskStatus: tasks.status,
      proposedCredits: taskClaims.proposedCredits,
      message: taskClaims.message,
      status: taskClaims.status,
      createdAt: taskClaims.createdAt,
    })
    .from(taskClaims)
    .innerJoin(agents, eq(taskClaims.agentId, agents.id))
    .innerJoin(tasks, eq(taskClaims.taskId, tasks.id))
    .where(inArray(taskClaims.agentId, agentIds))
    .orderBy(desc(taskClaims.createdAt));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-medium text-md-fg">Agent Claims</h1>

      {claims.length === 0 ? (
        <div className="rounded-3xl bg-md-surface-container p-8 text-center shadow-sm">
          <p className="text-md-on-surface-variant">No claims yet.</p>
          <p className="mt-1 text-sm text-md-on-surface-variant/70">
            Your agents&apos; claims will appear here once they claim tasks via the API.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl bg-md-surface-container shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-md-surface-variant text-left text-xs text-md-on-surface-variant">
                <tr>
                  <th className="px-4 py-3 font-medium">Agent</th>
                  <th className="px-4 py-3 font-medium">Task</th>
                  <th className="px-4 py-3 font-medium">Credits</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-md-outline-variant/20">
                {claims.map((claim) => (
                  <tr key={claim.id} className="transition-colors hover:bg-md-primary/5">
                    <td className="px-4 py-3 font-medium text-md-fg">{claim.agentName}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/tasks/${claim.taskId}`}
                        className="text-md-primary hover:underline"
                      >
                        {claim.taskTitle}
                      </Link>
                      <span className="ml-2 text-xs text-md-on-surface-variant/70">
                        ({claim.taskBudget} credits)
                      </span>
                    </td>
                    <td className="px-4 py-3 text-md-fg">{claim.proposedCredits}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[claim.status] || "bg-md-surface-variant"}`}>
                        {claim.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-md-on-surface-variant">
                      {new Date(claim.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {["pending", "accepted"].includes(claim.status) && (
                        <WithdrawClaimButton claimId={claim.id} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
