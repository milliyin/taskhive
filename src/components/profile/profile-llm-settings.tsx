"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

interface ProfileLlmSettingsProps {
  currentProvider: string | null;
  hasKey: boolean;
}

export default function ProfileLlmSettings({ currentProvider, hasKey }: ProfileLlmSettingsProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const formData = new FormData(e.currentTarget);
    const provider = formData.get("llmProvider") as string;
    const key = formData.get("llmKey") as string;

    if (!provider || !key) {
      setError("Both provider and API key are required");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/profile/llm-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ llmProvider: provider, llmKey: key }),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error || "Failed to save");
    } else {
      setMessage("LLM key saved");
      router.refresh();
    }

    setLoading(false);
  }

  async function handleRemove() {
    setLoading(true);
    setMessage("");
    setError("");

    const res = await fetch("/api/profile/llm-settings", { method: "DELETE" });

    if (!res.ok) {
      setError("Failed to remove");
    } else {
      setMessage("LLM key removed");
      router.refresh();
    }

    setLoading(false);
  }

  const inputClass = "h-14 w-full rounded-t-xl border-b-2 border-md-border bg-md-surface-variant px-4 text-sm text-md-fg outline-none transition-colors duration-200 placeholder:text-md-on-surface-variant/50 focus:border-md-primary";

  return (
    <div>
      {hasKey && (
        <div className="mb-3 flex items-center justify-between rounded-2xl bg-md-success-container px-4 py-3">
          <span className="text-sm text-md-success">
            Provider: <strong>{currentProvider}</strong> — Key configured
          </span>
          <button
            onClick={handleRemove}
            disabled={loading}
            className="rounded-full px-3 py-1 text-xs text-md-error transition-colors hover:bg-md-error/10 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-md-on-surface-variant">LLM Provider</label>
          <select name="llmProvider" defaultValue={currentProvider || ""} className={inputClass}>
            <option value="">Select provider</option>
            <option value="openrouter">OpenRouter</option>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-md-on-surface-variant">API Key</label>
          <input
            name="llmKey"
            type="password"
            className={inputClass}
            placeholder={hasKey ? "Enter new key to replace" : "sk-... or sk-or-v1-..."}
          />
          <p className="mt-1 text-xs text-md-on-surface-variant">
            Used for AI auto-review on your tasks. Encrypted at rest, never exposed in API responses.
          </p>
        </div>

        {error && <p className="text-xs text-md-error">{error}</p>}
        {message && <p className="text-xs text-md-success">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-md-primary px-6 py-2.5 text-sm font-medium text-md-on-primary shadow-sm transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-md-primary/90 hover:shadow-md active:scale-95 disabled:opacity-50"
        >
          {loading ? "Saving..." : hasKey ? "Update Key" : "Save Key"}
        </button>
      </form>
    </div>
  );
}
