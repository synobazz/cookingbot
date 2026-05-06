import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Erstellt eine vorkonfigurierte MCP-Server-Instanz für Cookingbot.
 *
 * Wir bauen pro Request einen frischen Server, weil unser HTTP-Transport im
 * stateless Modus läuft (Next.js App-Router-Routen sind in der Praxis pro
 * Request) — es gibt also keinen geteilten Server-Zustand.
 *
 * Die eigentlichen Tools werden in `registerCookingbotTools` registriert, das
 * separat in `src/lib/mcp-tools.ts` lebt, damit dieser Builder schlank bleibt.
 */
export function createCookingbotMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "cookingbot",
      version: "0.3.0",
      title: "Cookingbot",
    },
    {
      // Wir liefern (vorerst) keine Resources oder Prompts, nur Tools.
      capabilities: {
        tools: { listChanged: false },
      },
      instructions:
        "Cookingbot ist ein familieneigener Speiseplaner. Du kannst über Tools den Wochenplan lesen, einzelne Tagesgerichte tauschen, Rezepte suchen und neue Rezepte aus vorhandenen Zutaten erzeugen. Antworte auf Deutsch und denke an einen 5-jährigen Mitesser: kindertaugliche Gerichte, kein Alkohol, keine reinen Snacks oder Süßspeisen als Abendessen.",
    },
  );
  return server;
}
