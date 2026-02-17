// Location: src/components/agents/api-key-manager.js
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ApiKeyManager({ agentId, currentPrefix }) {
  const [loading, setLoading] = useState(false);
  const [newKey, setNewKey] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showConfirm, setShowConfirm] = useState(null); // "revoke" | "regenerate" | null
  const router = useRouter();

  async function generateKey() {
    setLoading(true);
    const res = await fetch(`/api/agents/${agentId}/key`, { method: "POST" });
    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setNewKey(data.key);
    }
  }

  async function revokeKey() {
    setLoading(true);
    await fetch(`/api/agents/${agentId}/revoke`, { method: "POST" });
    setLoading(false);
    setShowConfirm(null);
    router.refresh();
  }

  async function regenerateKey() {
    setLoading(true);
    // Revoke old, then generate new
    await fetch(`/api/agents/${agentId}/revoke`, { method: "POST" });
    const res = await fetch(`/api/agents/${agentId}/key`, { method: "POST" });
    const data = await res.json();
    setLoading(false);
    setShowConfirm(null);

    if (res.ok) {
      setNewKey(data.key);
    }
  }

  async function copyKey() {
    if (newKey) {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function closeKeyModal() {
    setNewKey(null);
    setCopied(false);
    router.refresh();
  }

  // ─── New Key Modal (shown ONCE) ──────────────────────────────────
  if (newKey) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
          <h3 className="mb-2 text-lg font-bold text-green-700">API Key Generated</h3>
          <p className="mb-4 text-sm text-red-600 font-medium">
            Copy this key now — it will never be shown again!
          </p>

          <div className="mb-4 rounded-lg bg-gray-900 p-4">
            <code className="block break-all text-sm text-green-400">{newKey}</code>
          </div>

          <div className="flex gap-3">
            <button
              onClick={copyKey}
              className="flex-1 rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
            >
              {copied ? "Copied!" : "Copy to Clipboard"}
            </button>
            <button
              onClick={closeKeyModal}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium transition hover:bg-gray-50"
            >
              Done
            </button>
          </div>

          <p className="mt-3 text-xs text-gray-400">
            Use this key in the Authorization header: Bearer {newKey.substring(0, 20)}...
          </p>
        </div>
      </div>
    );
  }

  // ─── Confirm Dialog ──────────────────────────────────────────────
  if (showConfirm) {
    const isRevoke = showConfirm === "revoke";
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
          <h3 className="mb-2 text-lg font-bold">
            {isRevoke ? "Revoke API Key?" : "Regenerate API Key?"}
          </h3>
          <p className="mb-4 text-sm text-gray-600">
            {isRevoke
              ? "This will immediately invalidate the current API key. Any agent using this key will lose access."
              : "This will revoke the old key and generate a new one. The old key will stop working immediately."}
          </p>
          <div className="flex gap-3">
            <button
              onClick={isRevoke ? revokeKey : regenerateKey}
              disabled={loading}
              className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? "Processing..." : isRevoke ? "Revoke Key" : "Regenerate Key"}
            </button>
            <button
              onClick={() => setShowConfirm(null)}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium transition hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main View ───────────────────────────────────────────────────
  return (
    <div>
      {currentPrefix ? (
        <div>
          <div className="mb-3 flex items-center gap-3">
            <span className="text-sm text-gray-500">Current key:</span>
            <code className="rounded bg-gray-100 px-2 py-1 text-sm font-mono">{currentPrefix}…</code>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowConfirm("regenerate")}
              disabled={loading}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
            >
              Regenerate Key
            </button>
            <button
              onClick={() => setShowConfirm("revoke")}
              disabled={loading}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              Revoke Key
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="mb-3 text-sm text-gray-500">No API key configured. Generate one to enable API access.</p>
          <button
            onClick={generateKey}
            disabled={loading}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? "Generating..." : "Generate API Key"}
          </button>
        </div>
      )}
    </div>
  );
}