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
  const [autoReview, setAutoReview] = useState(false);

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

    // Auto-review fields
    if (autoReview) {
      data.autoReviewEnabled = true;
      data.posterLlmProvider = (formData.get("posterLlmProvider") as string) || null;
      data.posterLlmKey = (formData.get("posterLlmKey") as string) || null;
      const maxReviews = formData.get("posterMaxReviews") as string;
      data.posterMaxReviews = maxReviews ? parseInt(maxReviews, 10) : null;
    }

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
    if (autoReview && !data.posterLlmProvider)
      newErrors.posterLlmProvider = "Select an LLM provider";
    if (autoReview && !data.posterLlmKey)
      newErrors.posterLlmKey = "API key is required for AI review";

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

  const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900";

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
          className={inputClass}
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
          className={inputClass}
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
            className={inputClass}
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
          <label className="mb-1 block text-sm font-medium">Deadline</label>
          <input
            name="deadline"
            type="datetime-local"
            className={inputClass}
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
            className={inputClass}
          />
          {errors.maxRevisions && (
            <p className="mt-1 text-xs text-red-600">{errors.maxRevisions}</p>
          )}
        </div>
      </div>

      {/* ─── AI Review Section ──────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 p-4">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={autoReview}
            onChange={(e) => setAutoReview(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <span className="text-sm font-medium">Enable AI Review</span>
        </label>
        <p className="mt-1 text-xs text-gray-500">
          Automatically evaluate submissions with an LLM. You provide the API key — you control the cost.
        </p>

        {autoReview && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">LLM Provider *</label>
              <select name="posterLlmProvider" className={inputClass}>
                <option value="">Select provider</option>
                <option value="openrouter">OpenRouter</option>
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
              </select>
              {errors.posterLlmProvider && (
                <p className="mt-1 text-xs text-red-600">{errors.posterLlmProvider}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">API Key *</label>
              <input
                name="posterLlmKey"
                type="password"
                className={inputClass}
                placeholder="sk-... or sk-or-v1-..."
              />
              <p className="mt-1 text-xs text-gray-500">
                Encrypted at rest. Never visible in API responses.
              </p>
              {errors.posterLlmKey && (
                <p className="mt-1 text-xs text-red-600">{errors.posterLlmKey}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Max Reviews</label>
              <input
                name="posterMaxReviews"
                type="number"
                min={1}
                className={inputClass}
                placeholder="Leave empty for unlimited"
              />
              <p className="mt-1 text-xs text-gray-500">
                Cap how many AI reviews you pay for. After this limit, the freelancer can continue with their own key.
              </p>
            </div>
          </div>
        )}
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
