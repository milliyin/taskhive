"use client";

import { useState } from "react";

type FileInfo = {
  id: number;
  name: string;
  mime_type: string;
  file_type: string;
  size_bytes: number;
  public_url: string | null;
};

const FILE_ICONS: Record<string, string> = {
  html: "HTML", css: "CSS", js: "JS",
  image: "IMG", pdf: "PDF", zip: "ZIP",
  text: "TXT", other: "FILE",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function downloadFile(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

function SingleFilePreview({ file }: { file: FileInfo }) {
  const [showSource, setShowSource] = useState(false);
  const [sourceContent, setSourceContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isImage = file.file_type === "image";
  const isPdf = file.file_type === "pdf";
  const isCode = ["html", "css", "js", "text"].includes(file.file_type);

  async function loadSource() {
    if (sourceContent !== null || !file.public_url) return;
    setLoading(true);
    try {
      const res = await fetch(file.public_url);
      const text = await res.text();
      setSourceContent(text);
    } catch {
      setSourceContent("// Failed to load file content");
    }
    setLoading(false);
  }

  if (!file.public_url) {
    return (
      <div className="flex items-center gap-3 rounded border border-gray-200 bg-gray-50 p-3">
        <span className="rounded bg-gray-200 px-2 py-1 text-xs font-mono font-bold">
          {FILE_ICONS[file.file_type] || "FILE"}
        </span>
        <div>
          <p className="text-sm font-medium">{file.name}</p>
          <p className="text-xs text-gray-500">{formatBytes(file.size_bytes)}</p>
        </div>
      </div>
    );
  }

  if (isImage) {
    return (
      <div className="rounded border border-gray-200 bg-gray-50 p-2">
        <img
          src={file.public_url}
          alt={file.name}
          className="max-h-80 rounded object-contain"
          loading="lazy"
        />
        <p className="mt-1 text-xs text-gray-500">{file.name} · {formatBytes(file.size_bytes)}</p>
      </div>
    );
  }

  if (isPdf) {
    return (
      <div className="rounded border border-gray-200">
        <iframe
          src={file.public_url}
          className="h-96 w-full rounded"
          title={file.name}
        />
        <p className="p-2 text-xs text-gray-500">{file.name} · {formatBytes(file.size_bytes)}</p>
      </div>
    );
  }

  if (isCode) {
    return (
      <div className="rounded border border-gray-200">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="rounded bg-gray-200 px-2 py-0.5 text-xs font-mono font-bold">
              {FILE_ICONS[file.file_type]}
            </span>
            <span className="text-sm font-medium">{file.name}</span>
            <span className="text-xs text-gray-500">{formatBytes(file.size_bytes)}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                await loadSource();
                setShowSource(!showSource);
              }}
              className="rounded bg-gray-200 px-2 py-1 text-xs hover:bg-gray-300"
            >
              {showSource ? "Hide Source" : "View Source"}
            </button>
            <button
              onClick={() => downloadFile(file.public_url!, file.name)}
              className="rounded bg-gray-200 px-2 py-1 text-xs hover:bg-gray-300"
            >
              Download
            </button>
          </div>
        </div>
        {showSource && (
          <div className="max-h-80 overflow-auto bg-gray-900 p-3">
            {loading ? (
              <p className="text-sm text-gray-400">Loading...</p>
            ) : (
              <pre className="whitespace-pre-wrap text-xs text-green-400 font-mono">{sourceContent}</pre>
            )}
          </div>
        )}
      </div>
    );
  }

  // Default: download link
  return (
    <div className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center gap-3">
        <span className="rounded bg-gray-200 px-2 py-1 text-xs font-mono font-bold">
          {FILE_ICONS[file.file_type] || "FILE"}
        </span>
        <div>
          <p className="text-sm font-medium">{file.name}</p>
          <p className="text-xs text-gray-500">{file.mime_type} · {formatBytes(file.size_bytes)}</p>
        </div>
      </div>
      <button
        onClick={() => downloadFile(file.public_url!, file.name)}
        className="rounded bg-gray-200 px-2 py-1 text-xs hover:bg-gray-300"
      >
        Download
      </button>
    </div>
  );
}

export default function FilePreview({ files }: { files: FileInfo[] }) {
  if (!files || files.length === 0) return null;

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <SingleFilePreview key={file.id} file={file} />
      ))}
    </div>
  );
}
