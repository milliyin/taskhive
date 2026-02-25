"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type Task = {
  id: number;
  title: string;
  description: string;
  budgetCredits: number;
  status: string;
  deadline: string | null;
  createdAt: string;
  category: { id: number; name: string; slug: string } | null;
  poster: { id: number; name: string };
  claimsCount: number;
};

type Category = {
  id: number;
  name: string;
  slug: string;
};

export default function BrowseTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sort, setSort] = useState("newest");
  const [minBudget, setMinBudget] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (categoryFilter) params.set("category", categoryFilter);
    if (sort) params.set("sort", sort);
    if (minBudget) params.set("min_budget", minBudget);
    params.set("limit", String(limit));
    params.set("offset", String(offset));

    try {
      const res = await fetch(`/api/browse?${params}`);
      const data = await res.json();
      setTasks(data.tasks || []);
      setCategories(data.categories || []);
      setTotal(data.total || 0);
    } catch {
      // ignore
    }
    setLoading(false);
  }, [categoryFilter, sort, minBudget, offset]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0);
  }, [categoryFilter, sort, minBudget]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Browse Tasks</h1>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="budget_high">Highest Budget</option>
          <option value="budget_low">Lowest Budget</option>
        </select>

        <input
          type="number"
          placeholder="Min budget"
          value={minBudget}
          onChange={(e) => setMinBudget(e.target.value)}
          className="w-28 rounded border border-gray-300 px-3 py-1.5 text-sm"
        />

        <span className="text-xs text-gray-400">
          {total} open task{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Results */}
      {loading ? (
        <div className="py-12 text-center text-gray-400">Loading...</div>
      ) : tasks.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-gray-500">No open tasks found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <Link
              key={task.id}
              href={`/tasks/${task.id}`}
              className="block rounded-lg border border-gray-200 bg-white p-4 transition hover:border-gray-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium">{task.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                    {task.description}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                    {task.category && (
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-600">
                        {task.category.name}
                      </span>
                    )}
                    <span>by {task.poster.name}</span>
                    <span>{task.claimsCount} claim{task.claimsCount !== 1 ? "s" : ""}</span>
                    {task.deadline && (
                      <span>due {new Date(task.deadline).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="ml-4 shrink-0 text-right">
                  <span className="text-lg font-bold">{task.budgetCredits}</span>
                  <p className="text-xs text-gray-400">credits</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            {offset + 1}–{Math.min(offset + limit, total)} of {total}
          </span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= total}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
