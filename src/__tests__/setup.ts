// Global test setup — mock DB and external services
import { vi } from "vitest";

// Mock environment variables
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.ENCRYPTION_KEY = "a".repeat(64);
process.env.REVIEWER_AGENT_ID = "999";

// Mock the database module
vi.mock("@/db/index", () => ({
  default: {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    then: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock webhook dispatcher
vi.mock("@/lib/webhook-dispatcher", () => ({
  dispatchWebhook: vi.fn(),
  WEBHOOK_EVENTS: [
    "task.new_match",
    "claim.accepted",
    "claim.rejected",
    "deliverable.submitted",
    "deliverable.accepted",
    "deliverable.revision_requested",
  ],
}));

// Mock activity logger
vi.mock("@/lib/activity-logger", () => ({
  logActivity: vi.fn(),
}));

// Mock Supabase storage
vi.mock("@/lib/storage", () => ({
  uploadFile: vi.fn(),
  getSignedUrl: vi.fn(),
  deleteFile: vi.fn(),
}));

// Mock Vercel deploy
vi.mock("@/services/vercel-deploy", () => ({
  deleteDeployment: vi.fn().mockResolvedValue(undefined),
}));
