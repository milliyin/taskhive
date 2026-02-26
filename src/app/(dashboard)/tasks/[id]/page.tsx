import { getUser } from "@/lib/auth";
import { getDashboardView } from "@/lib/view-toggle";
import db from "@/db/index";
import { tasks, categories, agents, taskClaims, deliverables, deliverableFiles, deliverableReviews, taskAttachments, reviews, githubDeliveries } from "@/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import StatusBadge from "@/components/ui/status-badge";
import ClaimActions from "@/components/tasks/claim-actions";
import DeliverableActions from "@/components/tasks/deliverable-actions";
import ReviewForm from "@/components/tasks/review-form";
import CancelTaskButton from "@/components/tasks/cancel-task-button";
import FilePreview from "@/components/tasks/file-preview";
import WebsitePreview from "@/components/tasks/website-preview";
import FileUpload from "@/components/tasks/file-upload";
import TaskComments from "@/components/tasks/task-comments";
import SubmitWorkForm from "@/components/tasks/submit-work-form";
import CollapsiblePreview from "@/components/tasks/collapsible-preview";
import BidForm from "@/components/tasks/bid-form";
import GitHubDeliveryCard from "@/components/tasks/github-delivery-card";
import AutoReviewButton from "@/components/tasks/auto-review-button";

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
      agentOperatorId: agents.operatorId,
    })
    .from(tasks)
    .leftJoin(categories, eq(tasks.categoryId, categories.id))
    .leftJoin(agents, eq(tasks.claimedByAgentId, agents.id))
    .where(eq(tasks.id, taskId))
    .then((r) => r[0]);

  if (!task) {
    notFound();
  }

  const isPoster = task.task.posterId === dbUser.id;
  const isWorker = !isPoster && !!task.agentOperatorId && task.agentOperatorId === dbUser.id;
  const currentView = await getDashboardView();

  // Check if freelancer can bid
  let userAgent: { id: number; status: string } | null = null;
  let existingClaim: { id: number; proposedCredits: number } | null = null;
  if (currentView === "freelancer" && !isPoster && task.task.status === "open") {
    userAgent = await db
      .select({ id: agents.id, status: agents.status })
      .from(agents)
      .where(and(eq(agents.operatorId, dbUser.id), eq(agents.status, "active")))
      .then((r) => r[0] || null);

    if (userAgent) {
      existingClaim = await db
        .select({ id: taskClaims.id, proposedCredits: taskClaims.proposedCredits })
        .from(taskClaims)
        .where(and(
          eq(taskClaims.taskId, task.task.id),
          eq(taskClaims.agentId, userAgent.id),
          eq(taskClaims.status, "pending")
        ))
        .then((r) => r[0] || null);
    }
  }
  const canBid = currentView === "freelancer" && !isPoster && task.task.status === "open" && !!userAgent && !existingClaim;

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

  // Fetch GitHub deliveries
  const deliverableIds = taskDeliverables.map((d) => d.id);
  const allGithubDeliveries = deliverableIds.length > 0
    ? await db.select().from(githubDeliveries).where(inArray(githubDeliveries.deliverableId, deliverableIds))
    : [];
  const ghByDeliverable = new Map<number, (typeof allGithubDeliveries)[number]>();
  for (const gh of allGithubDeliveries) {
    ghByDeliverable.set(gh.deliverableId, gh);
  }

  // Fetch AI reviews
  const allAiReviews = deliverableIds.length > 0
    ? await db.select().from(deliverableReviews).where(inArray(deliverableReviews.deliverableId, deliverableIds))
    : [];
  const aiReviewByDeliverable = new Map<number, (typeof allAiReviews)[number]>();
  for (const r of allAiReviews) {
    // Keep the latest review per deliverable
    const existing = aiReviewByDeliverable.get(r.deliverableId);
    if (!existing || (r.reviewedAt && existing.reviewedAt && r.reviewedAt > existing.reviewedAt)) {
      aiReviewByDeliverable.set(r.deliverableId, r);
    }
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
            <span className="text-sm text-md-on-surface-variant">
              {task.categoryName || "General"}
            </span>
          </div>
          {isPoster && ["open", "claimed"].includes(t.status) && (
            <CancelTaskButton taskId={t.id} />
          )}
        </div>
        <h1 className="text-2xl font-medium text-md-fg">{t.title}</h1>
      </div>

      {/* Info grid */}
      <div className="mb-6 grid grid-cols-3 gap-4 rounded-3xl bg-md-surface-container p-5 shadow-sm">
        <div>
          <p className="text-xs text-md-on-surface-variant">Budget</p>
          <p className="font-medium text-md-fg">{t.budgetCredits} credits</p>
        </div>
        <div>
          <p className="text-xs text-md-on-surface-variant">Max Revisions</p>
          <p className="font-medium text-md-fg">{t.maxRevisions}</p>
        </div>
        <div>
          <p className="text-xs text-md-on-surface-variant">Deadline</p>
          <p className="font-medium text-md-fg">
            {t.deadline
              ? new Date(t.deadline).toLocaleDateString()
              : "None"}
          </p>
        </div>
      </div>

      {/* Description */}
      <div className="mb-8 rounded-3xl bg-md-surface-container p-5 shadow-sm">
        <h2 className="mb-2 text-sm font-medium text-md-on-surface-variant">Description</h2>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-md-fg">{t.description}</p>
        {t.requirements && (
          <>
            <h2 className="mb-2 mt-4 text-sm font-medium text-md-on-surface-variant">
              Requirements
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-md-fg">
              {t.requirements}
            </p>
          </>
        )}
      </div>

      {/* Task Attachments */}
      <div className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-md-on-surface-variant">
          Reference Files ({attachments.length})
        </h2>
        {attachments.length > 0 && (
          <div className="mb-3 space-y-2">
            {attachments.map((a) => {
              const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/task-attachments/${a.storagePath}`;
              return (
                <div key={a.id} className="flex items-center justify-between rounded-2xl bg-md-surface-variant px-3 py-2">
                  <div className="flex items-center gap-2">
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-md-primary hover:underline"
                    >
                      {a.originalName}
                    </a>
                    <span className="text-xs text-md-on-surface-variant">
                      {a.sizeBytes < 1024 * 1024
                        ? `${(a.sizeBytes / 1024).toFixed(1)} KB`
                        : `${(a.sizeBytes / (1024 * 1024)).toFixed(1)} MB`}
                    </span>
                  </div>
                  <a
                    href={publicUrl}
                    download={a.originalName}
                    className="text-xs text-md-on-surface-variant hover:text-md-primary"
                  >
                    Download
                  </a>
                </div>
              );
            })}
          </div>
        )}
        {isPoster && ["open", "claimed"].includes(t.status) && (
          <FileUpload taskId={t.id} existingCount={attachments.length} maxFiles={5} />
        )}
        {attachments.length === 0 && !["open", "claimed"].includes(t.status) && (
          <p className="text-sm text-md-on-surface-variant">No reference files attached.</p>
        )}
      </div>

      {/* Bid form for freelancers */}
      {currentView === "freelancer" && !isPoster && t.status === "open" && (
        <>
          {!userAgent ? (
            <div className="mb-6 rounded-2xl bg-md-tertiary-container p-4">
              <p className="text-sm text-md-tertiary">
                You need an active agent to bid on tasks.{" "}
                <Link href="/my-agent" className="font-medium underline">Claim an agent</Link> first.
              </p>
            </div>
          ) : existingClaim ? (
            <div className="mb-6 rounded-2xl bg-md-primary-container p-4">
              <p className="text-sm text-md-primary">
                You already have a pending bid on this task ({existingClaim.proposedCredits} credits).
              </p>
            </div>
          ) : (
            <BidForm taskId={t.id} maxBudget={t.budgetCredits} />
          )}
        </>
      )}

      {/* Assigned agent */}
      {task.agentName && (
        <div className="mb-6 rounded-2xl bg-md-primary-container p-4">
          <p className="text-sm">
            <span className="text-md-on-surface-variant">Assigned to:</span>{" "}
            <span className="font-medium text-md-primary">{task.agentName}</span>
          </p>
        </div>
      )}

      {/* Worker banner */}
      {isWorker && (
        <div className="mb-6 rounded-2xl bg-md-success-container p-4">
          <p className="text-sm font-medium text-md-success">
            You are working on this task via your agent ({task.agentName})
          </p>
        </div>
      )}

      {/* Claims */}
      <div className="mb-8">
        <h2 className="mb-3 text-lg font-medium text-md-fg">
          Claims ({claims.length})
        </h2>
        {claims.length === 0 ? (
          <p className="text-sm text-md-on-surface-variant">No claims yet. Waiting for agents to bid.</p>
        ) : (
          <div className="space-y-3">
            {claims.map(({ claim, agentName, agentReputation, agentRating }) => (
              <div
                key={claim.id}
                className="rounded-2xl bg-md-surface-container p-4 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-md-fg">{agentName}</p>
                    <p className="text-xs text-md-on-surface-variant">
                      Reputation: {agentReputation?.toFixed(0) ?? "–"} ·
                      Rating: {agentRating?.toFixed(1) ?? "–"} ·
                      Bid: {claim.proposedCredits} credits
                    </p>
                    {claim.message && (
                      <p className="mt-2 text-sm text-md-on-surface-variant">{claim.message}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={claim.status} />
                    {isPoster && claim.status === "pending" && t.status === "open" && (
                      <ClaimActions claimId={claim.id} taskId={t.id} />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit Work (for worker) */}
      {isWorker && ["claimed", "in_progress"].includes(t.status) &&
        !taskDeliverables.some((d) => d.status === "submitted") && (
        <SubmitWorkForm taskId={t.id} />
      )}

      {/* Deliverables */}
      <div className="mb-8">
        <h2 className="mb-3 text-lg font-medium text-md-fg">
          Deliverables ({taskDeliverables.length})
        </h2>
        {taskDeliverables.length === 0 ? (
          <p className="text-sm text-md-on-surface-variant">
            {t.claimedByAgentId
              ? "Waiting for the agent to submit work."
              : "No deliverables yet."}
          </p>
        ) : (
          <div className="space-y-4">
            {taskDeliverables.map((d, idx) => {
              const dFiles = (filesByDeliverable.get(d.id) || []).map((f) => ({
                id: f.id,
                name: f.originalName,
                mime_type: f.mimeType,
                file_type: f.fileType,
                size_bytes: f.sizeBytes,
                public_url: f.publicUrl,
              }));
              const hasWebFiles = dFiles.some((f) => f.file_type === "html");
              const isLatest = idx === 0;
              const ghDelivery = ghByDeliverable.get(d.id);
              const aiReview = aiReviewByDeliverable.get(d.id);

              return (
                <div
                  key={d.id}
                  className="rounded-3xl bg-md-surface-container p-5 shadow-sm"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-md-fg">
                      Revision #{d.revisionNumber}
                    </p>
                    <StatusBadge status={d.status} />
                  </div>
                  {d.content && (
                    <div className="mb-3 max-h-60 overflow-y-auto rounded-xl bg-md-surface-variant p-3">
                      <pre className="whitespace-pre-wrap text-sm text-md-fg">{d.content}</pre>
                    </div>
                  )}
                  {ghDelivery && (
                    <div className="mb-3">
                      <GitHubDeliveryCard
                        taskId={t.id}
                        sourceRepoUrl={ghDelivery.sourceRepoUrl}
                        sourceBranch={ghDelivery.sourceBranch}
                        previewUrl={ghDelivery.previewUrl}
                        deployStatus={ghDelivery.deployStatus}
                        errorMessage={ghDelivery.errorMessage}
                        isWorker={isWorker}
                      />
                    </div>
                  )}
                  {hasWebFiles && isLatest && (
                    <div className="mb-3">
                      <WebsitePreview files={dFiles} />
                    </div>
                  )}
                  {hasWebFiles && !isLatest && (
                    <div className="mb-3">
                      <CollapsiblePreview files={dFiles} label={`Preview Revision #${d.revisionNumber}`} />
                    </div>
                  )}
                  {dFiles.length > 0 && (
                    <div className="mb-3">
                      <p className="mb-2 text-xs font-medium text-md-on-surface-variant">
                        Files ({dFiles.length})
                      </p>
                      <FilePreview files={dFiles} />
                    </div>
                  )}
                  {d.revisionNotes && !aiReview && (
                    <div className="mb-3 rounded-xl bg-md-tertiary-container p-3">
                      <p className="text-xs font-medium text-md-tertiary">Revision Notes:</p>
                      <p className="text-sm text-md-tertiary">{d.revisionNotes}</p>
                    </div>
                  )}
                  {aiReview && (
                    <div className={`mb-3 rounded-xl p-3 ${aiReview.reviewResult === "pass" ? "bg-md-success-container" : "bg-md-tertiary-container"}`}>
                      <div className="mb-1 flex items-center justify-between">
                        <p className={`text-xs font-medium ${aiReview.reviewResult === "pass" ? "text-md-success" : "text-md-tertiary"}`}>
                          AI Review: {aiReview.reviewResult?.toUpperCase()}
                        </p>
                        {aiReview.llmModelUsed && (
                          <span className="text-[10px] text-md-on-surface-variant/50">{aiReview.llmModelUsed}</span>
                        )}
                      </div>
                      {aiReview.reviewFeedback && (
                        <p className={`text-sm ${aiReview.reviewResult === "pass" ? "text-md-success" : "text-md-tertiary"}`}>
                          {aiReview.reviewFeedback}
                        </p>
                      )}
                      {aiReview.reviewScores != null && typeof aiReview.reviewScores === "object" ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {Object.keys(aiReview.reviewScores as object).map((key) => (
                            <span key={key} className="rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] text-md-on-surface-variant">
                              {key.replace(/_/g, " ")}: {String((aiReview.reviewScores as Record<string, unknown>)[key])}/10
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                  {isPoster && d.status === "submitted" && t.status === "delivered" && (
                    <div className="space-y-3">
                      <DeliverableActions
                        deliverableId={d.id}
                        taskId={t.id}
                        revisionNumber={d.revisionNumber}
                        maxRevisions={t.maxRevisions}
                      />
                      <AutoReviewButton
                        taskId={t.id}
                        hasLlmKey={!!dbUser.llmKeyEncrypted}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review */}
      {isPoster && t.status === "completed" && !review && t.claimedByAgentId && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-medium text-md-fg">Leave a Review</h2>
          <ReviewForm taskId={t.id} agentId={t.claimedByAgentId} />
        </div>
      )}

      {isPoster && review && (
        <div className="mb-8 rounded-3xl bg-md-surface-container p-5 shadow-sm">
          <h2 className="mb-2 text-lg font-medium text-md-fg">Your Review</h2>
          <div className="flex gap-4 text-sm text-md-fg">
            <span>Overall: {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
            {review.qualityScore && <span>Quality: {review.qualityScore}/5</span>}
            {review.speedScore && <span>Speed: {review.speedScore}/5</span>}
          </div>
          {review.comment && (
            <p className="mt-2 text-sm text-md-on-surface-variant">{review.comment}</p>
          )}
        </div>
      )}

      {/* Discussion */}
      {(isPoster || isWorker) && t.status !== "open" && (
        <TaskComments taskId={t.id} canComment={isPoster || isWorker} />
      )}
    </div>
  );
}
