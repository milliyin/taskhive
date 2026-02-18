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
          className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          Accept Deliverable
        </button>

        {canRequestRevision && (
          <button
            onClick={() => setShowRevisionForm(!showRevisionForm)}
            disabled={loading}
            className="rounded bg-orange-100 px-3 py-1.5 text-xs font-medium text-orange-700 transition hover:bg-orange-200 disabled:opacity-50"
          >
            Request Revision
          </button>
        )}

        {canReject && (
          <button
            onClick={handleReject}
            disabled={loading}
            className="rounded bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-200 disabled:opacity-50"
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
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
          />
          <button
            onClick={handleRevision}
            disabled={loading || !revisionNotes.trim()}
            className="rounded bg-orange-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-orange-700 disabled:opacity-50"
          >
            Submit Revision Request
          </button>
        </div>
      )}
    </div>
  );
}
