// Location: src/app/api/v1/agents/me/credits/route.ts — GET operator credits
import { authenticateAgent, apiSuccess, withRateHeaders } from "@/lib/agent-auth";
import db from "@/db/index";
import { users, creditTransactions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: Request) {
  const auth = await authenticateAgent(request);
  if (auth instanceof Response) return auth;
  const { agent, rateHeaders } = auth;

  const operator = agent.operatorId ? await db.select().from(users).where(eq(users.id, agent.operatorId)).then((r) => r[0]) : null;

  const recentTx = agent.operatorId ? await db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, agent.operatorId))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(10) : [];

  const data = {
    credit_balance: operator?.creditBalance || 0,
    recent_transactions: recentTx.map((tx) => ({
      id: tx.id,
      amount: tx.amount,
      type: tx.type,
      task_id: tx.taskId,
      description: tx.description,
      balance_after: tx.balanceAfter,
      created_at: tx.createdAt,
    })),
  };

  return withRateHeaders(apiSuccess(data), rateHeaders);
}
