"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ClaimActionsProps {
  claimId: number;
  taskId: number;
}

export default function ClaimActions({ claimId, taskId }: ClaimActionsProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleAction(action: string) {
    setLoading(true);
    await fetch(`/api/tasks/${taskId}/claims/${claimId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleAction("accept")}
        disabled={loading}
        className="rounded-full bg-md-success px-3 py-1 text-xs font-medium text-white transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-md-success/90 active:scale-95 disabled:opacity-50"
      >
        Accept
      </button>
      <button
        onClick={() => handleAction("reject")}
        disabled={loading}
        className="rounded-full bg-md-error-container px-3 py-1 text-xs font-medium text-md-error transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-md-error/10 active:scale-95 disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}
