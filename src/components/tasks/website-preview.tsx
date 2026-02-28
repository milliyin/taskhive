"use client";

import { useState, useEffect, useMemo } from "react";

type FileInfo = {
  id: number;
  name: string;
  mime_type: string;
  file_type: string;
  size_bytes: number;
  public_url: string | null;
};

type Viewport = "desktop" | "tablet" | "mobile";

const VIEWPORT_WIDTHS: Record<Viewport, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function WebsitePreview({ files }: { files: FileInfo[] }) {
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [activeTab, setActiveTab] = useState<"preview" | string>("preview");
  const [fileSources, setFileSources] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Separate web files from others
  const webFiles = useMemo(() => {
    const html = files.filter((f) => f.file_type === "html");
    const css = files.filter((f) => f.file_type === "css");
    const js = files.filter((f) => f.file_type === "js");
    return { html, css, js, all: [...html, ...css, ...js] };
  }, [files]);

  const hasWebFiles = webFiles.html.length > 0;

  // Fetch all web file contents for building the preview
  useEffect(() => {
    if (!hasWebFiles) return;

    async function fetchSources() {
      setLoading(true);
      const sources: Record<string, string> = {};
      await Promise.all(
        webFiles.all.map(async (f) => {
          if (!f.public_url) return;
          try {
            const res = await fetch(f.public_url);
            sources[f.name] = await res.text();
          } catch {
            sources[f.name] = `/* Failed to load ${f.name} */`;
          }
        })
      );
      setFileSources(sources);
      setLoading(false);
    }

    fetchSources();
  }, [hasWebFiles, webFiles.all]);

  if (!hasWebFiles) return null;

  // Build combined HTML for iframe srcdoc
  const htmlFile = webFiles.html[0];
  let htmlContent = fileSources[htmlFile.name] || "";

  // Inject CSS into <head>
  const cssBlocks = webFiles.css
    .map((f) => fileSources[f.name])
    .filter(Boolean)
    .map((src) => `<style>${src}</style>`)
    .join("\n");

  // Inject JS before </body>
  const jsBlocks = webFiles.js
    .map((f) => fileSources[f.name])
    .filter(Boolean)
    .map((src) => `<script>${src}<\/script>`)
    .join("\n");

  // If the HTML has a <head>, inject CSS there; otherwise wrap
  if (htmlContent.includes("</head>")) {
    htmlContent = htmlContent.replace("</head>", `${cssBlocks}\n</head>`);
  } else if (cssBlocks) {
    htmlContent = `${cssBlocks}\n${htmlContent}`;
  }

  if (htmlContent.includes("</body>")) {
    htmlContent = htmlContent.replace("</body>", `${jsBlocks}\n</body>`);
  } else if (jsBlocks) {
    htmlContent = `${htmlContent}\n${jsBlocks}`;
  }

  // Build blob URL for "Open in New Tab" link
  const blobUrl = useMemo(() => {
    if (!htmlContent) return "";
    const blob = new Blob([htmlContent], { type: "text/html" });
    return URL.createObjectURL(blob);
  }, [htmlContent]);

  const tabFiles = webFiles.all;

  return (
    <div className="overflow-hidden rounded-2xl border border-md-outline-variant/20 bg-md-surface-container">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-md-outline-variant/20 bg-md-surface-variant px-3 py-2">
        {/* Tabs */}
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("preview")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 ${
              activeTab === "preview"
                ? "bg-md-primary text-md-on-primary"
                : "bg-md-secondary-container text-md-on-secondary-container hover:bg-md-primary/10"
            }`}
          >
            Preview
          </button>
          {tabFiles.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveTab(f.name)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 ${
                activeTab === f.name
                  ? "bg-md-primary text-md-on-primary"
                  : "bg-md-secondary-container text-md-on-secondary-container hover:bg-md-primary/10"
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>

        {/* Viewport + actions */}
        <div className="flex items-center gap-2">
          {activeTab === "preview" && (
            <div className="flex overflow-hidden rounded-full border border-md-border">
              {(["desktop", "tablet", "mobile"] as Viewport[]).map((vp) => (
                <button
                  key={vp}
                  onClick={() => setViewport(vp)}
                  className={`px-2.5 py-1 text-xs transition-colors ${
                    viewport === vp
                      ? "bg-md-primary text-md-on-primary"
                      : "bg-md-surface text-md-on-surface-variant hover:bg-md-primary/10"
                  }`}
                  title={`${vp} (${VIEWPORT_WIDTHS[vp]})`}
                >
                  {vp === "desktop" ? "Desktop" : vp === "tablet" ? "Tablet" : "Mobile"}
                </button>
              ))}
            </div>
          )}
          <a
            href={blobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer rounded-full bg-md-secondary-container px-2.5 py-1 text-xs text-md-on-secondary-container transition-all duration-200 hover:bg-md-primary/10"
          >
            Open in New Tab
          </a>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex h-64 items-center justify-center text-sm text-md-on-surface-variant">
          Loading preview...
        </div>
      ) : activeTab === "preview" ? (
        <div className="flex justify-center bg-md-surface-variant/50 p-4">
          <iframe
            srcDoc={htmlContent}
            sandbox="allow-scripts"
            className="h-[500px] rounded-xl border border-md-outline-variant/20 bg-white transition-all"
            style={{ width: VIEWPORT_WIDTHS[viewport] }}
            title="Website Preview"
          />
        </div>
      ) : (
        <div className="max-h-96 overflow-auto bg-md-fg p-4">
          <pre className="whitespace-pre-wrap text-xs text-green-400 font-mono">
            {fileSources[activeTab] || "// No content loaded"}
          </pre>
        </div>
      )}

      {/* File list footer */}
      <div className="border-t border-md-outline-variant/20 bg-md-surface-variant px-3 py-2">
        <div className="flex flex-wrap gap-3">
          {webFiles.all.map((f) => (
            <span key={f.id} className="text-xs text-md-on-surface-variant">
              <span className="font-mono font-medium text-md-fg">{f.name}</span>
              {" "}({formatBytes(f.size_bytes)})
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
