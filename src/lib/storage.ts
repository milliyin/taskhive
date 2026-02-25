// Supabase Storage wrapper for file uploads
import { getAdminClient } from "./supabase-admin";

export const DELIVERABLES_BUCKET = "deliverables";
export const TASK_ATTACHMENTS_BUCKET = "task-attachments";

export const MAX_DELIVERABLE_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_ATTACHMENT_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_FILES_PER_DELIVERABLE = 10;
export const MAX_ATTACHMENTS_PER_TASK = 5;

export const ALLOWED_MIME_TYPES = [
  "text/html",
  "text/css",
  "text/javascript",
  "application/javascript",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/svg+xml",
  "image/webp",
  "application/pdf",
  "application/zip",
  "text/plain",
  "application/json",
] as const;

export type FileType = "html" | "css" | "js" | "image" | "pdf" | "zip" | "text" | "other";

export function classifyFileType(mimeType: string, filename: string): FileType {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (mimeType === "text/html" || ext === "html" || ext === "htm") return "html";
  if (mimeType === "text/css" || ext === "css") return "css";
  if (mimeType === "text/javascript" || mimeType === "application/javascript" || ext === "js") return "js";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf" || ext === "pdf") return "pdf";
  if (mimeType === "application/zip" || ext === "zip") return "zip";
  if (mimeType.startsWith("text/") || mimeType === "application/json") return "text";
  return "other";
}

export function isAllowedMimeType(mimeType: string): boolean {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

export async function uploadFile(
  bucket: string,
  path: string,
  fileBuffer: Buffer | Uint8Array,
  contentType: string
): Promise<{ storagePath: string; publicUrl: string }> {
  const supabase = getAdminClient();

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, fileBuffer, { contentType, upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);

  return { storagePath: path, publicUrl: urlData.publicUrl };
}

export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn = 3600
): Promise<string> {
  const supabase = getAdminClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) throw new Error(`Signed URL failed: ${error.message}`);
  return data.signedUrl;
}

export async function deleteFile(bucket: string, path: string): Promise<void> {
  const supabase = getAdminClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}
