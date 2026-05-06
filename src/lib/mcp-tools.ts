import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { addDays, startOfDay } from "date-fns";
import { z } from "zod";
import {
  getMealItemForDay,
  getMealItemsInRange,
  searchRecipes as searchRecipesFn,
} from "@/lib/meal-plan";
import {
  compactMealItem,
  compactRecipe,
  detailedRecipe,
  isoDate,
  parseGermanDate,
} from "@/lib/mcp-helpers";
import {
  getShoppingListById,
  getShoppingListByMealPlan,
  groupShoppingItems,
  listShoppingLists,
} from "@/lib/shopping";

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
  registerGetMealForDay(server);
  registerGetMealPlan(server);
  registerSearchRecipes(server);
  registerGetShoppingList(server);
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function jsonResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
  };
}

function errorResult(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
  };
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
    async ({ echo }) => jsonResult({ ok: true, pong: echo || "pong", serverTime: new Date().toISOString() }),
  );
}

/* ── getMealForDay ────────────────────────────────────────────────── */

function registerGetMealForDay(server: McpServer): void {
  server.registerTool(
    "getMealForDay",
    {
      title: "Gericht für einen Tag abfragen",
      description:
        "Gibt das geplante Abendessen für einen konkreten Tag zurück, inklusive Rezeptname, Zutaten, Anleitung und Begründung. Akzeptiert deutsche Datumsangaben wie 'heute', 'morgen', 'Donnerstag' oder ISO-Datumsformat (YYYY-MM-DD). Wenn an dem Tag nichts geplant ist, wird ein Hinweis zurückgegeben.",
      inputSchema: {
        date: z
          .string()
          .min(1)
          .describe("Datum in 'heute', 'morgen', Wochentag oder YYYY-MM-DD."),
      },
    },
    async ({ date }) => {
      const target = parseGermanDate(date);
      if (!target) return errorResult(`Datum konnte nicht interpretiert werden: '${date}'`);
      const item = await getMealItemForDay(target);
      if (!item) {
        return jsonResult({
          ok: true,
          date: isoDate(target),
          planned: false,
          message: `Für ${isoDate(target)} ist aktuell kein Gericht geplant.`,
        });
      }
      return jsonResult({
        ok: true,
        date: isoDate(target),
        planned: true,
        meal: compactMealItem(item),
        plan: { id: item.mealPlan.id, title: item.mealPlan.title },
      });
    },
  );
}

/* ── getMealPlan ──────────────────────────────────────────────────── */

function registerGetMealPlan(server: McpServer): void {
  server.registerTool(
    "getMealPlan",
    {
      title: "Wochenplan abfragen",
      description:
        "Liefert die geplanten Abendessen in einem Datumsbereich. Standardmäßig 'die nächsten 7 Tage ab heute'. Beide Datumsgrenzen sind inklusiv und können wie bei getMealForDay angegeben werden.",
      inputSchema: {
        from: z
          .string()
          .optional()
          .describe("Startdatum (inklusiv). Default: heute."),
        to: z
          .string()
          .optional()
          .describe("Enddatum (inklusiv). Default: 6 Tage nach 'from'."),
      },
    },
    async ({ from, to }) => {
      const today = startOfDay(new Date());
      const fromDate = from ? parseGermanDate(from) : today;
      if (!fromDate) return errorResult(`Startdatum konnte nicht interpretiert werden: '${from}'`);
      const toDate = to ? parseGermanDate(to) : addDays(fromDate, 6);
      if (!toDate) return errorResult(`Enddatum konnte nicht interpretiert werden: '${to}'`);
      if (toDate < fromDate) return errorResult("Enddatum darf nicht vor Startdatum liegen.");
      const items = await getMealItemsInRange(fromDate, toDate);
      return jsonResult({
        ok: true,
        from: isoDate(fromDate),
        to: isoDate(toDate),
        count: items.length,
        meals: items.map(compactMealItem),
      });
    },
  );
}

/* ── searchRecipes ────────────────────────────────────────────────── */

function registerSearchRecipes(server: McpServer): void {
  server.registerTool(
    "searchRecipes",
    {
      title: "Rezepte durchsuchen",
      description:
        "Sucht im lokalen Rezeptcache nach passenden Rezepten. Sucht in Name, Beschreibung und Zutaten. Liefert kompakte Treffer (id, Name, Bewertung, Zeiten); Details inkl. Zutaten/Anleitung gibt es über das `detailed`-Flag oder ein nachgelagertes Tool.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .max(120)
          .describe("Suchbegriff, z. B. 'Lasagne', 'Spinat' oder 'Hähnchen Curry'."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Maximale Trefferzahl, default 20."),
        detailed: z
          .boolean()
          .optional()
          .describe(
            "Wenn true, werden auch Zutaten, Anleitung und Notizen geliefert. Default false, um Kontext zu sparen.",
          ),
      },
    },
    async ({ query, limit, detailed }) => {
      const recipes = await searchRecipesFn(query, limit ?? 20);
      return jsonResult({
        ok: true,
        query,
        count: recipes.length,
        recipes: recipes.map((r) => (detailed ? detailedRecipe(r) : compactRecipe(r))),
      });
    },
  );
}

/* ── getShoppingList ──────────────────────────────────────────────── */

function registerGetShoppingList(server: McpServer): void {
  server.registerTool(
    "getShoppingList",
    {
      title: "Einkaufsliste abfragen",
      description:
        "Liefert eine Einkaufsliste, gruppiert nach Kategorie. Ohne Argument wird die zuletzt erstellte Liste zurückgegeben. Optional: 'shoppingListId' für eine konkrete Liste, oder 'mealPlanId' für die Liste eines bestimmten Wochenplans.",
      inputSchema: {
        shoppingListId: z
          .string()
          .optional()
          .describe("ID einer konkreten Einkaufsliste."),
        mealPlanId: z
          .string()
          .optional()
          .describe("ID eines Wochenplans. Liefert die zugehörige Einkaufsliste."),
      },
    },
    async ({ shoppingListId, mealPlanId }) => {
      let list = null;
      if (shoppingListId) {
        list = await getShoppingListById(shoppingListId);
        if (!list) return errorResult(`Einkaufsliste mit id='${shoppingListId}' nicht gefunden.`);
      } else if (mealPlanId) {
        list = await getShoppingListByMealPlan(mealPlanId);
        if (!list) return errorResult(`Keine Einkaufsliste für mealPlanId='${mealPlanId}' gefunden.`);
      } else {
        const recent = await listShoppingLists(1);
        list = recent[0] ?? null;
        if (!list) {
          return jsonResult({ ok: true, message: "Es existieren noch keine Einkaufslisten.", list: null });
        }
      }
      const groups = groupShoppingItems(list.items);
      return jsonResult({
        ok: true,
        list: {
          id: list.id,
          title: list.title,
          mealPlanId: list.mealPlanId,
          microsoftListName: list.microsoftListName || undefined,
          itemCount: list.items.length,
          openCount: list.items.filter((i) => !i.checked).length,
        },
        groups: groups.map((group) => ({
          category: group.category,
          items: group.items.map((item) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity || undefined,
            checked: item.checked,
          })),
        })),
      });
    },
  );
}
