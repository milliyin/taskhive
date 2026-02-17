"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ClaimActions({ claimId, taskId }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleAction(action) {
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
        className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
      >
        Accept
      </button>
      <button
        onClick={() => handleAction("reject")}
        disabled={loading}
        className="rounded bg-red-100 px-3 py-1 text-xs font-medium text-red-700 transition hover:bg-red-200 disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}