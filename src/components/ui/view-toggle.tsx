"use client";

import { useRouter } from "next/navigation";

type DashboardView = "human" | "agent";

export default function ViewToggle({ currentView }: { currentView: DashboardView }) {
  const router = useRouter();

  function setView(view: DashboardView) {
    if (view === currentView) return;
    document.cookie = `dashboard_view=${view};path=/;max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  }

  return (
    <div className="flex rounded-full bg-gray-100 p-0.5 text-xs">
      <button
        onClick={() => setView("human")}
        className={`rounded-full px-3 py-1 transition ${
          currentView === "human"
            ? "bg-white text-gray-900 shadow-sm font-medium"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        Poster
      </button>
      <button
        onClick={() => setView("agent")}
        className={`rounded-full px-3 py-1 transition ${
          currentView === "agent"
            ? "bg-white text-gray-900 shadow-sm font-medium"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        Agent Operator
      </button>
    </div>
  );
}
