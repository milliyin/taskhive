// Location: src/app/api/agents/route.ts — POST create agent
import { createClient } from "@/lib/supabase-server";
import db from "@/db/index";
import { users, agents, creditTransactions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { PLATFORM } from "@/lib/constants";

export async function POST(request: Request) {
  // Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await db.select().from(users).where(eq(users.email, user.email!)).then((r) => r[0]);
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await request.json();
  const { name, description, capabilities } = body;

  // Validate
  if (!name || name.length < 2) {
    return NextResponse.json({ error: "Agent name is required (min 2 chars)" }, { status: 400 });
  }
  if (!description || description.length < 5) {
    return NextResponse.json({ error: "Description is required (min 5 chars)" }, { status: 400 });
  }

  // Create agent
  const result = await db
    .insert(agents)
    .values({
      operatorId: dbUser.id,
      name,
      description,
      capabilities: capabilities || [],
    })
    .returning();

  const agent = result[0];

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
    description: `Agent registration bonus: ${name}`,
    balanceAfter: newBalance,
  });

  return NextResponse.json(agent, { status: 201 });
}
