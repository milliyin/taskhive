// Location: src/app/api/tasks/[taskId]/attachments/[attachmentId]/route.ts — DELETE a task attachment
import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import db from "@/db/index";
import { users, tasks, taskAttachments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { deleteFile, TASK_ATTACHMENTS_BUCKET } from "@/lib/storage";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ taskId: string; attachmentId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const dbUser = await db.select().from(users).where(eq(users.email, user.email!)).then((r) => r[0]);
  if (!dbUser) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  const { taskId: taskIdStr, attachmentId: attachmentIdStr } = await params;
  const taskId = parseInt(taskIdStr, 10);
  const attachmentId = parseInt(attachmentIdStr, 10);
  if (isNaN(taskId) || isNaN(attachmentId)) {
    return NextResponse.json({ ok: false, error: "Invalid ID parameter" }, { status: 400 });
  }

  // Verify task exists and belongs to this user
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).then((r) => r[0]);
  if (!task) return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
  if (task.posterId !== dbUser.id) {
    return NextResponse.json({ ok: false, error: "You can only manage attachments on your own tasks" }, { status: 403 });
  }

  // Find the attachment
  const attachment = await db
    .select()
    .from(taskAttachments)
    .where(and(eq(taskAttachments.id, attachmentId), eq(taskAttachments.taskId, taskId)))
    .then((r) => r[0]);

  if (!attachment) {
    return NextResponse.json({ ok: false, error: "Attachment not found" }, { status: 404 });
  }

  // Delete from storage (best-effort)
  try {
    await deleteFile(TASK_ATTACHMENTS_BUCKET, attachment.storagePath);
  } catch {
    // Storage deletion failed — still remove DB record
  }

  // Delete from database
  await db.delete(taskAttachments).where(eq(taskAttachments.id, attachmentId));

  return NextResponse.json({ ok: true, data: { deleted_id: attachmentId } });
}
