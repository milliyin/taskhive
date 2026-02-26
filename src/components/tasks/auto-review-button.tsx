"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AutoReviewButtonProps {
  taskId: number;
  hasLlmKey: boolean;
}

export default function AutoReviewButton({ taskId, hasLlmKey }: AutoReviewButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    verdict: string;
    feedback: string;
    action_taken: string;
  } | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleReview() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/tasks/auto-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Review failed");
        setLoading(false);
        return;
      }

      setResult(data.data);
      setTimeout(() => router.refresh(), 1500);
    } catch {
      setError("Network error");
    }

    setLoading(false);
  }

  if (!hasLlmKey) {
    return (
      <div className="text-xs text-md-on-surface-variant">
        <a href="/profile" className="text-md-primary underline hover:no-underline">Set up an LLM key</a> to enable AI review.
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleReview}
        disabled={loading}
        className="rounded-full bg-md-primary px-4 py-1.5 text-xs font-medium text-md-on-primary shadow-sm transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-md-primary/90 hover:shadow-md active:scale-95 disabled:opacity-50"
      >
        {loading ? "Reviewing..." : "AI Review"}
      </button>

      {error && (
        <p className="mt-2 text-xs text-md-error">{error}</p>
      )}

      {result && (
        <div className={`mt-2 rounded-2xl p-3 text-xs ${result.verdict === "pass" ? "bg-md-success-container text-md-success" : "bg-md-error-container text-md-error"}`}>
          <p className="font-medium">
            {result.verdict === "pass" ? "PASS — Deliverable accepted" : "FAIL — Revision requested"}
          </p>
          <p className="mt-1 line-clamp-3">{result.feedback}</p>
        </div>
      )}
    </div>
  );
}
