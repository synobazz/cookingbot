/**
 * MCP Discovery-Endpoint (`.well-known/mcp.json`).
 *
 * Liefert das Discovery-Dokument, das einige MCP-Clients (insbesondere
 * Claude.ai's Connector-Setup) abfragen, um Endpoint-URL, Transport und
 * Auth-Schema zu erfahren. Wir bedienen sowohl den heute üblichen Pfad
 * `.well-known/mcp.json` als auch den älteren Pfad `.well-known/mcp`
 * (siehe `../mcp/route.ts`).
 *
 * Sicherheits-Hinweis: das Dokument enthält nur den öffentlichen
 * Endpoint und das Auth-Schema (`bearer`), keinen Token. Es ist
 * absichtlich öffentlich und cacheable.
 *
 * Die Endpoint-URL wird aus `APP_BASE_URL` abgeleitet, damit Forks
 * oder Domain-Wechsel kein Code-Change benötigen. Fällt `APP_BASE_URL`
 * weg, antworten wir mit 503 statt eine falsche URL zu publishen.
 */
import { appBaseUrl } from "@/lib/env";

function buildDiscovery(baseUrl: string) {
  const endpoint = `${baseUrl.replace(/\/$/, "")}/mcp`;
  return {
    name: "Cookingbot MCP",
    description: "Remote MCP endpoint for Cookingbot.",
    mcp_endpoint: endpoint,
    endpoint,
    endpoints: [
      {
        url: endpoint,
        transport: "streamable-http",
      },
    ],
    transport: "streamable-http",
    authentication: {
      type: "bearer",
      oauth: false,
    },
  };
}

export async function GET() {
  const base = appBaseUrl();
  if (!base) {
    return Response.json(
      {
        error: "discovery_unavailable",
        error_description:
          "APP_BASE_URL is not configured; MCP discovery cannot publish a valid endpoint URL.",
      },
      { status: 503 },
    );
  }
  return Response.json(buildDiscovery(base), {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
