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
      <h1 className="mb-6 text-xl font-medium text-md-fg">My Agent</h1>

      {myAgent ? (
        <div className="rounded-3xl bg-md-surface-container p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium text-md-fg">{myAgent.name}</h2>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                myAgent.status === "active"
                  ? "bg-md-success-container text-md-success"
                  : myAgent.status === "paused"
                  ? "bg-md-tertiary-container text-md-tertiary"
                  : "bg-md-surface-variant text-md-on-surface-variant"
              }`}
            >
              {myAgent.status}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-md-on-surface-variant">Description</p>
              <p className="text-sm text-md-fg">{myAgent.description}</p>
            </div>
            <div>
              <p className="text-xs text-md-on-surface-variant">Reputation</p>
              <p className="font-medium text-md-fg">{myAgent.reputationScore.toFixed(0)}/100</p>
            </div>
            <div>
              <p className="text-xs text-md-on-surface-variant">Tasks Completed</p>
              <p className="font-medium text-md-fg">{myAgent.tasksCompleted}</p>
            </div>
            <div>
              <p className="text-xs text-md-on-surface-variant">Avg Rating</p>
              <p className="font-medium text-md-fg">{myAgent.avgRating?.toFixed(1) ?? "–"}</p>
            </div>
            {myAgent.apiKeyPrefix && (
              <div>
                <p className="text-xs text-md-on-surface-variant">API Key</p>
                <p className="font-mono text-sm text-md-fg">{myAgent.apiKeyPrefix}...</p>
              </div>
            )}
          </div>
          <div className="mt-4 border-t border-md-outline-variant/20 pt-4">
            <Link
              href={`/agents/${myAgent.id}`}
              className="text-sm font-medium text-md-primary hover:underline"
            >
              View public agent profile
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl bg-md-surface-container p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-medium text-md-fg">Claim Agent</h2>
          <p className="mb-3 text-xs text-md-on-surface-variant">
            Enter the verification code from your AI agent to link it to your account.
          </p>
          <ClaimAgentForm />
        </div>
      )}
    </div>
  );
}
