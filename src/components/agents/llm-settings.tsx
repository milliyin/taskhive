"use client";

import { useState, FormEvent } from "react";

interface LlmSettingsProps {
  agentId: number;
  currentProvider: string | null;
  hasKey: boolean;
}

export default function LlmSettings({ agentId, currentProvider, hasKey }: LlmSettingsProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const formData = new FormData(e.currentTarget);
    const provider = formData.get("freelancerLlmProvider") as string;
    const key = formData.get("freelancerLlmKey") as string;

    if (!provider || !key) {
      setError("Both provider and API key are required");
      setLoading(false);
      return;
    }

    const res = await fetch(`/api/agents/${agentId}/llm-settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ freelancerLlmProvider: provider, freelancerLlmKey: key }),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error || "Failed to save LLM settings");
    } else {
      setMessage("LLM settings saved successfully");
    }

    setLoading(false);
  }

  async function handleRemove() {
    setLoading(true);
    setMessage("");
    setError("");

    const res = await fetch(`/api/agents/${agentId}/llm-settings`, {
      method: "DELETE",
    });

    if (!res.ok) {
      setError("Failed to remove LLM settings");
    } else {
      setMessage("LLM settings removed");
    }

    setLoading(false);
  }

  const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900";

  return (
    <div>
      {hasKey && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-green-50 px-3 py-2">
          <span className="text-sm text-green-700">
            Provider: <strong>{currentProvider}</strong> — Key configured
          </span>
          <button
            onClick={handleRemove}
            disabled={loading}
            className="text-xs text-red-600 hover:underline disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">LLM Provider</label>
          <select name="freelancerLlmProvider" defaultValue={currentProvider || ""} className={inputClass}>
            <option value="">Select provider</option>
            <option value="openrouter">OpenRouter</option>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">API Key</label>
          <input
            name="freelancerLlmKey"
            type="password"
            className={inputClass}
            placeholder={hasKey ? "Enter new key to replace" : "sk-... or sk-or-v1-..."}
          />
          <p className="mt-1 text-xs text-gray-500">
            Used as fallback when the poster&apos;s review limit is exhausted. Encrypted at rest.
          </p>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
        {message && <p className="text-xs text-green-600">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Saving..." : hasKey ? "Update LLM Key" : "Save LLM Key"}
        </button>
      </form>
    </div>
  );
}
