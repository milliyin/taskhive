// MCP Streamable HTTP endpoint — stateless, works on Vercel serverless
// Bridges Next.js App Router (Web API) to MCP SDK (Node.js HTTP primitives)
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "@/lib/mcp-server";

/**
 * Create a minimal IncomingMessage shim from a Web Request
 */
function toIncomingMessage(request: Request, body: string): IncomingMessage {
  const url = new URL(request.url);
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = request.method;
  req.url = url.pathname + url.search;
  // Copy headers
  request.headers.forEach((value, key) => {
    req.headers[key.toLowerCase()] = value;
  });
  // MCP Streamable HTTP requires Accept to include both types
  req.headers["accept"] = "application/json, text/event-stream";
  // Push body data and signal end
  req.push(body);
  req.push(null);
  return req;
}

/**
 * Capture a ServerResponse into a Web Response.
 * Does NOT delegate to the real write/end (the underlying socket is a dummy),
 * instead captures all chunks and resolves a Web Response promise.
 */
function captureResponse(): { res: ServerResponse; getResponse: () => Promise<Response> } {
  const socket = new Socket();
  const res = new ServerResponse(new IncomingMessage(socket));

  const chunks: Buffer[] = [];
  const headers: Record<string, string> = {};
  let resolvePromise: (r: Response) => void;

  const responsePromise = new Promise<Response>((resolve) => {
    resolvePromise = resolve;
  });

  // Capture writes without delegating to the dummy socket
  res.write = function (chunk: unknown): boolean {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    return true;
  } as typeof res.write;

  res.end = function (chunk?: unknown): ServerResponse {
    if (chunk && typeof chunk !== "function") {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    // Collect headers set by the transport
    const rawHeaders = res.getHeaders();
    for (const [key, val] of Object.entries(rawHeaders)) {
      if (val !== undefined) headers[key] = String(val);
    }
    // Convert Buffer to string — MCP responses are JSON or SSE text
    resolvePromise!(new Response(Buffer.concat(chunks).toString("utf-8"), {
      status: res.statusCode,
      headers,
    }));
    return res;
  } as typeof res.end;

  return { res, getResponse: () => responsePromise };
}

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

  const body = await request.text();

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(body);
  } catch {
    return Response.json({
      jsonrpc: "2.0",
      error: { code: -32700, message: "Parse error: invalid JSON" },
      id: null,
    }, { status: 400 });
  }

  const server = createMcpServer(token);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
  });

  await server.connect(transport);

  const req = toIncomingMessage(request, body);
  const { res, getResponse } = captureResponse();

  await transport.handleRequest(req, res, parsedBody);

  return getResponse();
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
