"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function SubmitGitHubForm({ taskId }: { taskId: number }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [envFile, setEnvFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!repoUrl.trim()) {
      setError("Repository URL is required");
      return;
    }

    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.set("repoUrl", repoUrl.trim());
    if (branch.trim()) formData.set("branch", branch.trim());
    if (envFile) formData.set("envFile", envFile);

    try {
      const res = await fetch(`/api/tasks/${taskId}/submit-github`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setRepoUrl("");
        setBranch("");
        setEnvFile(null);
        router.refresh();
      } else {
        setError(data.error || "Failed to deploy");
      }
    } catch {
      setError("Failed to deploy");
    }
    setSubmitting(false);
  }

  return (
    <div className="rounded-3xl bg-md-surface-container p-5 shadow-sm">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-md-on-surface-variant">
            GitHub Repository URL <span className="text-md-error">*</span>
          </label>
          <input
            type="url"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="h-12 w-full rounded-t-xl border-b-2 border-md-border bg-md-surface-variant px-4 text-sm text-md-fg outline-none transition-colors duration-200 placeholder:text-md-on-surface-variant/50 focus:border-md-primary"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-md-on-surface-variant">
            Branch <span className="text-xs text-md-on-surface-variant/50">(optional, defaults to main)</span>
          </label>
          <input
            type="text"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="main"
            className="h-12 w-full rounded-t-xl border-b-2 border-md-border bg-md-surface-variant px-4 text-sm text-md-fg outline-none transition-colors duration-200 placeholder:text-md-on-surface-variant/50 focus:border-md-primary"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-md-on-surface-variant">
            Environment File <span className="text-xs text-md-on-surface-variant/50">(optional .env)</span>
          </label>
          {envFile ? (
            <div className="flex items-center justify-between rounded-xl bg-md-surface-variant px-3 py-1.5">
              <span className="text-sm text-md-fg">{envFile.name}</span>
              <button
                onClick={() => { setEnvFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                className="text-xs text-md-error hover:text-md-error/80"
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full border border-md-border px-3 py-1.5 text-sm text-md-on-surface-variant transition-all duration-200 hover:bg-md-primary/10 active:scale-95"
            >
              Upload .env file
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            onChange={(e) => { if (e.target.files?.[0]) setEnvFile(e.target.files[0]); }}
            className="hidden"
            accept=".env,.env.local,.env.production,.env.development"
          />
        </div>
      </div>

      <div className="mt-4">
        <button
          onClick={handleSubmit}
          disabled={submitting || !repoUrl.trim()}
          className="rounded-full bg-md-success px-5 py-2 text-sm font-medium text-white shadow-sm transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-md-success/90 hover:shadow-md active:scale-95 disabled:opacity-50"
        >
          {submitting ? "Deploying..." : "Deploy Preview"}
        </button>
      </div>

      {error && (
        <p className="mt-2 rounded-xl bg-md-error-container p-2 text-xs text-md-error">{error}</p>
      )}

      <p className="mt-2 text-xs text-md-on-surface-variant/70">
        Public GitHub repos only. Vercel will clone and build the repo directly.
      </p>
    </div>
  );
}
