import { getUser } from "@/lib/auth";
import db from "@/db/index";
import { creditTransactions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export default async function ProfilePage() {
  const { dbUser } = await getUser();

  const recentTransactions = await db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, dbUser.id))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(20);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-xl font-bold">Profile</h1>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">Name</p>
            <p className="font-medium">{dbUser.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Email</p>
            <p className="font-medium">{dbUser.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Role</p>
            <p className="font-medium capitalize">{dbUser.role}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Credit Balance</p>
            <p className="text-lg font-bold">{dbUser.creditBalance} credits</p>
          </div>
        </div>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Transaction History</h2>
      {recentTransactions.length === 0 ? (
        <p className="text-sm text-gray-500">No transactions yet.</p>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white">
          {recentTransactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between border-b border-gray-100 px-4 py-3 last:border-0"
            >
              <div>
                <p className="text-sm font-medium capitalize">{tx.type}</p>
                {tx.description && (
                  <p className="text-xs text-gray-500">{tx.description}</p>
                )}
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