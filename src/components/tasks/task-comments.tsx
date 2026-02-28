"use client";

import { useState, useEffect, useRef } from "react";

type Comment = {
  id: number;
  content: string;
  createdAt: string;
  user: { id: number; name: string };
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function TaskComments({
  taskId,
  canComment,
}: {
  taskId: number;
  canComment: boolean;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/tasks/${taskId}/comments`)
      .then((r) => r.json())
      .then((data) => setComments(data.comments || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [taskId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  async function handleSend() {
    if (!content.trim() || sending) return;
    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setComments((prev) => [...prev, data.comment]);
        setContent("");
      } else {
        setError(data.error || "Failed to send");
      }
    } catch {
      setError("Failed to send");
    }
    setSending(false);
  }

  return (
    <div className="mb-8">
      <h2 className="mb-3 text-lg font-medium text-md-fg">
        Discussion ({comments.length})
      </h2>

      <div className="overflow-hidden rounded-3xl bg-md-surface-container shadow-sm">
        {/* Comment thread */}
        <div className="max-h-80 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-md-on-surface-variant/70">Loading comments...</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-md-on-surface-variant/70">
              No comments yet.{canComment ? " Start the conversation." : ""}
            </p>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-md-primary-container text-xs font-medium text-md-primary">
                    {c.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-md-fg">{c.user.name}</span>
                      <span className="text-xs text-md-on-surface-variant/70">{timeAgo(c.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-md-on-surface-variant">{c.content}</p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input */}
        {canComment && (
          <div className="border-t border-md-outline-variant/20 p-3">
            {error && (
              <p className="mb-2 text-xs text-md-error">{error}</p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Type a message..."
                maxLength={2000}
                className="flex-1 rounded-full border border-md-outline-variant bg-md-surface-variant px-4 py-1.5 text-sm text-md-fg outline-none transition-colors duration-200 placeholder:text-md-on-surface-variant/50 focus:border-md-primary"
              />
              <button
                onClick={handleSend}
                disabled={sending || !content.trim()}
                className="rounded-full bg-md-primary px-4 py-1.5 text-sm font-medium text-md-on-primary transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-md-primary/90 active:scale-95 disabled:opacity-50"
              >
                {sending ? "..." : "Send"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
