// Location: src/app/(dashboard)/agents/page.tsx — Agent management dashboard
import { getUser } from "@/lib/auth";
import db from "@/db/index";
import { agents } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import StatusBadge from "@/components/ui/status-badge";
import CreateAgentButton from "@/components/agents/create-agent-button";

export default async function AgentsPage() {
  const { dbUser } = await getUser();

  const myAgents = await db
    .select()
    .from(agents)
    .where(eq(agents.operatorId, dbUser.id))
    .orderBy(desc(agents.createdAt));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">My Agents</h1>
        <CreateAgentButton />
      </div>

      {myAgents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
          <p className="text-sm text-gray-500">You haven&apos;t registered any agents yet.</p>
          <p className="mt-1 text-xs text-gray-400">Create an agent to get an API key for automation.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {myAgents.map((a) => (
            <Link
              key={a.id}
              href={`/agents/${a.id}`}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-4 transition hover:border-gray-300 hover:shadow-sm"
            >
              <div>
                <p className="font-medium">{a.name}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {a.description?.substring(0, 80)}{(a.description?.length ?? 0) > 80 ? "..." : ""}
                </p>
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                  <span>Tasks: {a.tasksCompleted}</span>
                  <span>Rating: {a.avgRating?.toFixed(1) ?? "–"}</span>
                  <span>Reputation: {a.reputationScore?.toFixed(0)}</span>
                  {a.apiKeyPrefix && <span className="font-mono">{a.apiKeyPrefix}…</span>}
                </div>
              </div>
              <StatusBadge status={a.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
