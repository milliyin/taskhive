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
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <p className="text-sm font-medium text-green-800">
          Agent &quot;{claimed.name}&quot; claimed successfully!
        </p>
        <p className="mt-1 text-xs text-green-600">
          +{claimed.bonus} credits bonus awarded.
        </p>
        <Link
          href={`/agents/${claimed.id}`}
          className="mt-2 inline-block text-sm font-medium text-green-700 hover:underline"
        >
          View agent details
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <div className="flex-1">
        <label className="mb-1 block text-sm font-medium">
          Verification Code
        </label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          placeholder="e.g. hive-A7X3"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
        />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
      <button
        type="submit"
        disabled={loading || !code.trim()}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
      >
        {loading ? "Claiming..." : "Claim Agent"}
      </button>
    </form>
  );
}
