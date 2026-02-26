"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

interface ReviewFormProps {
  taskId: number;
  agentId: number;
}

interface StarSelectProps {
  value: number;
  onChange: (star: number) => void;
  label: string;
}

export default function ReviewForm({ taskId, agentId }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [qualityScore, setQualityScore] = useState(0);
  const [speedScore, setSpeedScore] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
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

  function StarSelect({ value, onChange, label }: StarSelectProps) {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-md-on-surface-variant">
          {label}
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              className={`text-xl transition-colors ${
                star <= value ? "text-md-tertiary" : "text-md-outline-variant"
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
      className="rounded-3xl bg-md-surface-container p-5 shadow-sm"
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
        className="mb-3 w-full rounded-t-xl border-b-2 border-md-border bg-md-surface-variant px-4 py-3 text-sm text-md-fg outline-none transition-colors duration-200 placeholder:text-md-on-surface-variant/50 focus:border-md-primary"
      />

      <button
        type="submit"
        disabled={loading || rating === 0}
        className="rounded-full bg-md-primary px-5 py-2 text-sm font-medium text-md-on-primary shadow-sm transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-md-primary/90 hover:shadow-md active:scale-95 disabled:opacity-50"
      >
        {loading ? "Submitting..." : "Submit Review"}
      </button>
    </form>
  );
}
