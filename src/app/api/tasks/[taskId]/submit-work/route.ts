// Dashboard API: POST /api/tasks/[taskId]/submit-work — human operator submits deliverable
import { getUser } from "@/lib/auth";
import db from "@/db/index";
import { tasks, agents, deliverables, deliverableFiles } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { uploadFile, classifyFileType, isAllowedMimeType, DELIVERABLES_BUCKET, MAX_DELIVERABLE_FILE_SIZE } from "@/lib/storage";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { dbUser } = await getUser();
  const { taskId: tid } = await params;
  const taskId = parseInt(tid, 10);
  if (isNaN(taskId)) return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });

  // Get task
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).then((r) => r[0]);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  // Verify user is the operator of the assigned agent
  if (!task.claimedByAgentId) {
    return NextResponse.json({ error: "Task has no assigned agent" }, { status: 400 });
  }

  const agent = await db.select().from(agents).where(eq(agents.id, task.claimedByAgentId)).then((r) => r[0]);
  if (!agent || agent.operatorId !== dbUser.id) {
    return NextResponse.json({ error: "You are not the operator of the assigned agent" }, { status: 403 });
  }

  // Check task status
  if (!["claimed", "in_progress"].includes(task.status)) {
    return NextResponse.json({ error: `Cannot submit work when task status is '${task.status}'` }, { status: 409 });
  }

  // Check no pending deliverable
  const pending = await db
    .select()
    .from(deliverables)
    .where(and(eq(deliverables.taskId, taskId), eq(deliverables.status, "submitted")));
  if (pending.length > 0) {
    return NextResponse.json({ error: "A deliverable is already submitted and awaiting review" }, { status: 409 });
  }

  // Check revision count
  const existingCount = await db
    .select({ count: sql<number>`COUNT(*)::integer` })
    .from(deliverables)
    .where(eq(deliverables.taskId, taskId));
  const revisionNumber = (existingCount[0]?.count || 0) + 1;
  if (revisionNumber > task.maxRevisions + 1) {
    return NextResponse.json({ error: "Maximum revisions reached" }, { status: 409 });
  }

  // Parse form data
  const formData = await request.formData();
  const content = (formData.get("content") as string || "").trim();
  const files = formData.getAll("files") as File[];

  if (!content && files.length === 0) {
    return NextResponse.json({ error: "Provide content or files" }, { status: 400 });
  }

  // Create deliverable (attributed to the agent)
  const [d] = await db
    .insert(deliverables)
    .values({
      taskId,
      agentId: agent.id,
      content: content || "",
      revisionNumber,
    })
    .returning();

  // Upload files
  const uploadedFiles: Array<{ id: number; name: string; file_type: string; size_bytes: number; public_url: string | null }> = [];
  for (const file of files) {
    if (!isAllowedMimeType(file.type)) continue;
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_DELIVERABLE_FILE_SIZE) continue;

    const storagePath = `${taskId}/${d.id}/${Date.now()}-${file.name}`;
    try {
      const { publicUrl } = await uploadFile(DELIVERABLES_BUCKET, storagePath, buffer, file.type);
      const fileType = classifyFileType(file.type, file.name);

      const [inserted] = await db.insert(deliverableFiles).values({
        deliverableId: d.id,
        taskId,
        agentId: agent.id,
        storagePath,
        originalName: file.name,
        mimeType: file.type,
        sizeBytes: buffer.length,
        fileType,
        publicUrl,
      }).returning();

      uploadedFiles.push({
        id: inserted.id,
        name: inserted.originalName,
        file_type: inserted.fileType,
        size_bytes: inserted.sizeBytes,
        public_url: inserted.publicUrl,
      });
    } catch {
      // skip failed uploads
    }
  }

  // Update task status
  await db.update(tasks).set({ status: "delivered", updatedAt: new Date() }).where(eq(tasks.id, taskId));

  return NextResponse.json({
    ok: true,
    deliverable: {
      id: d.id,
      revisionNumber: d.revisionNumber,
      content: d.content,
      files: uploadedFiles,
    },
  }, { status: 201 });
}
