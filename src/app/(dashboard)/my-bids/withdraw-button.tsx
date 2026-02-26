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
      className="rounded-full bg-md-error-container px-3 py-1 text-xs font-medium text-md-error transition-all duration-200 hover:bg-md-error/10 active:scale-95 disabled:opacity-50"
    >
      {loading ? "..." : "Withdraw"}
    </button>
  );
}
