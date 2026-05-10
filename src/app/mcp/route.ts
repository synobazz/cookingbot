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
import { clientKey, createRateLimiter } from "@/lib/rate-limit";

// Force dynamic rendering: niemals SSG/Caching für JSON-RPC-Endpoints.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Rate-Limit gegen Bearer-Token-Brute-Force.
 *
 * Auch wenn der Token kryptografisch lang ist, schützt das Limit gegen
 * a) DoS durch tausende unauth-Requests/s und
 * b) langsam-tröpfelnde Probier-Versuche (z. B. Wörterbuch-Angriff,
 *    falls jemand einen kürzeren Token gewählt hat).
 *
 * Nur Fehlversuche werden gezählt — eine erfolgreiche Auth setzt das
 * Counter-Bucket zurück, damit eine aktive Claude-Session mit vielen
 * Tool-Calls nicht ins Limit läuft.
 *
 * Bewusst großzügiger als das Login-Limit (50 statt 8), weil Tool-Calls
 * von außen typischerweise in Bursts kommen und ein versehentlich
 * falscher Header in einer Connector-Konfiguration nicht binnen weniger
 * Sekunden den ganzen Tag aussperren soll. Window: 15 Minuten.
 */
const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 50 });

function unauthorized(status: 401 | 503, message: string) {
  // 401-Antworten lt. MCP-Auth-Spec idealerweise mit WWW-Authenticate-Header.
  // Wir nutzen Bearer-Token-Schema, kein OAuth, also nur ein Hinweis-Header.
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (status === 401) headers["www-authenticate"] = 'Bearer realm="cookingbot-mcp"';
  return new NextResponse(JSON.stringify({ error: message }), { status, headers });
}

function tooManyRequests() {
  return new NextResponse(
    JSON.stringify({
      error: "Too many failed authentication attempts. Try again later.",
    }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        // 15 Minuten in Sekunden, damit Clients sinnvoll backoff'en.
        "retry-after": String(15 * 60),
      },
    },
  );
}

async function handle(req: NextRequest): Promise<Response> {
  const key = clientKey(req);

  // Rate-Limit-Check vor dem Bearer-Vergleich. Wenn der Bucket voll ist,
  // gar nicht erst gegen den Token vergleichen — der timing-safe-Check
  // wäre zwar billig, aber wir wollen DoS-Druck früher abfangen.
  if (authLimiter.isLimited(key)) {
    return tooManyRequests();
  }

  const auth = verifyMcpBearer(req.headers.get("authorization"));
  if (!auth.ok) {
    // Nur "echte" Auth-Fehler (401) zählen als Fehlversuch. 503 bedeutet
    // "Endpoint deaktiviert (Token nicht konfiguriert)" und ist kein
    // Brute-Force-Vektor — dort bringt Limit-Erhöhung keinen Mehrwert.
    if (auth.status === 401) authLimiter.recordFailure(key);
    return unauthorized(auth.status, auth.message);
  }

  // Erfolgreiche Auth → Counter zurücksetzen, damit ein einmal richtig
  // konfigurierter Claude-Connector nie ins Limit läuft.
  authLimiter.reset(key);

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
    // Stack-Trace nur strukturiert ins Server-Log, nicht an den Client.
    // Der Client sieht eine generische Meldung; im Container-Log steht
    // ein eindeutiger Tag, mit dem sich Vorfälle korrelieren lassen.
    console.error(
      JSON.stringify({
        tag: "mcp.transport_error",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }),
    );
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
