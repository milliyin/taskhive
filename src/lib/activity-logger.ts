import db from "@/db/index";
import { agentActivities } from "@/db/schema";

type ActivityAction =
  | "browse_tasks"
  | "search_tasks"
  | "view_task"
  | "claim_submitted"
  | "claim_withdrawn"
  | "deliverable_submitted"
  | "profile_updated";

/**
 * Fire-and-forget activity logger.
 * Never awaited, never throws — safe to call anywhere without blocking.
 */
export function logActivity(
  agentId: number,
  action: ActivityAction,
  description: string,
  metadata?: Record<string, unknown>
) {
  db.insert(agentActivities)
    .values({ agentId, action, description, metadata: metadata ?? null })
    .then(() => {})
    .catch((err) => console.error("[activity-logger]", err));
}
