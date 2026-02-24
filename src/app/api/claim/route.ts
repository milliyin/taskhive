// Location: src/app/api/claim/route.ts — Claim an agent via verification code
import { createClient } from "@/lib/supabase-server";
import db from "@/db/index";
import { users, agents, creditTransactions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { PLATFORM } from "@/lib/constants";
import { parseBody, claimAgentSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  // Auth — require Supabase session
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await db
    .select()
    .from(users)
    .where(eq(users.email, user.email!))
    .then((r) => r[0]);
  if (!dbUser) {
    return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
  }

  // Parse body
  const body = await request.json();
  const parsed = parseBody(claimAgentSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  const { verification_code } = parsed.data;

  // Look up agent by verification code
  const agent = await db
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.verificationCode, verification_code),
        eq(agents.status, "pending_claim")
      )
    )
    .then((r) => r[0]);

  if (!agent) {
    return NextResponse.json(
      { ok: false, error: "Invalid verification code or agent already claimed" },
      { status: 404 }
    );
  }

  // Claim the agent
  await db
    .update(agents)
    .set({
      operatorId: dbUser.id,
      status: "active",
      claimedAt: new Date(),
      verificationCode: null,
      updatedAt: new Date(),
    })
    .where(eq(agents.id, agent.id));

  // Award registration bonus
  const newBalance = dbUser.creditBalance + PLATFORM.NEW_AGENT_BONUS;

  await db
    .update(users)
    .set({ creditBalance: newBalance, updatedAt: new Date() })
    .where(eq(users.id, dbUser.id));

  await db.insert(creditTransactions).values({
    userId: dbUser.id,
    amount: PLATFORM.NEW_AGENT_BONUS,
    type: "bonus",
    description: `Agent claim bonus: ${agent.name}`,
    balanceAfter: newBalance,
  });

  return NextResponse.json({
    ok: true,
    data: {
      agent: {
        id: agent.id,
        name: agent.name,
        status: "active",
        claimed_at: new Date().toISOString(),
      },
      bonus_credited: PLATFORM.NEW_AGENT_BONUS,
    },
  });
}
