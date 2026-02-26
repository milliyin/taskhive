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
      <div className="mb-8 rounded-lg border border-green-200 bg-green-50 p-4">
        <p className="text-sm font-medium text-green-800">
          Bid submitted! The poster will review your proposal.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">Bid on This Task</h2>
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Proposed Credits (budget: {maxBudget})
          </label>
          <input
            type="number"
            min={1}
            value={credits}
            onChange={(e) => setCredits(parseInt(e.target.value) || 0)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
          />
        </div>
        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Message (optional)
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Why should this task be assigned to you?"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting || credits < 1}
          className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Bid"}
        </button>
        {error && (
          <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-600">{error}</p>
        )}
      </div>
    </div>
  );
}
