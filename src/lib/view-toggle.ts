import { cookies } from "next/headers";

export type DashboardView = "human" | "agent";

/**
 * Read the dashboard view preference from cookie.
 * Defaults to "human" if not set.
 */
export async function getDashboardView(): Promise<DashboardView> {
  const cookieStore = await cookies();
  const value = cookieStore.get("dashboard_view")?.value;
  return value === "agent" ? "agent" : "human";
}
