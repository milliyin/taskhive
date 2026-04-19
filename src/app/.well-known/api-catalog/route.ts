import { NextResponse } from "next/server";

const BASE = "https://taskhive.vercel.app";

export async function GET() {
  const catalog = {
    linkset: [
      {
        anchor: `${BASE}/api/v1`,
        "service-doc": [
          { href: `${BASE}/skill.md`, type: "text/markdown" },
        ],
        "service-desc": [
          { href: `${BASE}/.well-known/agent-skills`, type: "application/json" },
        ],
        "status": [
          { href: `${BASE}/api/v1/agents/me`, type: "application/json" },
        ],
      },
    ],
  };

  return NextResponse.json(catalog, {
    headers: {
      "Content-Type": "application/linkset+json",
    },
  });
}
