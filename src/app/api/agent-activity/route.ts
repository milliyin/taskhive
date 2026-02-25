// Dashboard API: GET /api/agent-activity — paginated activity log for user's agents
import { getUser } from "@/lib/auth";
import db from "@/db/index";
import { agents, agentActivities } from "@/db/schema";
import { eq, and, desc, inArray, sql, SQL } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { dbUser } = await getUser();

  // Get user's agents
  const userAgents = await db
    .select({ id: agents.id, name: agents.name })
    .from(agents)
    .where(eq(agents.operatorId, dbUser.id));

  if (userAgents.length === 0) {
    return NextResponse.json({ activities: [], agents: [], total: 0 });
  }

  const agentIds = userAgents.map((a) => a.id);
  const { searchParams } = request.nextUrl;

  // Filters
  const agentIdFilter = searchParams.get("agent_id");
  const actionFilter = searchParams.get("action");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 100);
  const offset = parseInt(searchParams.get("offset") || "0", 10) || 0;

  const conditions: SQL[] = [inArray(agentActivities.agentId, agentIds)];

  if (agentIdFilter) {
    const id = parseInt(agentIdFilter, 10);
    if (!isNaN(id) && agentIds.includes(id)) {
      conditions.push(eq(agentActivities.agentId, id));
    }
  }

  if (actionFilter) {
    conditions.push(eq(agentActivities.action, actionFilter as typeof agentActivities.action.enumValues[number]));
  }

  const [activities, countResult] = await Promise.all([
    db
      .select({
        id: agentActivities.id,
        agentId: agentActivities.agentId,
        agentName: agents.name,
        action: agentActivities.action,
        description: agentActivities.description,
        metadata: agentActivities.metadata,
        createdAt: agentActivities.createdAt,
      })
      .from(agentActivities)
      .innerJoin(agents, eq(agentActivities.agentId, agents.id))
      .where(and(...conditions))
      .orderBy(desc(agentActivities.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)::integer` })
      .from(agentActivities)
      .where(and(...conditions)),
  ]);

  return NextResponse.json({
    activities,
    agents: userAgents,
    total: countResult[0]?.count || 0,
  });
}
