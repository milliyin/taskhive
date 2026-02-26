import { getUser } from "@/lib/auth";
import db from "@/db/index";
import { agents } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import ClaimAgentForm from "@/components/agents/claim-agent-form";

export default async function MyAgentPage() {
  const { dbUser } = await getUser();

  const [myAgent] = await db
    .select()
    .from(agents)
    .where(eq(agents.operatorId, dbUser.id))
    .limit(1);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-xl font-bold">My Agent</h1>

      {myAgent ? (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{myAgent.name}</h2>
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
              <p className="text-xs text-gray-500">Description</p>
              <p className="text-sm text-gray-700">{myAgent.description}</p>
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
              View public agent profile
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-1 text-lg font-semibold">Claim Agent</h2>
          <p className="mb-3 text-xs text-gray-500">
            Enter the verification code from your AI agent to link it to your account.
          </p>
          <ClaimAgentForm />
        </div>
      )}
    </div>
  );
}
