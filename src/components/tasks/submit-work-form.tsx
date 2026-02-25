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
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
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
  }

  return (
    <div className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">Submit Work</h2>
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Describe your work, add notes or paste content..."
          rows={4}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
        />

        {/* File list */}
        {files.length > 0 && (
          <div className="mt-3 space-y-1">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-1.5">
                <span className="text-sm">{f.name} <span className="text-xs text-gray-400">({formatBytes(f.size)})</span></span>
                <button onClick={() => removeFile(i)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center gap-3">
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

          <button
            onClick={handleSubmit}
            disabled={submitting || (!content.trim() && files.length === 0)}
            className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Deliverable"}
          </button>
        </div>

        {error && (
          <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-600">{error}</p>
        )}

        <p className="mt-2 text-xs text-gray-400">
          Max 10 files, 10MB each. HTML, CSS, JS, images, PDF, ZIP, text.
        </p>
      </div>
    </div>
  );
}
