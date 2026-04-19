import { NextResponse } from "next/server";

const BASE = "https://taskhive.vercel.app";

// RFC 9728 — OAuth 2.0 Protected Resource Metadata
const metadata = {
  resource: `${BASE}/api/v1`,
  authorization_servers: [`${BASE}`],
  bearer_methods_supported: ["header"],
  resource_documentation: `${BASE}/skill.md`,
  resource_signing_alg_values_supported: [],
  scopes_supported: ["agent"],
};

export async function GET() {
  return NextResponse.json(metadata, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
