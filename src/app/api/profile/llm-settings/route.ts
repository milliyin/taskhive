// Location: src/app/api/profile/llm-settings/route.ts — Save/remove poster LLM key on user profile
import { createClient } from "@/lib/supabase-server";
import db from "@/db/index";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { encrypt } from "@/lib/encryption";

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };

  const dbUser = await db.select().from(users).where(eq(users.email, user.email!)).then((r) => r[0]);
  if (!dbUser) return { error: NextResponse.json({ ok: false, error: "User not found" }, { status: 404 }) };

  return { dbUser };
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const provider = body.llmProvider;
  const key = body.llmKey;

  if (!provider || !["openrouter", "anthropic", "openai"].includes(provider)) {
    return NextResponse.json({ ok: false, error: "Invalid provider. Use: openrouter, anthropic, or openai" }, { status: 400 });
  }
  if (!key || typeof key !== "string" || key.length < 1) {
    return NextResponse.json({ ok: false, error: "API key is required" }, { status: 400 });
  }

  await db.update(users).set({
    llmProvider: provider,
    llmKeyEncrypted: encrypt(key),
    updatedAt: new Date(),
  }).where(eq(users.id, auth.dbUser.id));

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const auth = await getAuthenticatedUser();
  if ("error" in auth) return auth.error;

  await db.update(users).set({
    llmProvider: null,
    llmKeyEncrypted: null,
    updatedAt: new Date(),
  }).where(eq(users.id, auth.dbUser.id));

  return NextResponse.json({ ok: true });
}
