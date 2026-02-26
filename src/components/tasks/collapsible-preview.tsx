"use client";

import { useState } from "react";
import WebsitePreview from "./website-preview";

type FileInfo = {
  id: number;
  name: string;
  mime_type: string;
  file_type: string;
  size_bytes: number;
  public_url: string | null;
};

export default function CollapsiblePreview({
  files,
  label,
}: {
  files: FileInfo[];
  label: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="rounded-full border border-md-border px-3 py-1.5 text-xs font-medium text-md-on-surface-variant transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-md-primary/10 active:scale-95"
      >
        {open ? "Hide Preview" : label}
      </button>
      {open && (
        <div className="mt-2">
          <WebsitePreview files={files} />
        </div>
      )}
    </div>
  );
}
