import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Registriert alle Cookingbot-Tools auf einem frisch erstellten MCP-Server.
 *
 * Die Tools sind so geschnitten, dass sie als Bausteine für einen LLM-Agenten
 * funktionieren: kurze Beschreibung, klares Eingabeschema, deterministische
 * Antworten. Tool-Beschreibungen sind auf Deutsch — Claude versteht beides,
 * aber der Endnutzer interagiert auf Deutsch und das hilft bei der Disambiguierung.
 */
export function registerCookingbotTools(server: McpServer): void {
  registerPing(server);
}

/* ── Ping ─────────────────────────────────────────────────────────── */

function registerPing(server: McpServer): void {
  server.registerTool(
    "ping",
    {
      title: "Verbindungstest",
      description:
        "Antwortet mit 'pong' und der aktuellen Server-Zeit. Nutze dieses Tool zur Diagnose, ob der Cookingbot-MCP-Server erreichbar ist.",
      inputSchema: {
        echo: z
          .string()
          .max(200)
          .optional()
          .describe("Optionaler Text, der zurückgespiegelt werden soll."),
      },
    },
    async ({ echo }) => ({
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            ok: true,
            pong: echo || "pong",
            serverTime: new Date().toISOString(),
          }),
        },
      ],
    }),
  );
}
