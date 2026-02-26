"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface GitHubDeliveryProps {
  taskId: number;
  sourceRepoUrl: string;
  sourceBranch: string | null;
  previewUrl: string | null;
  deployStatus: string;
  errorMessage: string | null;
  isWorker: boolean;
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-md-on-surface-variant",
    deploying: "bg-md-tertiary animate-pulse",
    ready: "bg-md-success",
    error: "bg-md-error",
  };
  return (
    <span className={`inline-block h-2 w-2 rounded-full ${colors[status] || "bg-md-on-surface-variant"}`} />
  );
}

function StatusLabel({ status }: { status: string }) {
  const labels: Record<string, string> = {
    pending: "Pending",
    deploying: "Deploying...",
    ready: "Live",
    error: "Failed",
  };
  return <span className="text-xs font-medium text-md-fg">{labels[status] || status}</span>;
}

export default function GitHubDeliveryCard({
  taskId,
  sourceRepoUrl,
  sourceBranch,
  previewUrl: initialPreviewUrl,
  deployStatus: initialStatus,
  errorMessage: initialError,
  isWorker,
}: GitHubDeliveryProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [previewUrl, setPreviewUrl] = useState(initialPreviewUrl);
  const [errorMsg, setErrorMsg] = useState(initialError);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/deploy-status`);
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data.deployStatus);
      if (data.previewUrl) setPreviewUrl(data.previewUrl);
      if (data.errorMessage) setErrorMsg(data.errorMessage);
      // Refresh server components when deployment finishes
      if (data.deployStatus === "ready" || data.deployStatus === "error") {
        router.refresh();
      }
    } catch {
      // silent fail — will retry on next interval
    }
  }, [taskId, router]);

  // Auto-poll every 5s while deploying
  useEffect(() => {
    if (status !== "deploying" && status !== "pending") return;
    const interval = setInterval(pollStatus, 5000);
    return () => clearInterval(interval);
  }, [status, pollStatus]);

  async function handleSync() {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/sync-github`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setStatus("deploying");
        setErrorMsg(null);
        router.refresh();
      } else {
        setSyncError(data.error || "Sync failed");
      }
    } catch {
      setSyncError("Sync failed");
    }
    setSyncing(false);
  }

  const isSkipped = status === "skipped";

  return (
    <div className="rounded-2xl bg-md-surface-variant p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-md-on-surface-variant" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          <a
            href={sourceRepoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-md-primary hover:underline"
          >
            {sourceRepoUrl.replace("https://github.com/", "")}
          </a>
          {sourceBranch && (
            <span className="rounded-full bg-md-secondary-container px-1.5 py-0.5 text-xs text-md-on-secondary-container">
              {sourceBranch}
            </span>
          )}
        </div>
        {!isSkipped && (
          <div className="flex items-center gap-1.5">
            <StatusDot status={status} />
            <StatusLabel status={status} />
          </div>
        )}
      </div>

      {!isSkipped && previewUrl && status !== "error" && (
        <div className="mt-2">
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-md-primary hover:underline"
          >
            {previewUrl}
          </a>
        </div>
      )}

      {!isSkipped && previewUrl && status === "ready" && (
        <div className="mt-2 overflow-hidden rounded-xl border border-md-outline-variant/20">
          <iframe
            src={previewUrl}
            title="Preview"
            className="h-80 w-full"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      )}

      {!isSkipped && errorMsg && status === "error" && (
        <div className="mt-2 rounded-xl bg-md-error-container p-2">
          <p className="text-xs text-md-error">{errorMsg}</p>
        </div>
      )}

      {!isSkipped && isWorker && status !== "deploying" && status !== "pending" && (
        <div className="mt-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="rounded-full border border-md-border px-3 py-1 text-xs text-md-on-surface-variant transition-all duration-200 hover:bg-md-primary/10 active:scale-95 disabled:opacity-50"
          >
            {syncing ? "Syncing..." : "Sync Updates"}
          </button>
          {syncError && (
            <span className="ml-2 text-xs text-md-error">{syncError}</span>
          )}
        </div>
      )}
    </div>
  );
}
