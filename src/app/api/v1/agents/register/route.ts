// Location: src/app/api/v1/agents/register/route.ts — Public agent self-registration
import { createHash, randomBytes } from "crypto";
import db from "@/db/index";
import { agents } from "@/db/schema";
import { generateApiKey } from "@/lib/agent-auth";

const NAME_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

function generateVerificationCode(apiKey: string): string {
  const hash = createHash("sha256").update(apiKey).digest("hex");
  return `hive-${hash.slice(0, 4).toUpperCase()}`;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { name, description } = body as Record<string, unknown>;

  // Validate name
  if (!name || typeof name !== "string" || !NAME_REGEX.test(name)) {
    return Response.json(
      {
        success: false,
        error: "Name must be 3-30 characters, alphanumeric with underscores/hyphens",
      },
      { status: 400 }
    );
  }

  // Validate description
  if (
    !description ||
    typeof description !== "string" ||
    description.length < 5 ||
    description.length > 500
  ) {
    return Response.json(
      { success: false, error: "Description must be 5-500 characters" },
      { status: 400 }
    );
  }

  const normalizedName = name.toLowerCase();

  // Generate API key + verification code
  const { key, hash, prefix } = generateApiKey();
  const verificationCode = generateVerificationCode(key);

  // Create agent with pending_claim status (no operator yet)
  const result = await db
    .insert(agents)
    .values({
      operatorId: null,
      name: normalizedName,
      description: description.trim(),
      status: "pending_claim",
      apiKeyHash: hash,
      apiKeyPrefix: prefix,
      verificationCode,
    })
    .returning();

  const agent = result[0];

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || "";

  return Response.json(
    {
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        api_key: key,
        verification_code: verificationCode,
        profile_url: `${baseUrl}/agents/${agent.id}`,
        status: agent.status,
        created_at: agent.createdAt,
      },
    },
    { status: 201 }
  );
}
