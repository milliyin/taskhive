import {
  pgTable,
  pgEnum,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  doublePrecision,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ═══════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════

export const userRoleEnum = pgEnum("user_role", [
  "poster",
  "operator",
  "both",
  "admin",
]);

export const agentStatusEnum = pgEnum("agent_status", [
  "active",
  "paused",
  "suspended",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "open",
  "claimed",
  "in_progress",
  "delivered",
  "completed",
  "disputed",
  "cancelled",
]);

export const claimStatusEnum = pgEnum("claim_status", [
  "pending",
  "accepted",
  "rejected",
  "withdrawn",
]);

export const deliverableStatusEnum = pgEnum("deliverable_status", [
  "submitted",
  "accepted",
  "rejected",
  "revision_requested",
]);

export const creditTransactionTypeEnum = pgEnum("credit_transaction_type", [
  "deposit",
  "bonus",
  "payment",
  "platform_fee",
  "refund",
]);

// ═══════════════════════════════════════════════════════════════════════
// TABLES
// ═══════════════════════════════════════════════════════════════════════

// ─── Users ───────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull().default("both"),
  avatarUrl: varchar("avatar_url", { length: 512 }),
  bio: text("bio"),
  creditBalance: integer("credit_balance").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Categories ──────────────────────────────────────────────────────
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).unique().notNull(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ─── Agents ──────────────────────────────────────────────────────────
export const agents = pgTable(
  "agents",
  {
    id: serial("id").primaryKey(),
    operatorId: integer("operator_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description").notNull(),
    capabilities: text("capabilities").array().default([]),
    categoryIds: integer("category_ids").array().default([]),
    hourlyRateCredits: integer("hourly_rate_credits"),
    apiKeyHash: varchar("api_key_hash", { length: 64 }),
    apiKeyPrefix: varchar("api_key_prefix", { length: 14 }),
    webhookUrl: varchar("webhook_url", { length: 512 }),
    status: agentStatusEnum("status").notNull().default("active"),
    reputationScore: doublePrecision("reputation_score").notNull().default(50.0),
    tasksCompleted: integer("tasks_completed").notNull().default(0),
    avgRating: doublePrecision("avg_rating"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_agents_operator_id").on(table.operatorId),
    index("idx_agents_status").on(table.status),
    index("idx_agents_reputation").on(table.reputationScore),
  ]
);

// ─── Tasks ───────────────────────────────────────────────────────────
export const tasks = pgTable(
  "tasks",
  {
    id: serial("id").primaryKey(),
    posterId: integer("poster_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description").notNull(),
    requirements: text("requirements"),
    budgetCredits: integer("budget_credits").notNull(),
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    status: taskStatusEnum("status").notNull().default("open"),
    claimedByAgentId: integer("claimed_by_agent_id").references(
      () => agents.id,
      { onDelete: "set null" }
    ),
    deadline: timestamp("deadline", { withTimezone: true }),
    maxRevisions: integer("max_revisions").notNull().default(2),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_tasks_poster_id").on(table.posterId),
    index("idx_tasks_status").on(table.status),
    index("idx_tasks_category_id").on(table.categoryId),
    index("idx_tasks_claimed_by_agent_id").on(table.claimedByAgentId),
    index("idx_tasks_created_at").on(table.createdAt),
  ]
);

// ─── Task Claims ─────────────────────────────────────────────────────
export const taskClaims = pgTable(
  "task_claims",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    agentId: integer("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    proposedCredits: integer("proposed_credits").notNull(),
    message: text("message"),
    status: claimStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("task_claims_task_id_agent_id_unique").on(
      table.taskId,
      table.agentId
    ),
    index("idx_task_claims_task_id").on(table.taskId),
    index("idx_task_claims_agent_id").on(table.agentId),
    index("idx_task_claims_status").on(table.status),
  ]
);

// ─── Deliverables ────────────────────────────────────────────────────
export const deliverables = pgTable(
  "deliverables",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    agentId: integer("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    status: deliverableStatusEnum("status").notNull().default("submitted"),
    revisionNotes: text("revision_notes"),
    revisionNumber: integer("revision_number").notNull().default(1),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_deliverables_task_id").on(table.taskId),
    index("idx_deliverables_agent_id").on(table.agentId),
  ]
);

// ─── Reviews ─────────────────────────────────────────────────────────
export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id")
      .notNull()
      .unique()
      .references(() => tasks.id, { onDelete: "cascade" }),
    reviewerId: integer("reviewer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    agentId: integer("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    qualityScore: integer("quality_score"),
    speedScore: integer("speed_score"),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_reviews_agent_id").on(table.agentId),
    index("idx_reviews_reviewer_id").on(table.reviewerId),
  ]
);

// ─── Credit Transactions ─────────────────────────────────────────────
export const creditTransactions = pgTable(
  "credit_transactions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    type: creditTransactionTypeEnum("type").notNull(),
    taskId: integer("task_id").references(() => tasks.id, {
      onDelete: "set null",
    }),
    counterpartyId: integer("counterparty_id").references(() => users.id, {
      onDelete: "set null",
    }),
    description: text("description"),
    balanceAfter: integer("balance_after").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_credit_tx_user_id").on(table.userId),
    index("idx_credit_tx_task_id").on(table.taskId),
    index("idx_credit_tx_type").on(table.type),
    index("idx_credit_tx_created_at").on(table.createdAt),
  ]
);

// ─── Webhooks ────────────────────────────────────────────────────────
export const webhooks = pgTable(
  "webhooks",
  {
    id: serial("id").primaryKey(),
    agentId: integer("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    url: varchar("url", { length: 512 }).notNull(),
    secret: varchar("secret", { length: 255 }).notNull(),
    events: text("events").array().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
    failureCount: integer("failure_count").notNull().default(0),
  },
  (table) => [index("idx_webhooks_agent_id").on(table.agentId)]
);

// ═══════════════════════════════════════════════════════════════════════
// RELATIONS
// ═══════════════════════════════════════════════════════════════════════

export const usersRelations = relations(users, ({ many }) => ({
  agents: many(agents),
  tasks: many(tasks),
  reviews: many(reviews),
  creditTransactions: many(creditTransactions),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  operator: one(users, {
    fields: [agents.operatorId],
    references: [users.id],
  }),
  taskClaims: many(taskClaims),
  deliverables: many(deliverables),
  reviews: many(reviews),
  webhooks: many(webhooks),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  poster: one(users, {
    fields: [tasks.posterId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [tasks.categoryId],
    references: [categories.id],
  }),
  claimedByAgent: one(agents, {
    fields: [tasks.claimedByAgentId],
    references: [agents.id],
  }),
  claims: many(taskClaims),
  deliverables: many(deliverables),
  review: one(reviews),
}));

export const taskClaimsRelations = relations(taskClaims, ({ one }) => ({
  task: one(tasks, {
    fields: [taskClaims.taskId],
    references: [tasks.id],
  }),
  agent: one(agents, {
    fields: [taskClaims.agentId],
    references: [agents.id],
  }),
}));

export const deliverablesRelations = relations(deliverables, ({ one }) => ({
  task: one(tasks, {
    fields: [deliverables.taskId],
    references: [tasks.id],
  }),
  agent: one(agents, {
    fields: [deliverables.agentId],
    references: [agents.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  task: one(tasks, {
    fields: [reviews.taskId],
    references: [tasks.id],
  }),
  reviewer: one(users, {
    fields: [reviews.reviewerId],
    references: [users.id],
  }),
  agent: one(agents, {
    fields: [reviews.agentId],
    references: [agents.id],
  }),
}));

export const creditTransactionsRelations = relations(
  creditTransactions,
  ({ one }) => ({
    user: one(users, {
      fields: [creditTransactions.userId],
      references: [users.id],
    }),
    task: one(tasks, {
      fields: [creditTransactions.taskId],
      references: [tasks.id],
    }),
    counterparty: one(users, {
      fields: [creditTransactions.counterpartyId],
      references: [users.id],
    }),
  })
);

export const webhooksRelations = relations(webhooks, ({ one }) => ({
  agent: one(agents, {
    fields: [webhooks.agentId],
    references: [agents.id],
  }),
}));
