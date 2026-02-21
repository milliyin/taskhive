import { getUser } from "@/lib/auth";
import db from "@/db/index";
import { tasks, categories, agents, taskClaims, deliverables, reviews } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import StatusBadge from "@/components/ui/status-badge";
import ClaimActions from "@/components/tasks/claim-actions";
import DeliverableActions from "@/components/tasks/deliverable-actions";
import ReviewForm from "@/components/tasks/review-form";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const taskId = parseInt(id, 10);
  if (isNaN(taskId)) notFound();

  const { dbUser } = await getUser();

  // Fetch task
  const task = await db
    .select({
      task: tasks,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      agentName: agents.name,
    })
    .from(tasks)
    .leftJoin(categories, eq(tasks.categoryId, categories.id))
    .leftJoin(agents, eq(tasks.claimedByAgentId, agents.id))
    .where(eq(tasks.id, taskId))
    .then((r) => r[0]);

  if (!task || task.task.posterId !== dbUser.id) {
    notFound();
  }

  // Fetch claims
  const claims = await db
    .select({
      claim: taskClaims,
      agentName: agents.name,
      agentReputation: agents.reputationScore,
      agentRating: agents.avgRating,
    })
    .from(taskClaims)
    .innerJoin(agents, eq(taskClaims.agentId, agents.id))
    .where(eq(taskClaims.taskId, task.task.id))
    .orderBy(taskClaims.createdAt);

  // Fetch deliverables
  const taskDeliverables = await db
    .select()
    .from(deliverables)
    .where(eq(deliverables.taskId, task.task.id))
    .orderBy(desc(deliverables.submittedAt));

  // Fetch review
  const review = await db
    .select()
    .from(reviews)
    .where(eq(reviews.taskId, task.task.id))
    .then((r) => r[0] || null);

  const t = task.task;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-3">
          <StatusBadge status={t.status} />
          {task.categoryIcon && <span>{task.categoryIcon}</span>}
          <span className="text-sm text-gray-500">
            {task.categoryName || "General"}
          </span>
        </div>
        <h1 className="text-2xl font-bold">{t.title}</h1>
      </div>

      {/* Info grid */}
      <div className="mb-6 grid grid-cols-3 gap-4 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <p className="text-xs text-gray-500">Budget</p>
          <p className="font-semibold">{t.budgetCredits} credits</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Max Revisions</p>
          <p className="font-semibold">{t.maxRevisions}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Deadline</p>
          <p className="font-semibold">
            {t.deadline
              ? new Date(t.deadline).toLocaleDateString()
              : "None"}
          </p>
        </div>
      </div>

      {/* Description */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-500">Description</h2>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{t.description}</p>
        {t.requirements && (
          <>
            <h2 className="mb-2 mt-4 text-sm font-semibold text-gray-500">
              Requirements
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {t.requirements}
            </p>
          </>
        )}
      </div>

      {/* Assigned agent */}
      {task.agentName && (
        <div className="mb-6 rounded-lg border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm">
            <span className="text-gray-500">Assigned to:</span>{" "}
            <span className="font-medium">{task.agentName}</span>
          </p>
        </div>
      )}

      {/* Claims */}
      <div className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">
          Claims ({claims.length})
        </h2>
        {claims.length === 0 ? (
          <p className="text-sm text-gray-500">No claims yet. Waiting for agents to bid.</p>
        ) : (
          <div className="space-y-3">
            {claims.map(({ claim, agentName, agentReputation, agentRating }) => (
              <div
                key={claim.id}
                className="rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{agentName}</p>
                    <p className="text-xs text-gray-500">
                      Reputation: {agentReputation?.toFixed(0) ?? "–"} ·
                      Rating: {agentRating?.toFixed(1) ?? "–"} ·
                      Bid: {claim.proposedCredits} credits
                    </p>
                    {claim.message && (
                      <p className="mt-2 text-sm text-gray-700">{claim.message}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={claim.status} />
                    {claim.status === "pending" && t.status === "open" && (
                      <ClaimActions claimId={claim.id} taskId={t.id} />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deliverables */}
      <div className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">
          Deliverables ({taskDeliverables.length})
        </h2>
        {taskDeliverables.length === 0 ? (
          <p className="text-sm text-gray-500">
            {t.claimedByAgentId
              ? "Waiting for the agent to submit work."
              : "No deliverables yet."}
          </p>
        ) : (
          <div className="space-y-4">
            {taskDeliverables.map((d) => (
              <div
                key={d.id}
                className="rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Revision #{d.revisionNumber}
                  </p>
                  <StatusBadge status={d.status} />
                </div>
                <div className="mb-3 max-h-60 overflow-y-auto rounded bg-gray-50 p-3">
                  <pre className="whitespace-pre-wrap text-sm">{d.content}</pre>
                </div>
                {d.revisionNotes && (
                  <div className="mb-3 rounded bg-orange-50 p-3">
                    <p className="text-xs font-medium text-orange-700">Revision Notes:</p>
                    <p className="text-sm text-orange-800">{d.revisionNotes}</p>
                  </div>
                )}
                {d.status === "submitted" && t.status === "delivered" && (
                  <DeliverableActions
                    deliverableId={d.id}
                    taskId={t.id}
                    revisionNumber={d.revisionNumber}
                    maxRevisions={t.maxRevisions}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review */}
      {t.status === "completed" && !review && t.claimedByAgentId && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Leave a Review</h2>
          <ReviewForm taskId={t.id} agentId={t.claimedByAgentId} />
        </div>
      )}

      {review && (
        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold">Your Review</h2>
          <div className="flex gap-4 text-sm">
            <span>Overall: {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
            {review.qualityScore && <span>Quality: {review.qualityScore}/5</span>}
            {review.speedScore && <span>Speed: {review.speedScore}/5</span>}
          </div>
          {review.comment && (
            <p className="mt-2 text-sm text-gray-700">{review.comment}</p>
          )}
        </div>
      )}
    </div>
  );
}
