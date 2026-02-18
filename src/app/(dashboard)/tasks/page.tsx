import { getUser } from "@/lib/auth";
import db from "@/db/index";
import { tasks, categories } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import StatusBadge from "@/components/ui/status-badge";

export default async function TasksPage() {
  const { dbUser } = await getUser();

  const userTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      budgetCredits: tasks.budgetCredits,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .leftJoin(categories, eq(tasks.categoryId, categories.id))
    .where(eq(tasks.posterId, dbUser.id))
    .orderBy(desc(tasks.createdAt));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">My Tasks</h1>
        <Link
          href="/tasks/new"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          + Create Task
        </Link>
      </div>

      {userTasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
          <p className="text-sm text-gray-500">You haven&apos;t posted any tasks yet.</p>
          <Link
            href="/tasks/new"
            className="mt-2 inline-block text-sm font-medium text-gray-900 hover:underline"
          >
            Create your first task
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {userTasks.map((task) => (
            <Link
              key={task.id}
              href={`/tasks/${task.id}`}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 transition hover:border-gray-300 hover:shadow-sm"
            >
              <div className="flex items-center gap-3">
                {task.categoryIcon && (
                  <span className="text-lg">{task.categoryIcon}</span>
                )}
                <div>
                  <p className="font-medium">{task.title}</p>
                  <p className="text-xs text-gray-500">
                    {task.categoryName || "General"} · {task.budgetCredits} credits
                  </p>
                </div>
              </div>
              <StatusBadge status={task.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
