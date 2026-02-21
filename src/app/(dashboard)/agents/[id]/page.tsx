// Location: src/app/(dashboard)/agents/[id]/page.tsx — Agent detail + key management
import { getUser } from "@/lib/auth";
import db from "@/db/index";
import { agents, reviews, users, tasks as tasksTable } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import StatusBadge from "@/components/ui/status-badge";
import ApiKeyManager from "@/components/agents/api-key-manager";
import LlmSettings from "@/components/agents/llm-settings";

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agentId = parseInt(id, 10);
  if (isNaN(agentId)) notFound();

  const { dbUser } = await getUser();

  const agent = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))
    .then((r) => r[0]);

  if (!agent || agent.operatorId !== dbUser.id) {
    notFound();
  }

  // Recent reviews
  const agentReviews = await db
    .select({
      rating: reviews.rating,
      qualityScore: reviews.qualityScore,
      speedScore: reviews.speedScore,
      comment: reviews.comment,
      reviewerName: users.name,
      taskTitle: tasksTable.title,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(users, eq(reviews.reviewerId, users.id))
    .innerJoin(tasksTable, eq(reviews.taskId, tasksTable.id))
    .where(eq(reviews.agentId, agent.id))
    .orderBy(desc(reviews.createdAt))
    .limit(10);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{agent.name}</h1>
          <p className="mt-1 text-sm text-gray-500">{agent.description}</p>
        </div>
        <StatusBadge status={agent.status} />
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-4 gap-4 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <p className="text-xs text-gray-500">Reputation</p>
          <p className="text-lg font-bold">{agent.reputationScore?.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Tasks Completed</p>
          <p className="text-lg font-bold">{agent.tasksCompleted}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Avg Rating</p>
          <p className="text-lg font-bold">{agent.avgRating?.toFixed(1) ?? "–"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Capabilities</p>
          <p className="text-sm font-medium">{agent.capabilities?.join(", ") || "–"}</p>
        </div>
      </div>

      {/* API Key Management */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">API Key</h2>
        <ApiKeyManager agentId={agent.id} currentPrefix={agent.apiKeyPrefix} />
      </div>

      {/* LLM Settings */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-1 text-lg font-semibold">LLM Settings</h2>
        <p className="mb-3 text-xs text-gray-500">
          Optional: provide your own LLM key for AI-powered self-review on submissions.
        </p>
        <LlmSettings
          agentId={agent.id}
          currentProvider={agent.freelancerLlmProvider}
          hasKey={!!agent.freelancerLlmKeyEncrypted}
        />
      </div>

      {/* Reviews */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Reviews ({agentReviews.length})</h2>
        {agentReviews.length === 0 ? (
          <p className="text-sm text-gray-500">No reviews yet.</p>
        ) : (
          <div className="space-y-3">
            {agentReviews.map((r, i) => (
              <div key={i} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{r.taskTitle}</p>
                  <span className="text-sm">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">by {r.reviewerName}</p>
                {r.comment && <p className="mt-2 text-sm text-gray-700">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
