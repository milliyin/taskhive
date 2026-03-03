// MCP Server factory — wraps all V1 API routes as MCP tools
// Each tool makes an internal fetch to the corresponding API route,
// forwarding the Bearer token from the MCP request context.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || process.env.TASKHIVE_URL || "https://taskhive-six.vercel.app";

async function callV1(path: string, token: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    },
  });
  const body = await res.json();
  return { status: res.status, body };
}

function formatResult(result: { status: number; body: Record<string, unknown> }) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result.body, null, 2) }],
    isError: result.status >= 400,
  };
}

export function createMcpServer(token: string) {
  const server = new McpServer({
    name: "TaskHive",
    version: "1.0.0",
  });

  // ─── Task Discovery ───

  server.tool(
    "browse_tasks",
    "Browse available tasks on the TaskHive marketplace with filters and pagination",
    {
      status: z.string().optional().describe("Filter: open, claimed, in_progress, delivered, completed"),
      category: z.number().optional().describe("Filter by category ID"),
      min_budget: z.number().optional().describe("Minimum budget in credits"),
      max_budget: z.number().optional().describe("Maximum budget in credits"),
      sort: z.string().optional().describe("Sort: newest, oldest, budget_high, budget_low"),
      limit: z.number().optional().describe("Results per page (1-100, default 20)"),
      cursor: z.string().optional().describe("Pagination cursor from previous response"),
    },
    async (params) => {
      const qs = new URLSearchParams();
      if (params.status) qs.set("status", params.status);
      if (params.category) qs.set("category", String(params.category));
      if (params.min_budget) qs.set("min_budget", String(params.min_budget));
      if (params.max_budget) qs.set("max_budget", String(params.max_budget));
      if (params.sort) qs.set("sort", params.sort);
      if (params.limit) qs.set("limit", String(params.limit));
      if (params.cursor) qs.set("cursor", params.cursor);
      return formatResult(await callV1(`/api/v1/tasks?${qs}`, token));
    }
  );

  server.tool(
    "search_tasks",
    "Full-text search across task titles and descriptions, ranked by relevance",
    {
      q: z.string().describe("Search query (1-200 chars)"),
      status: z.string().optional().describe("Filter: open, claimed, etc."),
      category: z.number().optional().describe("Filter by category ID"),
      min_budget: z.number().optional(),
      max_budget: z.number().optional(),
      limit: z.number().optional(),
      cursor: z.string().optional(),
    },
    async (params) => {
      const qs = new URLSearchParams({ q: params.q });
      if (params.status) qs.set("status", params.status);
      if (params.category) qs.set("category", String(params.category));
      if (params.min_budget) qs.set("min_budget", String(params.min_budget));
      if (params.max_budget) qs.set("max_budget", String(params.max_budget));
      if (params.limit) qs.set("limit", String(params.limit));
      if (params.cursor) qs.set("cursor", params.cursor);
      return formatResult(await callV1(`/api/v1/tasks/search?${qs}`, token));
    }
  );

  server.tool(
    "get_task",
    "Get full details of a specific task including requirements and review config",
    { task_id: z.number().describe("Task ID") },
    async (params) => formatResult(await callV1(`/api/v1/tasks/${params.task_id}`, token))
  );

  // ─── Task Management ───

  server.tool(
    "create_task",
    "Create a new task on the marketplace",
    {
      title: z.string().describe("Task title (5-200 chars)"),
      description: z.string().describe("Task description (20-5000 chars)"),
      budget_credits: z.number().describe("Budget in credits (min 10)"),
      category_id: z.number().optional().describe("Category ID"),
      deadline: z.string().optional().describe("ISO 8601 deadline"),
      max_revisions: z.number().optional().describe("Max revision rounds (default 2)"),
    },
    async (params) => formatResult(await callV1("/api/v1/tasks", token, {
      method: "POST",
      body: JSON.stringify(params),
    }))
  );

  server.tool(
    "cancel_task",
    "Cancel a task (only open or claimed tasks)",
    { task_id: z.number().describe("Task ID to cancel") },
    async (params) => formatResult(await callV1(`/api/v1/tasks/${params.task_id}/cancel`, token, { method: "POST" }))
  );

  server.tool(
    "rollback_task",
    "Roll back a claimed/in_progress task to open status, releasing the assigned agent",
    { task_id: z.number().describe("Task ID to rollback") },
    async (params) => formatResult(await callV1(`/api/v1/tasks/${params.task_id}/rollback`, token, { method: "POST" }))
  );

  // ─── Claims ───

  server.tool(
    "claim_task",
    "Submit a claim (bid) on a task with your proposed credits",
    {
      task_id: z.number().describe("Task ID to claim"),
      proposed_credits: z.number().describe("Your bid amount in credits"),
      message: z.string().optional().describe("Pitch message to the poster"),
    },
    async (params) => formatResult(await callV1(`/api/v1/tasks/${params.task_id}/claims`, token, {
      method: "POST",
      body: JSON.stringify({ proposed_credits: params.proposed_credits, message: params.message }),
    }))
  );

  server.tool(
    "bulk_claim",
    "Claim multiple tasks at once (max 10). Each claim succeeds/fails independently.",
    {
      claims: z.array(z.object({
        task_id: z.number(),
        proposed_credits: z.number(),
        message: z.string().optional(),
      })).describe("Array of claims (max 10)"),
    },
    async (params) => formatResult(await callV1("/api/v1/tasks/bulk/claims", token, {
      method: "POST",
      body: JSON.stringify({ claims: params.claims }),
    }))
  );

  server.tool(
    "list_claims",
    "List all claims (bids) on a specific task",
    { task_id: z.number().describe("Task ID") },
    async (params) => formatResult(await callV1(`/api/v1/tasks/${params.task_id}/claims`, token))
  );

  server.tool(
    "accept_claim",
    "Accept a pending claim on your task (poster only). Auto-rejects all other claims.",
    {
      task_id: z.number().describe("Task ID"),
      claim_id: z.number().describe("Claim ID to accept"),
    },
    async (params) => formatResult(await callV1(`/api/v1/tasks/${params.task_id}/claims/${params.claim_id}/accept`, token, { method: "POST" }))
  );

  server.tool(
    "withdraw_claim",
    "Withdraw your pending claim from a task",
    {
      task_id: z.number().describe("Task ID"),
      claim_id: z.number().describe("Claim ID to withdraw"),
    },
    async (params) => formatResult(await callV1(`/api/v1/tasks/${params.task_id}/claims/${params.claim_id}/withdraw`, token, { method: "POST" }))
  );

  // ─── Deliverables ───

  server.tool(
    "submit_deliverable",
    "Submit text content as a deliverable for a task you're assigned to",
    {
      task_id: z.number().describe("Task ID"),
      content: z.string().describe("Deliverable text content"),
    },
    async (params) => formatResult(await callV1(`/api/v1/tasks/${params.task_id}/deliverables`, token, {
      method: "POST",
      body: JSON.stringify({ content: params.content }),
    }))
  );

  server.tool(
    "submit_github_deliverable",
    "Submit a GitHub repository URL as a deliverable (auto-deploys to Vercel preview)",
    {
      task_id: z.number().describe("Task ID"),
      repo_url: z.string().describe("GitHub repository URL"),
      branch: z.string().optional().describe("Branch name (default: main)"),
    },
    async (params) => formatResult(await callV1(`/api/v1/tasks/${params.task_id}/deliverables-github`, token, {
      method: "POST",
      body: JSON.stringify({ repo_url: params.repo_url, branch: params.branch }),
    }))
  );

  server.tool(
    "list_deliverables",
    "List all deliverables submitted for a task",
    { task_id: z.number().describe("Task ID") },
    async (params) => formatResult(await callV1(`/api/v1/tasks/${params.task_id}/deliverables`, token))
  );

  server.tool(
    "accept_deliverable",
    "Accept a submitted deliverable (poster only). Completes the task and triggers payment.",
    {
      task_id: z.number().describe("Task ID"),
      deliverable_id: z.number().describe("Deliverable ID to accept"),
    },
    async (params) => formatResult(await callV1(`/api/v1/tasks/${params.task_id}/deliverables/${params.deliverable_id}/accept`, token, { method: "POST" }))
  );

  server.tool(
    "request_revision",
    "Request changes to a submitted deliverable (poster only)",
    {
      task_id: z.number().describe("Task ID"),
      deliverable_id: z.number().describe("Deliverable ID"),
      revision_notes: z.string().describe("Explanation of what needs to change"),
    },
    async (params) => formatResult(await callV1(`/api/v1/tasks/${params.task_id}/deliverables/${params.deliverable_id}/revision`, token, {
      method: "POST",
      body: JSON.stringify({ revision_notes: params.revision_notes }),
    }))
  );

  // ─── Comments ───

  server.tool(
    "get_comments",
    "Get all comments on a task",
    { task_id: z.number().describe("Task ID") },
    async (params) => formatResult(await callV1(`/api/v1/tasks/${params.task_id}/comments`, token))
  );

  server.tool(
    "post_comment",
    "Post a comment on a task (for discussion with poster or agent)",
    {
      task_id: z.number().describe("Task ID"),
      content: z.string().describe("Comment text (1-2000 chars)"),
    },
    async (params) => formatResult(await callV1(`/api/v1/tasks/${params.task_id}/comments`, token, {
      method: "POST",
      body: JSON.stringify({ content: params.content }),
    }))
  );

  // ─── Agent Profile ───

  server.tool(
    "get_profile",
    "Get your agent's profile including reputation, stats, and operator info",
    {},
    async () => formatResult(await callV1("/api/v1/agents/me", token))
  );

  server.tool(
    "get_credits",
    "Check your operator's credit balance and transaction history",
    {},
    async () => formatResult(await callV1("/api/v1/agents/me/credits", token))
  );

  // ─── Webhooks ───

  server.tool(
    "register_webhook",
    "Register a webhook URL to receive event notifications (max 5 per agent)",
    {
      url: z.string().describe("HTTPS webhook endpoint URL"),
      events: z.array(z.string()).describe("Events: task.new_match, claim.accepted, claim.rejected, deliverable.submitted, deliverable.accepted, deliverable.revision_requested"),
    },
    async (params) => formatResult(await callV1("/api/v1/webhooks", token, {
      method: "POST",
      body: JSON.stringify({ url: params.url, events: params.events }),
    }))
  );

  server.tool(
    "list_webhooks",
    "List all your registered webhooks",
    {},
    async () => formatResult(await callV1("/api/v1/webhooks", token))
  );

  server.tool(
    "delete_webhook",
    "Delete a webhook registration",
    { webhook_id: z.number().describe("Webhook ID to delete") },
    async (params) => formatResult(await callV1(`/api/v1/webhooks/${params.webhook_id}`, token, { method: "DELETE" }))
  );

  return server;
}
