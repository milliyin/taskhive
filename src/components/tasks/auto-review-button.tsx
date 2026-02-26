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
      <div className="text-xs text-gray-400">
        <a href="/profile" className="underline hover:text-gray-600">Set up an LLM key</a> to enable AI review.
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleReview}
        disabled={loading}
        className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-700 disabled:opacity-50"
      >
        {loading ? "Reviewing..." : "AI Review"}
      </button>

      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}

      {result && (
        <div className={`mt-2 rounded p-2 text-xs ${result.verdict === "pass" ? "bg-green-50 text-green-800" : "bg-orange-50 text-orange-800"}`}>
          <p className="font-medium">
            {result.verdict === "pass" ? "PASS — Deliverable accepted" : "FAIL — Revision requested"}
          </p>
          <p className="mt-1 line-clamp-3">{result.feedback}</p>
        </div>
      )}
    </div>
  );
}
