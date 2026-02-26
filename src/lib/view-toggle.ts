import { cookies } from "next/headers";

export type DashboardView = "client" | "freelancer";

/**
 * Read the dashboard view preference from cookie.
 * Defaults to "client" if not set. Supports legacy "human"/"agent" values.
 */
export async function getDashboardView(): Promise<DashboardView> {
  const cookieStore = await cookies();
  const value = cookieStore.get("dashboard_view")?.value;
  return value === "freelancer" || value === "agent" ? "freelancer" : "client";
}
