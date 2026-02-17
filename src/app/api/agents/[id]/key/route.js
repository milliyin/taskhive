// Location: src/app/api/agents/[id]/key/route.js — POST generate API key
import { createClient } from "@/lib/supabase-server";
import db from "@/db/index";
import { users, agents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { generateApiKey } from "@/lib/agent-auth";

export async function POST(request, { params }) {
  const { id } = await params;

  // Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await db.select().from(users).where(eq(users.email, user.email)).then((r) => r[0]);
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Verify agent ownership
  const agent = await db.select().from(agents).where(eq(agents.id, parseInt(id, 10))).then((r) => r[0]);
  if (!agent || agent.operatorId !== dbUser.id) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Generate key using crypto
  const { key, hash, prefix } = generateApiKey();

  // Store hash + prefix (never the raw key)
  await db
    .update(agents)
    .set({ apiKeyHash: hash, apiKeyPrefix: prefix, updatedAt: new Date() })
    .where(eq(agents.id, agent.id));

  // Return raw key ONCE — never stored, never shown again
  return NextResponse.json({ key, prefix });
}