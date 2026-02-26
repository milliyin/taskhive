"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SubmitWorkForm({ taskId }: { taskId: number }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const envFileInputRef = useRef<HTMLInputElement>(null);

  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [envFile, setEnvFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addFiles(fileList: FileList | File[]) {
    const newFiles = Array.from(fileList);
    setFiles((prev) => [...prev, ...newFiles].slice(0, 10));
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!content.trim() && files.length === 0 && !repoUrl.trim()) {
      setError("Provide notes, files, or a GitHub link");
      return;
    }

    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.set("content", content.trim());
    for (const file of files) {
      formData.append("files", file);
    }
    if (repoUrl.trim()) {
      formData.set("repoUrl", repoUrl.trim());
      if (branch.trim()) formData.set("branch", branch.trim());
      if (envFile) formData.set("envFile", envFile);
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
        setRepoUrl("");
        setBranch("");
        setEnvFile(null);
        router.refresh();
      } else {
        setError(data.error || "Failed to submit");
      }
    } catch {
      setError("Failed to submit");
    }
    setSubmitting(false);
  }

  const canSubmit = content.trim() || files.length > 0 || repoUrl.trim();

  return (
    <div className="mb-8">
      <h2 className="mb-3 text-lg font-medium text-md-fg">Submit Work</h2>
      <div className="space-y-4 rounded-3xl bg-md-surface-container p-5 shadow-sm">
        {/* Delivery notes */}
        <div>
          <label className="mb-1 block text-xs font-medium text-md-on-surface-variant">
            Delivery Notes
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Describe your work, add notes or paste content..."
            rows={3}
            className="w-full rounded-t-xl border-b-2 border-md-border bg-md-surface-variant px-4 py-3 text-sm text-md-fg outline-none transition-colors duration-200 placeholder:text-md-on-surface-variant/50 focus:border-md-primary"
          />
        </div>

        {/* File uploads */}
        <div>
          <label className="mb-1 block text-xs font-medium text-md-on-surface-variant">
            Files <span className="text-xs font-normal text-md-on-surface-variant/50">(optional)</span>
          </label>

          {files.length > 0 && (
            <div className="mb-2 space-y-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-md-surface-variant px-3 py-1.5">
                  <span className="text-sm text-md-fg">{f.name} <span className="text-xs text-md-on-surface-variant/70">({formatBytes(f.size)})</span></span>
                  <button onClick={() => removeFile(i)} className="text-xs text-md-error hover:text-md-error/80">Remove</button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full border border-md-border px-3 py-1.5 text-sm text-md-on-surface-variant transition-all duration-200 hover:bg-md-primary/10 active:scale-95"
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
          <p className="mt-1 text-xs text-md-on-surface-variant/70">
            Max 10 files, 10MB each.
          </p>
        </div>

        {/* GitHub repo (optional) */}
        <div className="border-t border-md-outline-variant/20 pt-4">
          <label className="mb-1 block text-xs font-medium text-md-on-surface-variant">
            GitHub Repository <span className="text-xs font-normal text-md-on-surface-variant/50">(optional)</span>
          </label>
          <input
            type="url"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="w-full rounded-t-xl border-b-2 border-md-border bg-md-surface-variant px-4 py-3 text-sm text-md-fg outline-none transition-colors duration-200 placeholder:text-md-on-surface-variant/50 focus:border-md-primary"
          />

          {repoUrl.trim() && (
            <div className="mt-2 space-y-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-md-on-surface-variant">
                  Branch <span className="text-xs font-normal text-md-on-surface-variant/50">(defaults to main)</span>
                </label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  className="w-full rounded-t-xl border-b-2 border-md-border bg-md-surface-variant px-4 py-3 text-sm text-md-fg outline-none transition-colors duration-200 placeholder:text-md-on-surface-variant/50 focus:border-md-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-md-on-surface-variant">
                  Environment File <span className="text-xs font-normal text-md-on-surface-variant/50">(.env)</span>
                </label>
                {envFile ? (
                  <div className="flex items-center justify-between rounded-xl bg-md-surface-variant px-3 py-1.5">
                    <span className="text-sm text-md-fg">{envFile.name}</span>
                    <button
                      onClick={() => { setEnvFile(null); if (envFileInputRef.current) envFileInputRef.current.value = ""; }}
                      className="text-xs text-md-error hover:text-md-error/80"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => envFileInputRef.current?.click()}
                    className="rounded-full border border-md-border px-3 py-1.5 text-sm text-md-on-surface-variant transition-all duration-200 hover:bg-md-primary/10 active:scale-95"
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
              <p className="text-xs text-md-on-surface-variant/70">
                If the repo is a web project, a live preview will be deployed automatically.
              </p>
            </div>
          )}
        </div>

        {/* Submit button + error */}
        <div>
          <button
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
            className="rounded-full bg-md-success px-5 py-2 text-sm font-medium text-white shadow-sm transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-md-success/90 hover:shadow-md active:scale-95 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Deliverable"}
          </button>
        </div>

        {error && (
          <p className="rounded-xl bg-md-error-container p-2 text-xs text-md-error">{error}</p>
        )}
      </div>
    </div>
  );
}
