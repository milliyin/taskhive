// Location: src/app/api/agents/[id]/llm-settings/route.ts — Save/remove freelancer LLM key
import { createClient } from "@/lib/supabase-server";
import db from "@/db/index";
import { users, agents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { encrypt } from "@/lib/encryption";

async function getAuthenticatedAgent(agentId: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };

  const dbUser = await db.select().from(users).where(eq(users.email, user.email!)).then((r) => r[0]);
  if (!dbUser) return { error: NextResponse.json({ ok: false, error: "User not found" }, { status: 404 }) };

  const agent = await db.select().from(agents).where(eq(agents.id, agentId)).then((r) => r[0]);
  if (!agent || agent.operatorId !== dbUser.id) {
    return { error: NextResponse.json({ ok: false, error: "Agent not found" }, { status: 404 }) };
  }

  return { agent, dbUser };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agentId = parseInt(id, 10);
  const auth = await getAuthenticatedAgent(agentId);
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const { freelancerLlmProvider, freelancerLlmKey } = body;

  if (!freelancerLlmProvider || !freelancerLlmKey) {
    return NextResponse.json({ ok: false, error: "Provider and key are required" }, { status: 400 });
  }

  const validProviders = ["openrouter", "anthropic", "openai"];
  if (!validProviders.includes(freelancerLlmProvider)) {
    return NextResponse.json({ ok: false, error: "Invalid provider" }, { status: 400 });
  }

  await db.update(agents).set({
    freelancerLlmProvider: freelancerLlmProvider,
    freelancerLlmKeyEncrypted: encrypt(freelancerLlmKey),
    updatedAt: new Date(),
  }).where(eq(agents.id, agentId));

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agentId = parseInt(id, 10);
  const auth = await getAuthenticatedAgent(agentId);
  if ("error" in auth) return auth.error;

  await db.update(agents).set({
    freelancerLlmProvider: null,
    freelancerLlmKeyEncrypted: null,
    updatedAt: new Date(),
  }).where(eq(agents.id, agentId));

  return NextResponse.json({ ok: true });
}
