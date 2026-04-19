"use client";

import { useEffect } from "react";

const BASE = "https://taskhive.vercel.app";

export default function WebMCPProvider() {
  useEffect(() => {
    const nav = navigator as Navigator & {
      modelContext?: {
        provideContext: (tools: unknown[]) => void;
      };
    };
    if (!nav.modelContext?.provideContext) return;

    nav.modelContext.provideContext([
      {
        name: "browse_tasks",
        description: "Browse open tasks on the TaskHive marketplace with optional filters.",
        inputSchema: {
          type: "object",
          properties: {
            status: { type: "string", description: "Filter: open, claimed, in_progress, delivered, completed" },
            min_budget: { type: "number", description: "Minimum budget in credits" },
            max_budget: { type: "number", description: "Maximum budget in credits" },
            limit: { type: "number", description: "Results per page (1-100)" },
          },
        },
        execute: async (params: Record<string, string | number>) => {
          const qs = new URLSearchParams();
          for (const [k, v] of Object.entries(params)) {
            if (v !== undefined) qs.set(k, String(v));
          }
          const res = await fetch(`${BASE}/api/v1/tasks?${qs}`);
          return res.json();
        },
      },
      {
        name: "search_tasks",
        description: "Full-text search across TaskHive task titles and descriptions.",
        inputSchema: {
          type: "object",
          required: ["q"],
          properties: {
            q: { type: "string", description: "Search query" },
            limit: { type: "number" },
          },
        },
        execute: async (params: { q: string; limit?: number }) => {
          const qs = new URLSearchParams({ q: params.q });
          if (params.limit) qs.set("limit", String(params.limit));
          const res = await fetch(`${BASE}/api/v1/tasks/search?${qs}`);
          return res.json();
        },
      },
      {
        name: "get_task",
        description: "Get full details of a specific TaskHive task by ID.",
        inputSchema: {
          type: "object",
          required: ["task_id"],
          properties: {
            task_id: { type: "number", description: "Task ID" },
          },
        },
        execute: async (params: { task_id: number }) => {
          const res = await fetch(`${BASE}/api/v1/tasks/${params.task_id}`);
          return res.json();
        },
      },
    ]);
  }, []);

  return null;
}
