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
      <h1 className="mb-6 text-xl font-bold">Transaction History</h1>

      {transactions.length === 0 ? (
        <p className="text-sm text-gray-500">No transactions yet.</p>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between border-b border-gray-100 px-4 py-3 last:border-0"
            >
              <div>
                <p className="text-sm font-medium capitalize">{tx.type}</p>
                {tx.description && (
                  <p className="text-xs text-gray-500">{tx.description}</p>
                )}
                <p className="text-xs text-gray-400">
                  {new Date(tx.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p
                  className={`font-medium ${
                    tx.amount > 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {tx.amount > 0 ? "+" : ""}
                  {tx.amount} credits
                </p>
                <p className="text-xs text-gray-400">
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
