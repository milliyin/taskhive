"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

interface Category {
  id: number;
  name: string;
  icon: string | null;
}

interface CreateTaskFormProps {
  categories: Category[];
}

export default function CreateTaskForm({ categories }: CreateTaskFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      budgetCredits: parseInt(formData.get("budgetCredits") as string, 10),
      categoryId: (formData.get("categoryId") as string) || null,
      deadline: (formData.get("deadline") as string) || null,
      maxRevisions: parseInt(formData.get("maxRevisions") as string, 10) || 2,
    };

    // Client-side validation
    const newErrors: Record<string, string> = {};
    if (!data.title || (data.title as string).length < 5 || (data.title as string).length > 200)
      newErrors.title = "Title must be 5–200 characters";
    if (!data.description || (data.description as string).length < 20 || (data.description as string).length > 5000)
      newErrors.description = "Description must be 20–5000 characters";
    if (!data.budgetCredits || (data.budgetCredits as number) < 10)
      newErrors.budgetCredits = "Budget must be at least 10 credits";
    if (data.deadline && new Date(data.deadline as string) <= new Date())
      newErrors.deadline = "Deadline must be in the future";
    if ((data.maxRevisions as number) < 0 || (data.maxRevisions as number) > 5)
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

    const { data: task } = await res.json();
    router.push(`/tasks/${task.id}`);
    router.refresh();
  }

  const inputClass = "h-14 w-full rounded-t-xl border-b-2 border-md-border bg-md-surface-variant px-4 text-sm text-md-fg outline-none transition-colors duration-200 placeholder:text-md-on-surface-variant/50 focus:border-md-primary";

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-5">
      {errors.form && (
        <div className="rounded-2xl bg-md-error-container px-4 py-3 text-sm text-md-error">
          {errors.form}
        </div>
      )}

      {/* Title */}
      <div>
        <label className="mb-1 block text-sm font-medium text-md-on-surface-variant">Title *</label>
        <input
          name="title"
          required
          minLength={5}
          maxLength={200}
          className={inputClass}
          placeholder="e.g. Write a Python web scraper for product prices"
        />
        {errors.title && (
          <p className="mt-1 text-xs text-md-error">{errors.title}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="mb-1 block text-sm font-medium text-md-on-surface-variant">Description *</label>
        <textarea
          name="description"
          required
          minLength={20}
          maxLength={5000}
          rows={5}
          className="w-full rounded-t-xl border-b-2 border-md-border bg-md-surface-variant px-4 py-3 text-sm text-md-fg outline-none transition-colors duration-200 placeholder:text-md-on-surface-variant/50 focus:border-md-primary"
          placeholder="Describe exactly what you need done, including requirements and expected output..."
        />
        {errors.description && (
          <p className="mt-1 text-xs text-md-error">{errors.description}</p>
        )}
      </div>

      {/* Budget + Category row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-md-on-surface-variant">
            Budget (credits) *
          </label>
          <input
            name="budgetCredits"
            type="number"
            required
            min={10}
            className={inputClass}
            placeholder="Min 10"
          />
          {errors.budgetCredits && (
            <p className="mt-1 text-xs text-md-error">{errors.budgetCredits}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-md-on-surface-variant">Category</label>
          <select
            name="categoryId"
            className={inputClass}
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
          <label className="mb-1 block text-sm font-medium text-md-on-surface-variant">Deadline</label>
          <input
            name="deadline"
            type="datetime-local"
            className={inputClass}
          />
          {errors.deadline && (
            <p className="mt-1 text-xs text-md-error">{errors.deadline}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-md-on-surface-variant">
            Max Revisions
          </label>
          <input
            name="maxRevisions"
            type="number"
            min={0}
            max={5}
            defaultValue={2}
            className={inputClass}
          />
          {errors.maxRevisions && (
            <p className="mt-1 text-xs text-md-error">{errors.maxRevisions}</p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-md-primary py-3 text-sm font-medium text-md-on-primary shadow-sm transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-md-primary/90 hover:shadow-md active:scale-95 disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create Task"}
      </button>
    </form>
  );
}
