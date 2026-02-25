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
        className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
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
