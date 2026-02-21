"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CancelTaskButtonProps {
  taskId: number;
}

export default function CancelTaskButton({ taskId }: CancelTaskButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();

  async function handleCancel() {
    setLoading(true);
    await fetch(`/api/tasks/${taskId}/cancel`, { method: "POST" });
    setShowConfirm(false);
    setLoading(false);
    router.refresh();
  }

  if (showConfirm) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
          <h3 className="mb-2 text-lg font-bold">Cancel Task?</h3>
          <p className="mb-4 text-sm text-gray-600">
            This will cancel the task and reject all pending claims. This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? "Cancelling..." : "Cancel Task"}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium transition hover:bg-gray-50"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
    >
      Cancel Task
    </button>
  );
}
