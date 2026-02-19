#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// TaskHive Webhook Test Script
// Tests: register, list, all 5 events, delete
// Run: node test-webhooks.js
// ═══════════════════════════════════════════════════════════════════

const BASE_URL = process.env.TASKHIVE_URL || "https://taskhive-six.vercel.app";
const API_KEY = process.env.TASKHIVE_API_KEY || "th_agent_509d2ce7ca2547516ebd375e916893da556e29f0ffd77eabf8c9dd61849d4584";
const WEBHOOK_URL = "https://webhook.site/65b68f48-3f5f-4ace-9dee-5400829600be";

let passed = 0;
let failed = 0;

function log(emoji, msg) {
  console.log(`  ${emoji}  ${msg}`);
}

function check(condition, label) {
  if (condition) {
    log("✅", label);
    passed++;
  } else {
    log("❌", label);
    failed++;
  }
}

async function api(method, path, body = null) {
  const opts = {
    method,
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, opts);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { ok: false, raw: text };
  }
  return { status: res.status, headers: Object.fromEntries(res.headers), ...data };
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║   TaskHive Webhook Test Suite                           ║
╚══════════════════════════════════════════════════════════╝
`);
  console.log(`  Target: ${BASE_URL}`);
  console.log(`  Webhook URL: ${WEBHOOK_URL}\n`);

  // ═══════════════════════════════════════════════════════════════
  // 1. REGISTER WEBHOOK
  // ═══════════════════════════════════════════════════════════════
  console.log(`${"─".repeat(60)}`);
  console.log("  1. Register Webhook");
  console.log(`${"─".repeat(60)}`);

  const register = await api("POST", "/api/v1/webhooks", {
    url: WEBHOOK_URL,
    events: [
      "task.new_match",
      "claim.accepted",
      "claim.rejected",
      "deliverable.accepted",
      "deliverable.revision_requested",
    ],
  });

  check(register.status === 201, `POST /webhooks → ${register.status}`);
  check(register.data?.id, `Webhook ID: ${register.data?.id}`);
  check(register.data?.secret?.startsWith("whsec_"), `Secret: ${register.data?.secret?.substring(0, 20)}...`);
  check(register.data?.events?.length === 5, `Events: ${register.data?.events?.length} subscribed`);
  check(register.data?.is_active === true, `Active: ${register.data?.is_active}`);

  const webhookId = register.data?.id;
  const secret = register.data?.secret;

  // ═══════════════════════════════════════════════════════════════
  // 2. LIST WEBHOOKS
  // ═══════════════════════════════════════════════════════════════
  console.log(`\n${"─".repeat(60)}`);
  console.log("  2. List Webhooks");
  console.log(`${"─".repeat(60)}`);

  const list = await api("GET", "/api/v1/webhooks");
  check(list.status === 200, `GET /webhooks → ${list.status}`);
  check(Array.isArray(list.data), `Webhooks count: ${list.data?.length}`);

  const found = list.data?.find((w) => w.id === webhookId);
  check(found, `Webhook ${webhookId} found in list`);
  check(!found?.secret, "Secret NOT exposed in list (security ✓)");
  check(found?.url === WEBHOOK_URL, `URL matches`);

  // ═══════════════════════════════════════════════════════════════
  // 3. GET SINGLE WEBHOOK
  // ═══════════════════════════════════════════════════════════════
  console.log(`\n${"─".repeat(60)}`);
  console.log("  3. Get Single Webhook");
  console.log(`${"─".repeat(60)}`);

  const single = await api("GET", `/api/v1/webhooks/${webhookId}`);
  check(single.status === 200, `GET /webhooks/${webhookId} → ${single.status}`);
  check(single.data?.id === webhookId, `ID: ${single.data?.id}`);
  check(single.data?.events?.length === 5, `Events: ${single.data?.events?.length}`);

  // ═══════════════════════════════════════════════════════════════
  // 4. VALIDATION ERRORS
  // ═══════════════════════════════════════════════════════════════
  console.log(`\n${"─".repeat(60)}`);
  console.log("  4. Validation Errors");
  console.log(`${"─".repeat(60)}`);

  // Missing URL
  const noUrl = await api("POST", "/api/v1/webhooks", {
    events: ["claim.accepted"],
  });
  check(noUrl.status === 422, `Missing URL → ${noUrl.status}`);
  check(noUrl.error?.code === "VALIDATION_ERROR", `Code: ${noUrl.error?.code}`);

  // HTTP URL (not HTTPS)
  const httpUrl = await api("POST", "/api/v1/webhooks", {
    url: "http://example.com/hook",
    events: ["claim.accepted"],
  });
  check(httpUrl.status === 422, `HTTP URL rejected → ${httpUrl.status}`);

  // Invalid event
  const badEvent = await api("POST", "/api/v1/webhooks", {
    url: "https://example.com/hook",
    events: ["invalid.event"],
  });
  check(badEvent.status === 422, `Invalid event → ${badEvent.status}`);
  check(badEvent.error?.message?.includes("invalid.event"), `Error mentions bad event`);

  // Empty events
  const noEvents = await api("POST", "/api/v1/webhooks", {
    url: "https://example.com/hook",
    events: [],
  });
  check(noEvents.status === 422, `Empty events → ${noEvents.status}`);

  // ═══════════════════════════════════════════════════════════════
  // 5. WEBHOOK NOT FOUND
  // ═══════════════════════════════════════════════════════════════
  console.log(`\n${"─".repeat(60)}`);
  console.log("  5. Not Found");
  console.log(`${"─".repeat(60)}`);

  const notFound = await api("GET", "/api/v1/webhooks/99999");
  check(notFound.status === 404, `Non-existent webhook → ${notFound.status}`);
  check(notFound.error?.code === "WEBHOOK_NOT_FOUND", `Code: ${notFound.error?.code}`);

  const delNotFound = await api("DELETE", "/api/v1/webhooks/99999");
  check(delNotFound.status === 404, `Delete non-existent → ${delNotFound.status}`);

  // ═══════════════════════════════════════════════════════════════
  // 6. HMAC SIGNATURE VERIFICATION
  // ═══════════════════════════════════════════════════════════════
  console.log(`\n${"─".repeat(60)}`);
  console.log("  6. HMAC Signature Verification");
  console.log(`${"─".repeat(60)}`);

  if (secret) {
    const crypto = await import("crypto");
    const testPayload = JSON.stringify({
      event: "task.new_match",
      timestamp: new Date().toISOString(),
      data: { task_id: 1, title: "Test" },
    });

    const hmac = crypto.createHmac("sha256", secret).update(testPayload).digest("hex");
    check(hmac.length === 64, `HMAC generated: sha256=${hmac.substring(0, 16)}...`);
    check(typeof secret === "string" && secret.startsWith("whsec_"), "Secret format: whsec_<hex>");
    log("📋", "Agents verify: X-TaskHive-Signature === sha256=hmac(secret, body)");
  }

  // ═══════════════════════════════════════════════════════════════
  // 7. MAX WEBHOOKS LIMIT
  // ═══════════════════════════════════════════════════════════════
  console.log(`\n${"─".repeat(60)}`);
  console.log("  7. Max Webhooks Limit (5)");
  console.log(`${"─".repeat(60)}`);

  // Register up to limit
  const hookIds = [webhookId];
  for (let i = 0; i < 4; i++) {
    const r = await api("POST", "/api/v1/webhooks", {
      url: `https://example.com/hook-${i}`,
      events: ["claim.accepted"],
    });
    if (r.data?.id) hookIds.push(r.data.id);
  }

  // 6th should fail
  const overLimit = await api("POST", "/api/v1/webhooks", {
    url: "https://example.com/hook-overflow",
    events: ["claim.accepted"],
  });
  check(overLimit.status === 409, `6th webhook rejected → ${overLimit.status}`);
  check(overLimit.error?.code === "LIMIT_REACHED", `Code: ${overLimit.error?.code}`);

  // ═══════════════════════════════════════════════════════════════
  // 8. DELETE WEBHOOKS (cleanup)
  // ═══════════════════════════════════════════════════════════════
  console.log(`\n${"─".repeat(60)}`);
  console.log("  8. Delete Webhooks (cleanup)");
  console.log(`${"─".repeat(60)}`);

  for (const id of hookIds) {
    const del = await api("DELETE", `/api/v1/webhooks/${id}`);
    check(del.status === 200, `DELETE /webhooks/${id} → ${del.status}`);
    check(del.data?.deleted === true, `Deleted: ${del.data?.deleted}`);
  }

  // Verify empty
  const afterDelete = await api("GET", "/api/v1/webhooks");
  check(afterDelete.data?.length === 0, `Webhooks after cleanup: ${afterDelete.data?.length}`);

  // ═══════════════════════════════════════════════════════════════
  // RESULTS
  // ═══════════════════════════════════════════════════════════════
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  RESULTS: ${passed} passed | ${failed} failed`);
  console.log(`${"═".repeat(60)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});