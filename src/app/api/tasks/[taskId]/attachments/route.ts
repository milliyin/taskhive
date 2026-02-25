// Location: src/app/api/tasks/[taskId]/attachments/route.ts — POST upload + GET list task attachments
import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import db from "@/db/index";
import { users, tasks, taskAttachments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { uploadFile, isAllowedMimeType, TASK_ATTACHMENTS_BUCKET, MAX_ATTACHMENT_FILE_SIZE, MAX_ATTACHMENTS_PER_TASK } from "@/lib/storage";

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const dbUser = await db.select().from(users).where(eq(users.email, user.email!)).then((r) => r[0]);
  if (!dbUser) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  const { taskId: taskIdStr } = await params;
  const taskId = parseInt(taskIdStr, 10);
  if (isNaN(taskId)) return NextResponse.json({ ok: false, error: "Invalid task ID" }, { status: 400 });

  // Verify task exists and belongs to this user
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).then((r) => r[0]);
  if (!task) return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
  if (task.posterId !== dbUser.id) {
    return NextResponse.json({ ok: false, error: "You can only attach files to your own tasks" }, { status: 403 });
  }

  // Check existing attachment count
  const existing = await db.select().from(taskAttachments).where(eq(taskAttachments.taskId, taskId));
  const remainingSlots = MAX_ATTACHMENTS_PER_TASK - existing.length;
  if (remainingSlots <= 0) {
    return NextResponse.json({ ok: false, error: `Maximum ${MAX_ATTACHMENTS_PER_TASK} attachments per task reached` }, { status: 409 });
  }

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid form data. Use multipart/form-data with file fields named 'files'" }, { status: 400 });
  }

  const files = formData.getAll("files");
  if (files.length === 0) {
    return NextResponse.json({ ok: false, error: "No files provided. Include one or more files with field name 'files'" }, { status: 400 });
  }
  if (files.length > remainingSlots) {
    return NextResponse.json({ ok: false, error: `Can only upload ${remainingSlots} more file(s) (limit: ${MAX_ATTACHMENTS_PER_TASK})` }, { status: 400 });
  }

  const uploaded: Array<{ id: number; name: string; mime_type: string; size_bytes: number; public_url: string | null; created_at: Date }> = [];
  const errors: string[] = [];

  for (const file of files) {
    if (!(file instanceof File)) {
      errors.push("Non-file entry skipped");
      continue;
    }

    if (!isAllowedMimeType(file.type)) {
      errors.push(`${file.name}: unsupported file type (${file.type})`);
      continue;
    }

    if (file.size > MAX_ATTACHMENT_FILE_SIZE) {
      errors.push(`${file.name}: exceeds ${MAX_ATTACHMENT_FILE_SIZE / (1024 * 1024)}MB limit`);
      continue;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = `${taskId}/${Date.now()}-${file.name}`;

    try {
      const { publicUrl } = await uploadFile(TASK_ATTACHMENTS_BUCKET, storagePath, buffer, file.type);

      const [inserted] = await db.insert(taskAttachments).values({
        taskId,
        uploaderId: dbUser.id,
        storagePath,
        originalName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      }).returning();

      uploaded.push({
        id: inserted.id,
        name: inserted.originalName,
        mime_type: inserted.mimeType,
        size_bytes: inserted.sizeBytes,
        public_url: publicUrl,
        created_at: inserted.createdAt,
      });
    } catch {
      errors.push(`${file.name}: upload failed`);
    }
  }

  if (uploaded.length === 0) {
    return NextResponse.json({ ok: false, error: "No files uploaded", details: errors }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    data: uploaded,
    ...(errors.length > 0 ? { warnings: errors } : {}),
  }, { status: 201 });
}

export async function GET(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const dbUser = await db.select().from(users).where(eq(users.email, user.email!)).then((r) => r[0]);
  if (!dbUser) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  const { taskId: taskIdStr } = await params;
  const taskId = parseInt(taskIdStr, 10);
  if (isNaN(taskId)) return NextResponse.json({ ok: false, error: "Invalid task ID" }, { status: 400 });

  // Verify task exists
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).then((r) => r[0]);
  if (!task) return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });

  const attachments = await db
    .select()
    .from(taskAttachments)
    .where(eq(taskAttachments.taskId, taskId))
    .orderBy(taskAttachments.createdAt);

  const data = attachments.map((a) => ({
    id: a.id,
    task_id: a.taskId,
    uploader_id: a.uploaderId,
    name: a.originalName,
    mime_type: a.mimeType,
    size_bytes: a.sizeBytes,
    public_url: null as string | null,
    storage_path: a.storagePath,
    created_at: a.createdAt,
  }));

  return NextResponse.json({ ok: true, data });
}
