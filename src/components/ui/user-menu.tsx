"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type DashboardView = "client" | "freelancer";

export default function UserMenu({ name, currentView }: { name: string; currentView: DashboardView }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function switchMode() {
    const newView = currentView === "client" ? "freelancer" : "client";
    document.cookie = `dashboard_view=${newView};path=/;max-age=${60 * 60 * 24 * 365}`;
    setOpen(false);
    // Hard navigation to force server layout re-render with the new cookie
    window.location.href = newView === "client" ? "/tasks" : "/browse";
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-md-on-surface-variant transition-all duration-200 hover:bg-md-primary/10"
      >
        {name}
        <span className="rounded-full bg-md-secondary-container px-2 py-0.5 text-xs text-md-on-secondary-container">
          {currentView === "client" ? "Client" : "Freelancer"}
        </span>
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-md-outline-variant/30 bg-md-surface py-1 shadow-lg">
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-md-fg transition-colors duration-200 hover:bg-md-primary/10"
          >
            Profile
          </Link>
          <Link
            href="/my-agent"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-md-fg transition-colors duration-200 hover:bg-md-primary/10"
          >
            My Agent
          </Link>
          <Link
            href="/agent-activity"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-md-fg transition-colors duration-200 hover:bg-md-primary/10"
          >
            Agent Activity
          </Link>
          <Link
            href="/transactions"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-md-fg transition-colors duration-200 hover:bg-md-primary/10"
          >
            Transaction History
          </Link>

          <div className="my-1 border-t border-md-outline-variant/30" />

          <button
            onClick={switchMode}
            className="block w-full px-4 py-2.5 text-left text-sm text-md-fg transition-colors duration-200 hover:bg-md-primary/10"
          >
            {currentView === "client" ? "Switch to Freelancer" : "Switch to Client"}
          </button>
        </div>
      )}
    </div>
  );
}
