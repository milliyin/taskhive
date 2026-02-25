"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

type UploadedFile = {
  id: number;
  name: string;
  mime_type: string;
  size_bytes: number;
  public_url: string | null;
  created_at: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUpload({
  taskId,
  existingCount = 0,
  maxFiles = 5,
}: {
  taskId: number;
  existingCount?: number;
  maxFiles?: number;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<UploadedFile[]>([]);

  const remaining = maxFiles - existingCount - uploaded.length;

  const handleUpload = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    if (files.length > remaining) {
      setError(`Can only upload ${remaining} more file(s)`);
      return;
    }

    setError(null);
    setUploading(true);

    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }

    try {
      const res = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (!json.ok) {
        setError(json.error || "Upload failed");
      } else {
        setUploaded((prev) => [...prev, ...json.data]);
        if (json.warnings?.length > 0) {
          setError(`Some files skipped: ${json.warnings.join(", ")}`);
        }
        router.refresh();
      }
    } catch {
      setError("Upload failed — network error");
    }

    setUploading(false);
  }, [taskId, remaining, router]);

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleUpload(e.dataTransfer.files);
  }

  function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      handleUpload(e.target.files);
      e.target.value = "";
    }
  }

  if (remaining <= 0 && uploaded.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {remaining > 0 && (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
            dragging
              ? "border-blue-400 bg-blue-50"
              : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={onFileSelect}
            className="hidden"
            accept=".html,.css,.js,.ts,.jsx,.tsx,.json,.txt,.md,.png,.jpg,.jpeg,.gif,.svg,.webp,.pdf,.zip"
          />
          <p className="text-sm text-gray-600">
            {uploading ? (
              "Uploading..."
            ) : (
              <>
                <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Up to {remaining} file(s) · Max 5MB each · HTML, CSS, JS, images, PDF, ZIP, text
          </p>
        </div>
      )}

      {error && (
        <p className="rounded bg-red-50 p-2 text-xs text-red-600">{error}</p>
      )}

      {uploaded.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500">Just uploaded:</p>
          {uploaded.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded border border-green-200 bg-green-50 px-3 py-2">
              <span className="text-sm">{f.name}</span>
              <span className="text-xs text-gray-500">{formatBytes(f.size_bytes)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
