"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateTaskForm({ categories }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    const formData = new FormData(e.target);
    const data = {
      title: formData.get("title"),
      description: formData.get("description"),
      budgetCredits: parseInt(formData.get("budgetCredits"), 10),
      categoryId: formData.get("categoryId") || null,
      deadline: formData.get("deadline") || null,
      maxRevisions: parseInt(formData.get("maxRevisions"), 10) || 2,
    };

    // Client-side validation
    const newErrors = {};
    if (!data.title || data.title.length < 5 || data.title.length > 200)
      newErrors.title = "Title must be 5–200 characters";
    if (!data.description || data.description.length < 20 || data.description.length > 5000)
      newErrors.description = "Description must be 20–5000 characters";
    if (!data.budgetCredits || data.budgetCredits < 10)
      newErrors.budgetCredits = "Budget must be at least 10 credits";
    if (data.deadline && new Date(data.deadline) <= new Date())
      newErrors.deadline = "Deadline must be in the future";
    if (data.maxRevisions < 0 || data.maxRevisions > 5)
      newErrors.maxRevisions = "Max revisions must be 0–5";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setLoading(false);
      return;
    }

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json();
      setErrors({ form: body.error || "Failed to create task" });
      setLoading(false);
      return;
    }

    const task = await res.json();
    router.push(`/tasks/${task.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-5">
      {errors.form && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {errors.form}
        </div>
      )}

      {/* Title */}
      <div>
        <label className="mb-1 block text-sm font-medium">Title *</label>
        <input
          name="title"
          required
          minLength={5}
          maxLength={200}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
          placeholder="e.g. Write a Python web scraper for product prices"
        />
        {errors.title && (
          <p className="mt-1 text-xs text-red-600">{errors.title}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="mb-1 block text-sm font-medium">Description *</label>
        <textarea
          name="description"
          required
          minLength={20}
          maxLength={5000}
          rows={5}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
          placeholder="Describe exactly what you need done, including requirements and expected output..."
        />
        {errors.description && (
          <p className="mt-1 text-xs text-red-600">{errors.description}</p>
        )}
      </div>

      {/* Budget + Category row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">
            Budget (credits) *
          </label>
          <input
            name="budgetCredits"
            type="number"
            required
            min={10}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            placeholder="Min 10"
          />
          {errors.budgetCredits && (
            <p className="mt-1 text-xs text-red-600">{errors.budgetCredits}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Category</label>
          <select
            name="categoryId"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
          >
            <option value="">Select category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Deadline + Max Revisions row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Deadline</label>
          <input
            name="deadline"
            type="datetime-local"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
          />
          {errors.deadline && (
            <p className="mt-1 text-xs text-red-600">{errors.deadline}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Max Revisions
          </label>
          <input
            name="maxRevisions"
            type="number"
            min={0}
            max={5}
            defaultValue={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
          />
          {errors.maxRevisions && (
            <p className="mt-1 text-xs text-red-600">{errors.maxRevisions}</p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create Task"}
      </button>
    </form>
  );
}