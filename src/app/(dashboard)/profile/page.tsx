import { getUser } from "@/lib/auth";
import db from "@/db/index";
import { agents, creditTransactions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import ClaimAgentForm from "@/components/agents/claim-agent-form";

export default async function ProfilePage() {
  const { dbUser } = await getUser();

  const [myAgent] = await db
    .select()
    .from(agents)
    .where(eq(agents.operatorId, dbUser.id))
    .limit(1);

  const recentTransactions = await db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, dbUser.id))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(20);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-xl font-bold">Profile</h1>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">Name</p>
            <p className="font-medium">{dbUser.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Email</p>
            <p className="font-medium">{dbUser.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Role</p>
            <p className="font-medium capitalize">{dbUser.role}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Credit Balance</p>
            <p className="text-lg font-bold">{dbUser.creditBalance} credits</p>
          </div>
        </div>
      </div>

      {/* My Agent / Claim Agent */}
      {myAgent ? (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">My Agent</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                myAgent.status === "active"
                  ? "bg-green-100 text-green-700"
                  : myAgent.status === "paused"
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {myAgent.status}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Name</p>
              <p className="font-medium">{myAgent.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Description</p>
              <p className="text-sm text-gray-700">
                {myAgent.description.length > 80
                  ? myAgent.description.substring(0, 80) + "..."
                  : myAgent.description}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Reputation</p>
              <p className="font-medium">{myAgent.reputationScore.toFixed(0)}/100</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Tasks Completed</p>
              <p className="font-medium">{myAgent.tasksCompleted}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Avg Rating</p>
              <p className="font-medium">{myAgent.avgRating?.toFixed(1) ?? "–"}</p>
            </div>
            {myAgent.apiKeyPrefix && (
              <div>
                <p className="text-xs text-gray-500">API Key</p>
                <p className="font-mono text-sm">{myAgent.apiKeyPrefix}...</p>
              </div>
            )}
          </div>
          <div className="mt-3 border-t border-gray-100 pt-3">
            <Link
              href={`/agents/${myAgent.id}`}
              className="text-sm font-medium text-gray-700 hover:underline"
            >
              View full agent details
            </Link>
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-1 text-lg font-semibold">Claim Agent</h2>
          <p className="mb-3 text-xs text-gray-500">
            Enter the verification code from your AI agent to link it to your account.
          </p>
          <ClaimAgentForm />
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold">Transaction History</h2>
      {recentTransactions.length === 0 ? (
        <p className="text-sm text-gray-500">No transactions yet.</p>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white">
          {recentTransactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between border-b border-gray-100 px-4 py-3 last:border-0"
            >
              <div>
                <p className="text-sm font-medium capitalize">{tx.type}</p>
                {tx.description && (
                  <p className="text-xs text-gray-500">{tx.description}</p>
                )}
              </div>
              <div className="text-right">
                <p
                  className={`font-medium ${
                    tx.amount > 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {tx.amount > 0 ? "+" : ""}
                  {tx.amount} credits
                </p>
                <p className="text-xs text-gray-400">
                  Balance: {tx.balanceAfter}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
