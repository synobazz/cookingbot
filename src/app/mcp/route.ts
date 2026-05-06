/**
 * Cookingbot MCP-Endpoint.
 *
 * Sprache: Streamable HTTP (Web Standards) via @modelcontextprotocol/sdk.
 * Auth: Bearer-Token gegen `MCP_BEARER_TOKEN`. Ohne Token ist der Endpoint
 *       deaktiviert und antwortet mit HTTP 503.
 *
 * Stateless: Pro Request bauen wir einen frischen MCP-Server + Transport.
 * Das ist robust gegenüber Next.js-Hot-Reload und Multi-Instanz-Deployments,
 * verzichtet aber auf SSE-Resume-Funktionalität (für unseren Use-Case
 * unkritisch — Tool-Aufrufe sind kurz, kein Streaming nötig).
 *
 * Method-Handling:
 * - POST: Standard-Pfad für JSON-RPC (Tool-Aufrufe).
 * - GET / DELETE: Im stateless Modus existiert weder ein resumable
 *   SSE-Stream noch eine Session zum Schließen. Wir laufen sie aber
 *   trotzdem durch den Transport, damit die SDK-konformen 405/406-
 *   Antworten zurückgegeben werden, statt Next-Default-Routing.
 * - PUT/PATCH: bewusst nicht exportiert — Next antwortet automatisch
 *   mit 405. Das ist eine zusätzliche Verteidigungsebene gegen
 *   Tooling-Fehlkonfiguration.
 */
import { NextRequest, NextResponse } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { verifyMcpBearer } from "@/lib/auth";
import { createCookingbotMcpServer } from "@/lib/mcp-server";
import { registerCookingbotTools } from "@/lib/mcp-tools";

// Force dynamic rendering: niemals SSG/Caching für JSON-RPC-Endpoints.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function unauthorized(status: 401 | 503, message: string) {
  // 401-Antworten lt. MCP-Auth-Spec idealerweise mit WWW-Authenticate-Header.
  // Wir nutzen Bearer-Token-Schema, kein OAuth, also nur ein Hinweis-Header.
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (status === 401) headers["www-authenticate"] = 'Bearer realm="cookingbot-mcp"';
  return new NextResponse(JSON.stringify({ error: message }), { status, headers });
}

async function handle(req: NextRequest): Promise<Response> {
  const auth = verifyMcpBearer(req.headers.get("authorization"));
  if (!auth.ok) return unauthorized(auth.status, auth.message);

  const transport = new WebStandardStreamableHTTPServerTransport({
    // Stateless: keinen Session-ID-Generator → Server arbeitet ohne Sessions.
    sessionIdGenerator: undefined,
    // JSON-Responses statt SSE für unsere kurzen, idempotenten Tools.
    enableJsonResponse: true,
  });

  const server = createCookingbotMcpServer();
  registerCookingbotTools(server);

  try {
    await server.connect(transport);
    return await transport.handleRequest(req);
  } catch (error) {
    console.error("MCP request handling failed", error);
    return new NextResponse(
      JSON.stringify({ error: "MCP transport error" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  } finally {
    // Pro-Request-Server: nach dem Antworten aufräumen, damit keine offenen Streams bleiben.
    server.close().catch(() => undefined);
  }
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function DELETE(req: NextRequest) {
  return handle(req);
}

// Eine Method-Allowlist als zusätzliche Sicherheits- und Diagnose-Schicht.
// Wenn ein falsch konfigurierter Client mit PUT/PATCH/HEAD anklopft, bekommt
// er sofort eine sprechende 405-Antwort mit Allow-Header zurück, statt eine
// Next-default-Antwort, bei der man rätseln muss.
const ALLOW_HEADER = "GET, POST, DELETE";

function methodNotAllowed(): Response {
  return new NextResponse(
    JSON.stringify({ error: "Method not allowed", allow: ALLOW_HEADER }),
    {
      status: 405,
      headers: {
        "content-type": "application/json",
        allow: ALLOW_HEADER,
      },
    },
  );
}

export async function PUT() {
  return methodNotAllowed();
}

export async function PATCH() {
  return methodNotAllowed();
}

export async function HEAD() {
  return methodNotAllowed();
}

// Kein OPTIONS-Handler: Cookingbot-MCP wird ausschließlich serverseitig
// von Claude Desktop bzw. dem Claude-Connector aufgerufen, nicht aus dem
// Browser. Ohne CORS-Header ist die Angriffsfläche minimal.
