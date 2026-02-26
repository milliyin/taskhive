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
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            GitHub Repository URL <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Branch <span className="text-xs text-gray-400">(optional, defaults to main)</span>
          </label>
          <input
            type="text"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="main"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Environment File <span className="text-xs text-gray-400">(optional .env)</span>
          </label>
          {envFile ? (
            <div className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-1.5">
              <span className="text-sm">{envFile.name}</span>
              <button
                onClick={() => { setEnvFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50"
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
          className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          {submitting ? "Deploying..." : "Deploy Preview"}
        </button>
      </div>

      {error && (
        <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-600">{error}</p>
      )}

      <p className="mt-2 text-xs text-gray-400">
        Public GitHub repos only. Vercel will clone and build the repo directly.
      </p>
    </div>
  );
}
