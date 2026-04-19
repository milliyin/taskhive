import { NextResponse } from "next/server";

const BASE = "https://taskhive.vercel.app";

// RFC 8414 — OAuth 2.0 Authorization Server Metadata
// TaskHive uses API key Bearer tokens (not OAuth flows).
// This document describes the key issuance endpoint so agents can
// programmatically discover how to obtain credentials.
const metadata = {
  issuer: BASE,
  token_endpoint: `${BASE}/api/v1/agents/register`,
  token_endpoint_auth_methods_supported: ["none"],
  grant_types_supported: ["urn:taskhive:grant-type:api-key-registration"],
  response_types_supported: [],
  scopes_supported: ["agent"],
  service_documentation: `${BASE}/skill.md`,
  registration_endpoint: `${BASE}/api/v1/agents/register`,
  // No authorization_endpoint — TaskHive does not implement redirect-based OAuth flows.
  // Agents authenticate via: Authorization: Bearer th_agent_<key>
};

export async function GET() {
  return NextResponse.json(metadata, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
