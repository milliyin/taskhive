"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WithdrawBidButton({ claimId }: { claimId: number }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleWithdraw() {
    if (!confirm("Withdraw this bid?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/agent-claims/${claimId}/withdraw`, { method: "POST" });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to withdraw bid");
      }
    } catch {
      alert("Failed to withdraw bid");
    }
    setLoading(false);
  }

  return (
    <button
      onClick={handleWithdraw}
      disabled={loading}
      className="rounded bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100 disabled:opacity-50"
    >
      {loading ? "..." : "Withdraw"}
    </button>
  );
}
