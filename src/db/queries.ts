import { eq, and, desc, ne, sql } from "drizzle-orm";
import { InferInsertModel } from "drizzle-orm";
import db from "./index.js";
import {
  users,
  agents,
  tasks,
  taskClaims,
  deliverables,
  reviews,
  creditTransactions,
  categories,
} from "./schema.js";

// ═══════════════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════════════

export const userQueries = {
  async findById(id: number) {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0] || null;
  },

  async findByEmail(email: string) {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0] || null;
  },

  async create(data: InferInsertModel<typeof users>) {
    const result = await db.insert(users).values(data).returning();
    return result[0];
  },

  async update(id: number, data: Partial<InferInsertModel<typeof users>>) {
    const result = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0] || null;
  },

  async updateBalance(id: number, amount: number) {
    const result = await db
      .update(users)
      .set({
        creditBalance: sql`${users.creditBalance} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return result[0] || null;
  },
};

// ═══════════════════════════════════════════════════════════════════════
// AGENTS
// ═══════════════════════════════════════════════════════════════════════

export const agentQueries = {
  async findById(id: number) {
    const result = await db.select().from(agents).where(eq(agents.id, id));
    return result[0] || null;
  },

  async findByOperator(operatorId: number) {
    return db
      .select()
      .from(agents)
      .where(eq(agents.operatorId, operatorId))
      .orderBy(desc(agents.createdAt));
  },

  async findByApiKeyPrefix(prefix: string) {
    const result = await db
      .select()
      .from(agents)
      .where(
        and(eq(agents.apiKeyPrefix, prefix), eq(agents.status, "active"))
      );
    return result[0] || null;
  },

  async create(data: InferInsertModel<typeof agents>) {
    const result = await db.insert(agents).values(data).returning();
    return result[0];
  },

  async update(id: number, data: Partial<InferInsertModel<typeof agents>>) {
    const result = await db
      .update(agents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(agents.id, id))
      .returning();
    return result[0] || null;
  },

  async setApiKey(id: number, hash: string, prefix: string) {
    const result = await db
      .update(agents)
      .set({ apiKeyHash: hash, apiKeyPrefix: prefix, updatedAt: new Date() })
      .where(eq(agents.id, id))
      .returning({ id: agents.id, apiKeyPrefix: agents.apiKeyPrefix });
    return result[0] || null;
  },

  async updateReputation(id: number) {
    // Recalculate avg_rating and reputation from reviews
    const stats = await db
      .select({
        avgRat: sql<number>`AVG(${reviews.rating})::double precision`,
        total: sql<number>`COUNT(*)::integer`,
      })
      .from(reviews)
      .where(eq(reviews.agentId, id));

    if (!stats[0] || stats[0].total === 0) return null;

    const avgRating = stats[0].avgRat;
    const reputationScore = Math.min(100, Math.max(0, 50 + (avgRating - 3) * 20));

    const result = await db
      .update(agents)
      .set({
        avgRating,
        reputationScore,
        tasksCompleted: stats[0].total,
        updatedAt: new Date(),
      })
      .where(eq(agents.id, id))
      .returning();
    return result[0] || null;
  },
};

// ═══════════════════════════════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════════════════════════════

export const taskQueries = {
  async findById(id: number) {
    const result = await db.select().from(tasks).where(eq(tasks.id, id));
    return result[0] || null;
  },

  async findByIdWithRelations(id: number) {
    return db.query.tasks.findFirst({
      where: eq(tasks.id, id),
      with: {
        poster: true,
        category: true,
        claimedByAgent: true,
        claims: { with: { agent: true } },
        deliverables: true,
        review: true,
      },
    });
  },

  async list({ status = null, categoryId = null, limit = 20, offset = 0 }: {
    status?: string | null;
    categoryId?: number | null;
    limit?: number;
    offset?: number;
  } = {}) {
    const conditions = [];
    if (status) conditions.push(eq(tasks.status, status as typeof tasks.status.enumValues[number]));
    if (categoryId) conditions.push(eq(tasks.categoryId, categoryId));

    return db
      .select({
        task: tasks,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        posterName: users.name,
      })
      .from(tasks)
      .leftJoin(categories, eq(tasks.categoryId, categories.id))
      .leftJoin(users, eq(tasks.posterId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(tasks.createdAt))
      .limit(limit)
      .offset(offset);
  },

  async create(data: InferInsertModel<typeof tasks>) {
    const result = await db.insert(tasks).values(data).returning();
    return result[0];
  },

  async updateStatus(id: number, status: string, claimedByAgentId?: number | null) {
    const updateData: Record<string, unknown> = { status, updatedAt: new Date() };
    if (claimedByAgentId !== undefined) {
      updateData.claimedByAgentId = claimedByAgentId;
    }
    const result = await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id))
      .returning();
    return result[0] || null;
  },
};

// ═══════════════════════════════════════════════════════════════════════
// TASK CLAIMS
// ═══════════════════════════════════════════════════════════════════════

export const taskClaimQueries = {
  async findByTask(taskId: number) {
    return db
      .select({
        claim: taskClaims,
        agentName: agents.name,
        reputationScore: agents.reputationScore,
        avgRating: agents.avgRating,
      })
      .from(taskClaims)
      .innerJoin(agents, eq(taskClaims.agentId, agents.id))
      .where(eq(taskClaims.taskId, taskId))
      .orderBy(taskClaims.createdAt);
  },

  async create(data: InferInsertModel<typeof taskClaims>) {
    const result = await db.insert(taskClaims).values(data).returning();
    return result[0];
  },

  async accept(claimId: number, taskId: number) {
    // 1. Accept this claim
    await db
      .update(taskClaims)
      .set({ status: "accepted" })
      .where(eq(taskClaims.id, claimId));

    // 2. Reject all other pending claims for this task
    await db
      .update(taskClaims)
      .set({ status: "rejected" })
      .where(
        and(
          eq(taskClaims.taskId, taskId),
          ne(taskClaims.id, claimId),
          eq(taskClaims.status, "pending")
        )
      );

    // 3. Update task status and assign agent
    const claim = await db
      .select({ agentId: taskClaims.agentId })
      .from(taskClaims)
      .where(eq(taskClaims.id, claimId));

    if (claim[0]) {
      await db
        .update(tasks)
        .set({
          status: "claimed",
          claimedByAgentId: claim[0].agentId,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, taskId));
    }
    return claim[0] || null;
  },

  async reject(claimId: number) {
    await db
      .update(taskClaims)
      .set({ status: "rejected" })
      .where(eq(taskClaims.id, claimId));
  },

  async withdraw(claimId: number) {
    await db
      .update(taskClaims)
      .set({ status: "withdrawn" })
      .where(eq(taskClaims.id, claimId));
  },
};

// ═══════════════════════════════════════════════════════════════════════
// DELIVERABLES
// ═══════════════════════════════════════════════════════════════════════

export const deliverableQueries = {
  async findByTask(taskId: number) {
    return db
      .select()
      .from(deliverables)
      .where(eq(deliverables.taskId, taskId))
      .orderBy(deliverables.revisionNumber);
  },

  async submit(data: InferInsertModel<typeof deliverables>) {
    const result = await db.insert(deliverables).values(data).returning();
    // Update task status to delivered
    await db
      .update(tasks)
      .set({ status: "delivered", updatedAt: new Date() })
      .where(eq(tasks.id, data.taskId));
    return result[0];
  },

  async accept(deliverableId: number) {
    const result = await db
      .update(deliverables)
      .set({ status: "accepted" })
      .where(eq(deliverables.id, deliverableId))
      .returning();

    if (result[0]) {
      await db
        .update(tasks)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(tasks.id, result[0].taskId));
    }
    return result[0] || null;
  },

  async requestRevision(deliverableId: number, revisionNotes: string) {
    const result = await db
      .update(deliverables)
      .set({ status: "revision_requested", revisionNotes })
      .where(eq(deliverables.id, deliverableId))
      .returning();

    if (result[0]) {
      await db
        .update(tasks)
        .set({ status: "in_progress", updatedAt: new Date() })
        .where(eq(tasks.id, result[0].taskId));
    }
    return result[0] || null;
  },
};

// ═══════════════════════════════════════════════════════════════════════
// REVIEWS
// ═══════════════════════════════════════════════════════════════════════

export const reviewQueries = {
  async findByAgent(agentId: number, { limit = 10, offset = 0 }: { limit?: number; offset?: number } = {}) {
    return db
      .select({
        review: reviews,
        reviewerName: users.name,
        taskTitle: tasks.title,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.reviewerId, users.id))
      .innerJoin(tasks, eq(reviews.taskId, tasks.id))
      .where(eq(reviews.agentId, agentId))
      .orderBy(desc(reviews.createdAt))
      .limit(limit)
      .offset(offset);
  },

  async create(data: InferInsertModel<typeof reviews>) {
    const result = await db.insert(reviews).values(data).returning();
    // Recalculate agent reputation
    await agentQueries.updateReputation(data.agentId);
    return result[0];
  },
};

// ═══════════════════════════════════════════════════════════════════════
// CREDIT TRANSACTIONS
// ═══════════════════════════════════════════════════════════════════════

export const creditTransactionQueries = {
  async findByUser(userId: number, { limit = 20, offset = 0 }: { limit?: number; offset?: number } = {}) {
    return db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit)
      .offset(offset);
  },

  async record({ userId, amount, type, taskId = null, counterpartyId = null, description = null }: {
    userId: number;
    amount: number;
    type: typeof creditTransactions.$inferInsert.type;
    taskId?: number | null;
    counterpartyId?: number | null;
    description?: string | null;
  }) {
    // Get current balance
    const user = await db
      .select({ creditBalance: users.creditBalance })
      .from(users)
      .where(eq(users.id, userId));

    if (!user[0]) throw new Error(`User ${userId} not found`);

    const balanceAfter = user[0].creditBalance + amount;

    // Update user balance
    await db
      .update(users)
      .set({ creditBalance: balanceAfter, updatedAt: new Date() })
      .where(eq(users.id, userId));

    // Record transaction
    const result = await db
      .insert(creditTransactions)
      .values({
        userId,
        amount,
        type,
        taskId,
        counterpartyId,
        description,
        balanceAfter,
      })
      .returning();

    return result[0];
  },
};

// ═══════════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════════

export const categoryQueries = {
  async listAll() {
    return db.select().from(categories).orderBy(categories.sortOrder);
  },

  async findBySlug(slug: string) {
    const result = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, slug));
    return result[0] || null;
  },
};
