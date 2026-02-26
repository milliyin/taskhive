"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type DeliveryMode = "files" | "github";

export default function SubmitWorkForm({ taskId }: { taskId: number }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const envFileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<DeliveryMode>("files");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // File delivery state
  const [files, setFiles] = useState<File[]>([]);

  // GitHub delivery state
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [envFile, setEnvFile] = useState<File | null>(null);

  function addFiles(fileList: FileList | File[]) {
    const newFiles = Array.from(fileList);
    setFiles((prev) => [...prev, ...newFiles].slice(0, 10));
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (mode === "files") {
      if (!content.trim() && files.length === 0) {
        setError("Provide content or upload files");
        return;
      }

      setSubmitting(true);
      setError(null);

      const formData = new FormData();
      formData.set("content", content.trim());
      for (const file of files) {
        formData.append("files", file);
      }

      try {
        const res = await fetch(`/api/tasks/${taskId}/submit-work`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        if (res.ok) {
          setContent("");
          setFiles([]);
          router.refresh();
        } else {
          setError(data.error || "Failed to submit");
        }
      } catch {
        setError("Failed to submit");
      }
      setSubmitting(false);
    } else {
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
  }

  const canSubmit =
    mode === "files"
      ? content.trim() || files.length > 0
      : repoUrl.trim();

  return (
    <div className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">Submit Work</h2>
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        {/* Mode toggle */}
        <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => { setMode("files"); setError(null); }}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              mode === "files"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Upload Files
          </button>
          <button
            onClick={() => { setMode("github"); setError(null); }}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              mode === "github"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            GitHub Repo
          </button>
        </div>

        {/* Notes — shared between both modes */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Describe your work, add notes or paste content..."
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
        />

        {/* File delivery fields */}
        {mode === "files" && (
          <div className="mt-3">
            {files.length > 0 && (
              <div className="mb-3 space-y-1">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-1.5">
                    <span className="text-sm">{f.name} <span className="text-xs text-gray-400">({formatBytes(f.size)})</span></span>
                    <button onClick={() => removeFile(i)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50"
            >
              Attach Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => { if (e.target.files) { addFiles(e.target.files); e.target.value = ""; } }}
              className="hidden"
              accept=".html,.css,.js,.ts,.jsx,.tsx,.json,.txt,.md,.png,.jpg,.jpeg,.gif,.svg,.webp,.pdf,.zip"
            />
            <p className="mt-2 text-xs text-gray-400">
              Max 10 files, 10MB each. HTML, CSS, JS, images, PDF, ZIP, text.
            </p>
          </div>
        )}

        {/* GitHub delivery fields */}
        {mode === "github" && (
          <div className="mt-3 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
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
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Branch <span className="text-xs font-normal text-gray-400">(optional, defaults to main)</span>
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
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Environment File <span className="text-xs font-normal text-gray-400">(optional .env)</span>
              </label>
              {envFile ? (
                <div className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-1.5">
                  <span className="text-sm">{envFile.name}</span>
                  <button
                    onClick={() => { setEnvFile(null); if (envFileInputRef.current) envFileInputRef.current.value = ""; }}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => envFileInputRef.current?.click()}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50"
                >
                  Upload .env file
                </button>
              )}
              <input
                ref={envFileInputRef}
                type="file"
                onChange={(e) => { if (e.target.files?.[0]) setEnvFile(e.target.files[0]); }}
                className="hidden"
                accept=".env,.env.local,.env.production,.env.development"
              />
            </div>
            <p className="text-xs text-gray-400">
              Public GitHub repos only. Vercel will clone and build the repo directly.
            </p>
          </div>
        )}

        {/* Submit button + error */}
        <div className="mt-4">
          <button
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
            className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
          >
            {submitting
              ? mode === "github" ? "Deploying..." : "Submitting..."
              : mode === "github" ? "Deploy Preview" : "Submit Deliverable"}
          </button>
        </div>

        {error && (
          <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-600">{error}</p>
        )}
      </div>
    </div>
  );
}
