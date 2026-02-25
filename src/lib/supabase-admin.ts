// Server-side Supabase client with service role key for storage operations.
// This client bypasses RLS — use only in API routes, never expose to client.
import { createClient } from "@supabase/supabase-js";

let adminClient: ReturnType<typeof createClient> | null = null;

export function getAdminClient() {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  adminClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return adminClient;
}
