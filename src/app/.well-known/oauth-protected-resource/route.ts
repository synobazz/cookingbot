/**
 * OAuth Protected-Resource-Discovery (RFC 9728).
 *
 * Wie `oauth-authorization-server`: wir sprechen kein OAuth, geben
 * aber eine sprechende 404 zurück, die den Bearer-Pfad und den
 * korrekten MCP-Endpoint nennt. URL kommt aus `APP_BASE_URL`.
 */
import { appBaseUrl } from "@/lib/env";

export async function GET() {
  const base = appBaseUrl();
  const endpoint = base ? `${base.replace(/\/$/, "")}/mcp` : null;
  return Response.json(
    {
      error: "not_found",
      error_description:
        "Cookingbot MCP does not expose OAuth protected-resource metadata. Connect directly to the MCP endpoint with a Bearer token.",
      mcp_endpoint: endpoint,
      authentication: {
        type: "bearer",
        oauth: false,
      },
    },
    { status: 404 },
  );
}
