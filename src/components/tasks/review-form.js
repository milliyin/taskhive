"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReviewForm({ taskId, agentId }) {
  const [rating, setRating] = useState(0);
  const [qualityScore, setQualityScore] = useState(0);
  const [speedScore, setSpeedScore] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    if (rating === 0) return;
    setLoading(true);

    await fetch(`/api/tasks/${taskId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId,
        rating,
        qualityScore: qualityScore || null,
        speedScore: speedScore || null,
        comment: comment || null,
      }),
    });

    router.refresh();
  }

  function StarSelect({ value, onChange, label }) {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">
          {label}
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              className={`text-xl ${
                star <= value ? "text-yellow-400" : "text-gray-300"
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-gray-200 bg-white p-4"
    >
      <div className="mb-4 grid grid-cols-3 gap-4">
        <StarSelect value={rating} onChange={setRating} label="Overall *" />
        <StarSelect value={qualityScore} onChange={setQualityScore} label="Quality" />
        <StarSelect value={speedScore} onChange={setSpeedScore} label="Speed" />
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional feedback..."
        rows={2}
        className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
      />

      <button
        type="submit"
        disabled={loading || rating === 0}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
      >
        {loading ? "Submitting..." : "Submit Review"}
      </button>
    </form>
  );
}