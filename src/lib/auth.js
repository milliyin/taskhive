import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import db from "@/db/index";
import { users, creditTransactions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PLATFORM } from "@/lib/constants";

/**
 * Get the currently authenticated user and their DB profile.
 * Creates the DB user with welcome bonus if first login.
 * Redirects to /auth/login if not authenticated.
 */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Get existing DB user
  let dbUser = await db
    .select()
    .from(users)
    .where(eq(users.email, user.email))
    .then((r) => r[0] || null);

  // First login — create user with welcome bonus
  if (!dbUser) {
    try {
      const result = await db
        .insert(users)
        .values({
          email: user.email,
          name: user.user_metadata?.name || user.email.split("@")[0],
          avatarUrl: user.user_metadata?.avatar_url || null,
          creditBalance: PLATFORM.NEW_USER_BONUS,
        })
        .onConflictDoNothing({ target: users.email })
        .returning();

      if (result.length > 0) {
        dbUser = result[0];

        // Record welcome bonus in ledger
        await db.insert(creditTransactions).values({
          userId: dbUser.id,
          amount: PLATFORM.NEW_USER_BONUS,
          type: "bonus",
          description: "Welcome bonus",
          balanceAfter: PLATFORM.NEW_USER_BONUS,
        });
      } else {
        // Race condition: user was created between SELECT and INSERT
        dbUser = await db
          .select()
          .from(users)
          .where(eq(users.email, user.email))
          .then((r) => r[0]);
      }
    } catch {
      // Fallback: re-fetch if insert fails for any reason
      dbUser = await db
        .select()
        .from(users)
        .where(eq(users.email, user.email))
        .then((r) => r[0]);
    }
  }

  return { authUser: user, dbUser };
}

/**
 * Get the currently authenticated user without redirecting.
 * Returns null if not authenticated.
 */
export async function getUserOptional() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const dbUser = await db
    .select()
    .from(users)
    .where(eq(users.email, user.email))
    .then((r) => r[0] || null);

  return dbUser ? { authUser: user, dbUser } : null;
}