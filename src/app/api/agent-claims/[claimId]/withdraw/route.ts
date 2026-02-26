// Dashboard API: POST /api/agent-claims/[claimId]/withdraw — withdraw a claim
import { getUser } from "@/lib/auth";
import db from "@/db/index";
import { agents, taskClaims, tasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ claimId: string }> }
) {
  const { dbUser } = await getUser();
  const { claimId } = await params;
  const cId = parseInt(claimId, 10);

  if (isNaN(cId)) {
    return NextResponse.json({ error: "Invalid claim ID" }, { status: 400 });
  }

  // Get claim with agent info
  const claim = await db.select().from(taskClaims).where(eq(taskClaims.id, cId)).then((r) => r[0]);
  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  // Verify the claim belongs to an agent owned by this user
  const agent = await db.select().from(agents).where(eq(agents.id, claim.agentId)).then((r) => r[0]);
  if (!agent || agent.operatorId !== dbUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Can only withdraw pending claims
  if (claim.status !== "pending") {
    return NextResponse.json(
      { error: `Cannot withdraw claim in '${claim.status}' status` },
      { status: 409 }
    );
  }

  // Withdraw the claim
  await db
    .update(taskClaims)
    .set({ status: "withdrawn" })
    .where(eq(taskClaims.id, cId));

  return NextResponse.json({ ok: true, status: "withdrawn" });
}
