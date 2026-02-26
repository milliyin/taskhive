"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeliverableActionsProps {
  deliverableId: number;
  taskId: number;
  revisionNumber: number;
  maxRevisions: number;
}

export default function DeliverableActions({
  deliverableId,
  taskId,
  revisionNumber,
  maxRevisions,
}: DeliverableActionsProps) {
  const [loading, setLoading] = useState(false);
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");
  const router = useRouter();

  const canRequestRevision = revisionNumber < maxRevisions + 1;
  const canReject = !canRequestRevision;

  async function handleAccept() {
    setLoading(true);
    await fetch(`/api/tasks/${taskId}/deliverables/${deliverableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    router.refresh();
  }

  async function handleRevision() {
    if (!revisionNotes.trim()) return;
    setLoading(true);
    await fetch(`/api/tasks/${taskId}/deliverables/${deliverableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "revision",
        revisionNotes,
      }),
    });
    router.refresh();
  }

  async function handleReject() {
    setLoading(true);
    await fetch(`/api/tasks/${taskId}/deliverables/${deliverableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject" }),
    });
    router.refresh();
  }

  return (
    <div>
      <div className="flex gap-2">
        <button
          onClick={handleAccept}
          disabled={loading}
          className="rounded-full bg-md-success px-3 py-1.5 text-xs font-medium text-white transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-md-success/90 active:scale-95 disabled:opacity-50"
        >
          Accept Deliverable
        </button>

        {canRequestRevision && (
          <button
            onClick={() => setShowRevisionForm(!showRevisionForm)}
            disabled={loading}
            className="rounded-full bg-md-tertiary-container px-3 py-1.5 text-xs font-medium text-md-tertiary transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-md-tertiary/10 active:scale-95 disabled:opacity-50"
          >
            Request Revision
          </button>
        )}

        {canReject && (
          <button
            onClick={handleReject}
            disabled={loading}
            className="rounded-full bg-md-error-container px-3 py-1.5 text-xs font-medium text-md-error transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-md-error/10 active:scale-95 disabled:opacity-50"
          >
            Reject (Final)
          </button>
        )}
      </div>

      {showRevisionForm && (
        <div className="mt-3 space-y-2">
          <textarea
            value={revisionNotes}
            onChange={(e) => setRevisionNotes(e.target.value)}
            placeholder="Describe what changes you need..."
            rows={3}
            className="w-full rounded-t-xl border-b-2 border-md-border bg-md-surface-variant px-4 py-3 text-sm text-md-fg outline-none transition-colors duration-200 placeholder:text-md-on-surface-variant/50 focus:border-md-primary"
          />
          <button
            onClick={handleRevision}
            disabled={loading || !revisionNotes.trim()}
            className="rounded-full bg-md-tertiary px-4 py-1.5 text-xs font-medium text-white transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-md-tertiary/90 active:scale-95 disabled:opacity-50"
          >
            Submit Revision Request
          </button>
        </div>
      )}
    </div>
  );
}
