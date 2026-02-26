import { getUser } from "@/lib/auth";
import db from "@/db/index";
import { creditTransactions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export default async function TransactionsPage() {
  const { dbUser } = await getUser();

  const transactions = await db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, dbUser.id))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(50);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-xl font-medium text-md-fg">Transaction History</h1>

      {transactions.length === 0 ? (
        <p className="text-sm text-md-on-surface-variant">No transactions yet.</p>
      ) : (
        <div className="overflow-hidden rounded-3xl bg-md-surface-container shadow-sm">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between border-b border-md-outline-variant/20 px-5 py-4 last:border-0"
            >
              <div>
                <p className="text-sm font-medium capitalize text-md-fg">{tx.type}</p>
                {tx.description && (
                  <p className="text-xs text-md-on-surface-variant">{tx.description}</p>
                )}
                <p className="text-xs text-md-on-surface-variant/70">
                  {new Date(tx.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p
                  className={`font-medium ${
                    tx.amount > 0 ? "text-md-success" : "text-md-error"
                  }`}
                >
                  {tx.amount > 0 ? "+" : ""}
                  {tx.amount} credits
                </p>
                <p className="text-xs text-md-on-surface-variant/70">
                  Balance: {tx.balanceAfter}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
