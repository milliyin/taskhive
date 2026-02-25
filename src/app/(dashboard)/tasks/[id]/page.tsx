import { getUser } from "@/lib/auth";
import db from "@/db/index";
import { tasks, categories, agents, taskClaims, deliverables, deliverableFiles, taskAttachments, reviews } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import StatusBadge from "@/components/ui/status-badge";
import ClaimActions from "@/components/tasks/claim-actions";
import DeliverableActions from "@/components/tasks/deliverable-actions";
import ReviewForm from "@/components/tasks/review-form";
import CancelTaskButton from "@/components/tasks/cancel-task-button";
import FilePreview from "@/components/tasks/file-preview";
import WebsitePreview from "@/components/tasks/website-preview";
import FileUpload from "@/components/tasks/file-upload";

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

  // Fetch deliverable files
  const allDeliverableFiles = taskDeliverables.length > 0
    ? await db.select().from(deliverableFiles).where(eq(deliverableFiles.taskId, task.task.id))
    : [];

  const filesByDeliverable = new Map<number, typeof allDeliverableFiles>();
  for (const f of allDeliverableFiles) {
    const arr = filesByDeliverable.get(f.deliverableId) || [];
    arr.push(f);
    filesByDeliverable.set(f.deliverableId, arr);
  }

  // Fetch task attachments
  const attachments = await db
    .select()
    .from(taskAttachments)
    .where(eq(taskAttachments.taskId, task.task.id))
    .orderBy(taskAttachments.createdAt);

  const t = task.task;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StatusBadge status={t.status} />
            {task.categoryIcon && <span>{task.categoryIcon}</span>}
            <span className="text-sm text-gray-500">
              {task.categoryName || "General"}
            </span>
          </div>
          {["open", "claimed"].includes(t.status) && (
            <CancelTaskButton taskId={t.id} />
          )}
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

      {/* Task Attachments */}
      <div className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-500">
          Reference Files ({attachments.length})
        </h2>
        {attachments.length > 0 && (
          <div className="mb-3 space-y-2">
            {attachments.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{a.originalName}</span>
                  <span className="text-xs text-gray-500">
                    {a.sizeBytes < 1024 * 1024
                      ? `${(a.sizeBytes / 1024).toFixed(1)} KB`
                      : `${(a.sizeBytes / (1024 * 1024)).toFixed(1)} MB`}
                  </span>
                </div>
                <span className="text-xs text-gray-400">{a.mimeType}</span>
              </div>
            ))}
          </div>
        )}
        {["open", "claimed"].includes(t.status) && (
          <FileUpload taskId={t.id} existingCount={attachments.length} maxFiles={5} />
        )}
        {attachments.length === 0 && !["open", "claimed"].includes(t.status) && (
          <p className="text-sm text-gray-500">No reference files attached.</p>
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
            {taskDeliverables.map((d) => {
              const dFiles = (filesByDeliverable.get(d.id) || []).map((f) => ({
                id: f.id,
                name: f.originalName,
                mime_type: f.mimeType,
                file_type: f.fileType,
                size_bytes: f.sizeBytes,
                public_url: f.publicUrl,
              }));
              const hasWebFiles = dFiles.some((f) => f.file_type === "html");

              return (
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
                  {d.content && (
                    <div className="mb-3 max-h-60 overflow-y-auto rounded bg-gray-50 p-3">
                      <pre className="whitespace-pre-wrap text-sm">{d.content}</pre>
                    </div>
                  )}
                  {hasWebFiles && (
                    <div className="mb-3">
                      <WebsitePreview files={dFiles} />
                    </div>
                  )}
                  {dFiles.length > 0 && (
                    <div className="mb-3">
                      <p className="mb-2 text-xs font-medium text-gray-500">
                        Files ({dFiles.length})
                      </p>
                      <FilePreview files={dFiles} />
                    </div>
                  )}
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
              );
            })}
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
