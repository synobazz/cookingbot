/**
 * OAuth Authorization-Server-Discovery (RFC 8414).
 *
 * Cookingbot MCP nutzt **kein** OAuth, sondern Bearer-Tokens aus der
 * Konfiguration. Trotzdem fragen einige Clients (Claude.ai's Connector
 * Setup) diese Wohlbekanntheits-URL ab. Wir antworten freundlich mit
 * einer 404, die im JSON klarmacht, wie der Server stattdessen genutzt
 * wird, statt eine Empty-Response zurückzuspielen, an der ein Client
 * raten muss.
 *
 * Die in der Antwort enthaltene MCP-Endpoint-URL wird aus
 * `APP_BASE_URL` abgeleitet, damit kein hardcodierter Hostname
 * versehentlich auf einen anderen Deploy zeigt.
 */
import { appBaseUrl } from "@/lib/env";

export async function GET() {
  const base = appBaseUrl();
  const endpoint = base ? `${base.replace(/\/$/, "")}/mcp` : null;
  return Response.json(
    {
      error: "not_found",
      error_description:
        "Cookingbot MCP does not expose OAuth authorization-server metadata. Connect directly to the MCP endpoint with a Bearer token.",
      mcp_endpoint: endpoint,
      authentication: {
        type: "bearer",
        oauth: false,
      },
    },
    { status: 404 },
  );
}
