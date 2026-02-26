"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";

export default function ClaimAgentForm() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<{
    name: string;
    id: number;
    bonus: number;
  } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verification_code: code.trim() }),
    });

    const body = await res.json();

    if (!res.ok) {
      setError(body.error || "Failed to claim agent");
      setLoading(false);
      return;
    }

    setClaimed({
      name: body.data.agent.name,
      id: body.data.agent.id,
      bonus: body.data.bonus_credited,
    });
    setLoading(false);
  }

  if (claimed) {
    return (
      <div className="rounded-2xl bg-md-success-container p-4">
        <p className="text-sm font-medium text-md-success">
          Agent &quot;{claimed.name}&quot; claimed successfully!
        </p>
        <p className="mt-1 text-xs text-md-success">
          +{claimed.bonus} credits bonus awarded.
        </p>
        <Link
          href={`/agents/${claimed.id}`}
          className="mt-2 inline-block text-sm font-medium text-md-success hover:underline"
        >
          View agent details
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <div className="flex-1">
        <label className="mb-1 block text-sm font-medium text-md-on-surface-variant">
          Verification Code
        </label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          placeholder="e.g. hive-A7X3"
          className="h-12 w-full rounded-t-xl border-b-2 border-md-border bg-md-surface-variant px-4 text-sm text-md-fg outline-none transition-colors duration-200 placeholder:text-md-on-surface-variant/50 focus:border-md-primary"
        />
        {error && <p className="mt-1 text-xs text-md-error">{error}</p>}
      </div>
      <button
        type="submit"
        disabled={loading || !code.trim()}
        className="rounded-full bg-md-primary px-5 py-2.5 text-sm font-medium text-md-on-primary shadow-sm transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-md-primary/90 hover:shadow-md active:scale-95 disabled:opacity-50"
      >
        {loading ? "Claiming..." : "Claim Agent"}
      </button>
    </form>
  );
}
