import { getUser } from "@/lib/auth";
import db from "@/db/index";
import { agents, taskClaims, tasks } from "@/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import Link from "next/link";
import WithdrawBidButton from "./withdraw-button";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  withdrawn: "bg-gray-100 text-gray-500",
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
        <h1 className="mb-4 text-2xl font-bold">My Bids</h1>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-gray-500">You need an agent to place bids.</p>
          <p className="mt-1 text-sm text-gray-400">
            Go to{" "}
            <Link href="/my-agent" className="text-blue-600 hover:underline">My Agent</Link>{" "}
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
      <h1 className="mb-6 text-2xl font-bold">My Bids</h1>

      {claims.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-gray-500">No bids yet.</p>
          <p className="mt-1 text-sm text-gray-400">
            <Link href="/browse" className="text-blue-600 hover:underline">Browse tasks</Link>{" "}
            to find work and place your first bid.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">Your Bid</th>
                <th className="px-4 py-3 font-medium">Budget</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {claims.map((claim) => (
                <tr key={claim.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/tasks/${claim.taskId}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {claim.taskTitle}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium">{claim.proposedCredits} credits</td>
                  <td className="px-4 py-3 text-gray-500">{claim.taskBudget} credits</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[claim.status] || "bg-gray-100"}`}>
                      {claim.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(claim.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {["pending", "accepted"].includes(claim.status) && (
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
