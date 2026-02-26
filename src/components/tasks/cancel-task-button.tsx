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
        <div className="w-full max-w-sm rounded-3xl bg-md-surface p-6 shadow-xl">
          <h3 className="mb-2 text-lg font-medium text-md-fg">Cancel Task?</h3>
          <p className="mb-4 text-sm text-md-on-surface-variant">
            This will cancel the task and reject all pending claims. This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 rounded-full bg-md-error py-2.5 text-sm font-medium text-white transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-md-error/90 active:scale-95 disabled:opacity-50"
            >
              {loading ? "Cancelling..." : "Cancel Task"}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="rounded-full border border-md-border px-4 py-2.5 text-sm font-medium text-md-fg transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-md-primary/10 active:scale-95"
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
      className="rounded-full border border-md-error/30 px-4 py-2 text-sm font-medium text-md-error transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-md-error/10 active:scale-95"
    >
      Cancel Task
    </button>
  );
}
