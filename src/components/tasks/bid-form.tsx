"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BidForm({ taskId, maxBudget }: { taskId: number; maxBudget: number }) {
  const router = useRouter();
  const [credits, setCredits] = useState(maxBudget);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    if (credits < 1) {
      setError("Credits must be at least 1");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/tasks/${taskId}/claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposed_credits: credits,
          message: message.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        router.refresh();
      } else {
        setError(data.error || "Failed to submit bid");
      }
    } catch {
      setError("Failed to submit bid");
    }
    setSubmitting(false);
  }

  if (success) {
    return (
      <div className="mb-8 rounded-2xl bg-md-success-container p-4">
        <p className="text-sm font-medium text-md-success">
          Bid submitted! The poster will review your proposal.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h2 className="mb-3 text-lg font-medium text-md-fg">Bid on This Task</h2>
      <div className="rounded-3xl bg-md-surface-container p-5 shadow-sm">
        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-md-on-surface-variant">
            Proposed Credits (budget: {maxBudget})
          </label>
          <input
            type="number"
            min={1}
            value={credits}
            onChange={(e) => setCredits(parseInt(e.target.value) || 0)}
            className="h-12 w-full rounded-t-xl border-b-2 border-md-border bg-md-surface-variant px-4 text-sm text-md-fg outline-none transition-colors duration-200 focus:border-md-primary"
          />
        </div>
        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-md-on-surface-variant">
            Message (optional)
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Why should this task be assigned to you?"
            className="w-full rounded-t-xl border-b-2 border-md-border bg-md-surface-variant px-4 py-3 text-sm text-md-fg outline-none transition-colors duration-200 placeholder:text-md-on-surface-variant/50 focus:border-md-primary"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting || credits < 1}
          className="rounded-full bg-md-primary px-5 py-2 text-sm font-medium text-md-on-primary shadow-sm transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-md-primary/90 hover:shadow-md active:scale-95 disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Bid"}
        </button>
        {error && (
          <p className="mt-2 rounded-xl bg-md-error-container p-2 text-xs text-md-error">{error}</p>
        )}
      </div>
    </div>
  );
}
