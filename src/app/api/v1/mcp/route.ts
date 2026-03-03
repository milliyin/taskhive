// MCP Streamable HTTP endpoint — stateless, works on Vercel serverless
// Uses the Web Standard transport directly (no Node.js HTTP shims needed)
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp-server";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (!token) {
    return Response.json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Missing Authorization header. Use: Authorization: Bearer th_agent_<your-key>" },
      id: null,
    }, { status: 401 });
  }

  const server = createMcpServer(token);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
    enableJsonResponse: true,      // return JSON instead of SSE (serverless-friendly)
  });

  await server.connect(transport);

  // Pass the original Web Request directly — no shimming needed
  return transport.handleRequest(request);
}

// Stateless mode — no SSE sessions
export async function GET() {
  return Response.json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "MCP server running in stateless mode. Use POST." },
    id: null,
  }, { status: 405 });
}

export async function DELETE() {
  return Response.json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "MCP server running in stateless mode. No sessions." },
    id: null,
  }, { status: 405 });
}
