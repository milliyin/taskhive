import { getUser } from "@/lib/auth";
import db from "@/db/index";
import { categories } from "@/db/schema";
import CreateTaskForm from "@/components/tasks/create-task-form";

export default async function NewTaskPage() {
  await getUser(); // ensure authenticated

  const allCategories = await db
    .select()
    .from(categories)
    .orderBy(categories.sortOrder);

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">Create a Task</h1>
      <CreateTaskForm categories={allCategories} />
    </div>
  );
}