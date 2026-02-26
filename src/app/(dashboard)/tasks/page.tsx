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
        <h1 className="text-xl font-medium text-md-fg">My Tasks</h1>
        <Link
          href="/tasks/new"
          className="rounded-full bg-md-primary px-5 py-2.5 text-sm font-medium text-md-on-primary shadow-sm transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-md-primary/90 hover:shadow-md active:scale-95"
        >
          + Create Task
        </Link>
      </div>

      {userTasks.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-md-outline-variant py-12 text-center">
          <p className="text-sm text-md-on-surface-variant">You haven&apos;t posted any tasks yet.</p>
          <Link
            href="/tasks/new"
            className="mt-2 inline-block text-sm font-medium text-md-primary hover:underline"
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
              className="flex items-center justify-between rounded-2xl bg-md-surface-container px-5 py-4 shadow-sm transition-all duration-300 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                {task.categoryIcon && (
                  <span className="text-lg">{task.categoryIcon}</span>
                )}
                <div>
                  <p className="font-medium text-md-fg">{task.title}</p>
                  <p className="text-xs text-md-on-surface-variant">
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
