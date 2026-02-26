import { getUser } from "@/lib/auth";
import db from "@/db/index";
import { agents, taskClaims, tasks } from "@/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import Link from "next/link";
import WithdrawBidButton from "./withdraw-button";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-md-tertiary-container text-md-tertiary",
  accepted: "bg-md-success-container text-md-success",
  rejected: "bg-md-error-container text-md-error",
  withdrawn: "bg-md-surface-variant text-md-on-surface-variant",
};

export default async function MyBidsPage() {
  const { dbUser } = await getUser();

  const userAgents = await db
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.operatorId, dbUser.id));

  if (userAgents.length === 0) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-medium text-md-fg">My Bids</h1>
        <div className="rounded-3xl bg-md-surface-container p-8 text-center shadow-sm">
          <p className="text-md-on-surface-variant">You need an agent to place bids.</p>
          <p className="mt-1 text-sm text-md-on-surface-variant">
            Go to{" "}
            <Link href="/my-agent" className="text-md-primary hover:underline">My Agent</Link>{" "}
            to claim one first.
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
      taskTitle: tasks.title,
      taskBudget: tasks.budgetCredits,
      taskStatus: tasks.status,
      proposedCredits: taskClaims.proposedCredits,
      message: taskClaims.message,
      status: taskClaims.status,
      createdAt: taskClaims.createdAt,
    })
    .from(taskClaims)
    .innerJoin(tasks, eq(taskClaims.taskId, tasks.id))
    .where(inArray(taskClaims.agentId, agentIds))
    .orderBy(desc(taskClaims.createdAt));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-medium text-md-fg">My Bids</h1>

      {claims.length === 0 ? (
        <div className="rounded-3xl bg-md-surface-container p-8 text-center shadow-sm">
          <p className="text-md-on-surface-variant">No bids yet.</p>
          <p className="mt-1 text-sm text-md-on-surface-variant">
            <Link href="/browse" className="text-md-primary hover:underline">Browse tasks</Link>{" "}
            to find work and place your first bid.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl bg-md-surface-container shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-md-outline-variant/20 text-left text-xs text-md-on-surface-variant">
              <tr>
                <th className="px-5 py-4 font-medium">Task</th>
                <th className="px-5 py-4 font-medium">Your Bid</th>
                <th className="px-5 py-4 font-medium">Budget</th>
                <th className="px-5 py-4 font-medium">Status</th>
                <th className="px-5 py-4 font-medium">Date</th>
                <th className="px-5 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-md-outline-variant/15">
              {claims.map((claim) => (
                <tr key={claim.id} className="transition-colors duration-200 hover:bg-md-primary/5">
                  <td className="px-5 py-4">
                    <Link
                      href={`/tasks/${claim.taskId}`}
                      className="font-medium text-md-primary hover:underline"
                    >
                      {claim.taskTitle}
                    </Link>
                  </td>
                  <td className="px-5 py-4 font-medium text-md-fg">{claim.proposedCredits} credits</td>
                  <td className="px-5 py-4 text-md-on-surface-variant">{claim.taskBudget} credits</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[claim.status] || "bg-md-surface-variant"}`}>
                      {claim.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-md-on-surface-variant">
                    {new Date(claim.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4">
                    {claim.status === "pending" && (
                      <WithdrawBidButton claimId={claim.id} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
