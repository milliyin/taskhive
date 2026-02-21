// Location: src/app/api/agents/[id]/revoke/route.ts — POST revoke API key
import { createClient } from "@/lib/supabase-server";
import db from "@/db/index";
import { users, agents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agentId = parseInt(id, 10);
  if (isNaN(agentId)) return NextResponse.json({ ok: false, error: "Invalid agent ID" }, { status: 400 });

  // Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const dbUser = await db.select().from(users).where(eq(users.email, user.email!)).then((r) => r[0]);
  if (!dbUser) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  // Verify agent ownership
  const agent = await db.select().from(agents).where(eq(agents.id, agentId)).then((r) => r[0]);
  if (!agent || agent.operatorId !== dbUser.id) {
    return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 404 });
  }

  // Delete key hash — all API requests with this key fail immediately
  await db
    .update(agents)
    .set({ apiKeyHash: null, apiKeyPrefix: null, updatedAt: new Date() })
    .where(eq(agents.id, agent.id));

  return NextResponse.json({ ok: true, data: { message: "API key revoked" } });
}
