/**
 * MCP-Tool-Registrierung für Cookingbot.
 *
 * Jedes Tool ist eine kleine, zweckgebundene Funktion mit:
 * - klarer deutscher Beschreibung (das LLM-Frontend ist deutsch)
 * - Tool-Annotations (readOnly/destructive/idempotent), damit der Client
 *   weiß, ob er Bestätigung einholen sollte
 * - structured-result-Helfern (`ok`/`fail`) mit stabilen Error-Codes
 * - Schreib-Tools laufen in einer Prisma-Transaktion gemeinsam mit dem
 *   Undo-Backup, damit ein gescheiterter Schreibvorgang nie einen
 *   "halbgaren" Undo-Slot hinterlässt.
 *
 * Tool-Beschreibungen sind absichtlich präzise und enthalten Hinweise,
 * wie das LLM disambiguieren soll (z. B. mehrere Suchtreffer → Rückfrage).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { addDays, startOfDay } from "date-fns";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  assignRecipeToMealItem,
  getMealItemById,
  getMealItemForDay,
  getMealItemsInRange,
  getNextPlannedMealItem,
  searchRecipes as searchRecipesFn,
} from "@/lib/meal-plan";
import {
  compactMealItem,
  compactRecipe,
  detailedRecipe,
  isoDate,
  parseGermanDate,
} from "@/lib/mcp-helpers";
import { fail, ok, type McpToolResult } from "@/lib/mcp-result";
import { listAuditEntries, withAudit } from "@/lib/mcp-audit";
import {
  captureMealItemBackup,
  clearMealItemBackup,
  readMealItemBackup,
  withMealItemBackup,
} from "@/lib/mcp-undo";
import { createRecipeFromIngredients as createRecipeFromIngredientsFn } from "@/lib/recipe-create";
import { replanMealItem } from "@/lib/remix";
import {
  getShoppingListById,
  getShoppingListByMealPlan,
  groupShoppingItems,
  listShoppingLists,
} from "@/lib/shopping";

/**
 * Registriert alle Cookingbot-Tools auf einem frisch erstellten MCP-Server.
 *
 * Implementierungs-Detail: wir wickeln `server.registerTool` lokal so um,
 * dass jeder Callback automatisch durch `withAudit` läuft. So müssen die
 * einzelnen `register…`-Funktionen nichts vom Audit-Log wissen, und es
 * gibt nur einen Punkt, an dem wir Tool-Aufrufe instrumentieren.
 */
export function registerCookingbotTools(server: McpServer): void {
  const originalRegister = server.registerTool.bind(server);
  // Wir wissen nichts über die genaue Generik der SDK-Signatur — der Wrapper
  // fasst Args und Result deshalb breit als `unknown`/Record an, was für die
  // Laufzeit ausreicht (das SDK schickt das Argument unverändert weiter).
  server.registerTool = ((
    name: string,
    config: Parameters<typeof originalRegister>[1],
    cb: Parameters<typeof originalRegister>[2],
  ) => {
    const auditedCb = withAudit(name, cb as (args: unknown) => Promise<McpToolResult>);
    return originalRegister(name, config, auditedCb as typeof cb);
  }) as typeof server.registerTool;

  registerPing(server);
  registerGetMealForDay(server);
  registerGetMealPlan(server);
  registerSearchRecipes(server);
  registerGetShoppingList(server);
  registerFindRecipeByCraving(server);
  registerSetMealForDay(server);
  registerReplaceMealForDay(server);
  registerCreateRecipeFromIngredients(server);
  registerUndoLastMealChange(server);
  registerShowRecentMcpActivity(server);
}

/* ── Ping ─────────────────────────────────────────────────────────── */

function registerPing(server: McpServer): void {
  server.registerTool(
    "ping",
    {
      title: "Verbindungstest",
      description:
        "Antwortet mit 'pong' und der aktuellen Server-Zeit. Nutze dieses Tool zur Diagnose, ob der Cookingbot-MCP-Server erreichbar ist und die Authentifizierung funktioniert.",
      inputSchema: {
        echo: z
          .string()
          .max(200)
          .optional()
          .describe("Optionaler Text, der zurückgespiegelt werden soll."),
      },
      annotations: {
        title: "Verbindungstest",
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ echo }): Promise<McpToolResult> =>
      ok({
        pong: echo || "pong",
        serverTime: new Date().toISOString(),
      }),
  );
}

/* ── getMealForDay ────────────────────────────────────────────────── */

function registerGetMealForDay(server: McpServer): void {
  server.registerTool(
    "getMealForDay",
    {
      title: "Gericht für einen Tag abfragen",
      description:
        "Gibt das geplante Abendessen für einen konkreten Tag zurück, inklusive Rezeptname, Zutaten, Anleitung und Begründung. Akzeptiert deutsche Datumsangaben wie 'heute', 'morgen', 'Donnerstag', 'in 3 Tagen' oder ISO-Datumsformat (YYYY-MM-DD). Hinweis zur Wochentag-Logik: 'Donnerstag' am Donnerstag bedeutet 'nächster Donnerstag' (in einer Woche). Für heute explizit 'heute' verwenden, oder 'diesen Donnerstag'/'am Donnerstag' für den aktuellen Wochentag. Wenn an dem Tag nichts geplant ist, liefert die Antwort einen Hinweis auf den nächsten geplanten Tag.",
      inputSchema: {
        date: z
          .string()
          .min(1)
          .describe("Datum: 'heute', 'morgen', Wochentag, 'in N Tagen' oder YYYY-MM-DD."),
      },
      annotations: {
        title: "Gericht für einen Tag abfragen",
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ date }): Promise<McpToolResult> => {
      const target = parseGermanDate(date);
      if (!target) {
        return fail("INVALID_DATE", `Datum konnte nicht interpretiert werden: '${date}'`, {
          input: date,
        });
      }
      const item = await getMealItemForDay(target);
      if (!item) {
        // Hilfreiche Folge-Information: nächster Tag mit Plan.
        const next = await getNextPlannedMealItem(addDays(target, 1));
        return ok({
          date: isoDate(target),
          planned: false,
          message: `Für ${isoDate(target)} ist aktuell kein Gericht geplant.`,
          ...(next
            ? {
                nextPlannedDate: isoDate(next.date),
                nextPlannedTitle: next.title,
              }
            : {}),
        });
      }
      return ok({
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
        from: z.string().optional().describe("Startdatum (inklusiv). Default: heute."),
        to: z
          .string()
          .optional()
          .describe("Enddatum (inklusiv). Default: 6 Tage nach 'from'."),
      },
      annotations: {
        title: "Wochenplan abfragen",
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ from, to }): Promise<McpToolResult> => {
      const today = startOfDay(new Date());
      const fromDate = from ? parseGermanDate(from) : today;
      if (!fromDate) {
        return fail("INVALID_DATE", `Startdatum konnte nicht interpretiert werden: '${from}'`, {
          input: from,
        });
      }
      const toDate = to ? parseGermanDate(to) : addDays(fromDate, 6);
      if (!toDate) {
        return fail("INVALID_DATE", `Enddatum konnte nicht interpretiert werden: '${to}'`, {
          input: to,
        });
      }
      if (toDate < fromDate) {
        return fail("DATE_RANGE_REVERSED", "Enddatum darf nicht vor Startdatum liegen.", {
          from: isoDate(fromDate),
          to: isoDate(toDate),
        });
      }
      const items = await getMealItemsInRange(fromDate, toDate);
      return ok({
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
        "Sucht im lokalen Rezeptcache nach passenden Rezepten. Sucht in Name, Beschreibung und Zutaten. Liefert kompakte Treffer (id, Name, Bewertung, Zeiten). Mit `detailed: true` werden auch Zutaten/Anleitung mitgeliefert. Mit `includeExcluded: true` werden auch Rezepte gezeigt, die der User von der automatischen Wochenplanung ausgeschlossen hat (Default: ausschließen). Rezepte aus dem Papierkorb werden nie zurückgegeben.",
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
          .describe("Wenn true, mit Zutaten und Anleitung. Default false."),
        includeExcluded: z
          .boolean()
          .optional()
          .describe(
            "Wenn true, auch Rezepte mit `excludeFromPlanning=true` zeigen. Default false.",
          ),
      },
      annotations: {
        title: "Rezepte durchsuchen",
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ query, limit, detailed, includeExcluded }): Promise<McpToolResult> => {
      const recipes = await searchRecipesFn(query, limit ?? 20, {
        excludeFromPlanning: includeExcluded ? false : true,
      });
      return ok({
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
      annotations: {
        title: "Einkaufsliste abfragen",
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ shoppingListId, mealPlanId }): Promise<McpToolResult> => {
      let list = null;
      if (shoppingListId) {
        list = await getShoppingListById(shoppingListId);
        if (!list) {
          return fail(
            "SHOPPING_LIST_NOT_FOUND",
            `Einkaufsliste mit id='${shoppingListId}' nicht gefunden.`,
            { shoppingListId },
          );
        }
      } else if (mealPlanId) {
        list = await getShoppingListByMealPlan(mealPlanId);
        if (!list) {
          return fail(
            "SHOPPING_LIST_NOT_FOUND",
            `Keine Einkaufsliste für mealPlanId='${mealPlanId}' gefunden.`,
            { mealPlanId },
          );
        }
      } else {
        const recent = await listShoppingLists(1);
        list = recent[0] ?? null;
        if (!list) {
          return ok({
            message: "Es existieren noch keine Einkaufslisten.",
            list: null,
          });
        }
      }
      const groups = groupShoppingItems(list.items);
      return ok({
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

/* ── findRecipeByCraving ──────────────────────────────────────────── */

function registerFindRecipeByCraving(server: McpServer): void {
  server.registerTool(
    "findRecipeByCraving",
    {
      title: "Rezept zu einem Heißhunger finden",
      description:
        "Sucht passende Rezepte zu einem freien Beschreibungstext (z. B. 'was Cremiges mit Pasta', 'leichtes Sommergericht', 'Hähnchen scharf'). Liefert die Top-Treffer mit allen Details (Zutaten, Zeiten, Beschreibung), damit das LLM direkt eine Empfehlung formulieren kann. Rezepte mit `excludeFromPlanning` werden ausgeblendet, weil dieses Tool für die Auswahl gedacht ist. Wenn searchRecipes für reine Suche ohne automatischen Plan-Hintergrund reicht, dort suchen.",
      inputSchema: {
        craving: z
          .string()
          .min(2)
          .max(200)
          .describe("Freitext, was der Nutzer essen möchte."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe("Maximale Trefferzahl, default 5."),
      },
      annotations: {
        title: "Rezept zu einem Heißhunger finden",
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ craving, limit }): Promise<McpToolResult> => {
      const recipes = await searchRecipesFn(craving, limit ?? 5);
      return ok({
        craving,
        count: recipes.length,
        recipes: recipes.map(detailedRecipe),
      });
    },
  );
}

/* ── setMealForDay ────────────────────────────────────────────────── */

function registerSetMealForDay(server: McpServer): void {
  server.registerTool(
    "setMealForDay",
    {
      title: "Konkretes Rezept für einen Tag setzen",
      description:
        "Weist dem MealItem an einem konkreten Tag ein bestehendes Rezept zu. Das Rezept kann direkt per `recipeId` oder per Suchbegriff (`recipeQuery`) angegeben werden. Bei `recipeQuery` werden die Top-Treffer geprüft: liefert die Suche **mehrere** plausible Rezepte (mehr als ein Treffer), antwortet das Tool mit einer Mehrdeutigkeits-Liste und nimmt **keine** Änderung vor — der LLM muss dann beim User nachfragen, welches gemeint ist. Speichert vor jeder echten Änderung ein Undo-Backup in einer Transaktion.",
      inputSchema: {
        date: z
          .string()
          .min(1)
          .describe("Tag, an dem das Gericht gesetzt werden soll."),
        recipeId: z.string().optional().describe("ID eines bestehenden Rezepts."),
        recipeQuery: z
          .string()
          .optional()
          .describe(
            "Suchbegriff. Bei mehrdeutigen Treffern wird die Liste zurückgegeben statt automatisch zu wählen.",
          ),
      },
      annotations: {
        title: "Konkretes Rezept für einen Tag setzen",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ date, recipeId, recipeQuery }): Promise<McpToolResult> => {
      if (!recipeId && !recipeQuery) {
        return fail(
          "INVALID_INPUT",
          "Entweder recipeId oder recipeQuery angeben.",
        );
      }
      const target = parseGermanDate(date);
      if (!target) {
        return fail("INVALID_DATE", `Datum konnte nicht interpretiert werden: '${date}'`, {
          input: date,
        });
      }

      let resolvedRecipeId = recipeId;
      if (!resolvedRecipeId && recipeQuery) {
        // Bis zu 5 Treffer holen für Disambiguierung; wenn genau einer da ist, durchwinken.
        const hits = await searchRecipesFn(recipeQuery, 5);
        if (hits.length === 0) {
          return fail("RECIPE_NOT_FOUND", `Keine Rezepte für '${recipeQuery}' gefunden.`, {
            query: recipeQuery,
          });
        }
        if (hits.length > 1) {
          return fail(
            "MULTIPLE_MATCHES",
            `Mehrere Rezepte passen zu '${recipeQuery}'. Bitte mit recipeId aus der candidates-Liste erneut aufrufen.`,
            {
              query: recipeQuery,
              candidates: hits.map(compactRecipe),
            },
          );
        }
        resolvedRecipeId = hits[0].id;
      }

      // Das Ziel-Rezept holen, um es vor dem Schreiben gegen excludeFromPlanning
      // zu prüfen — der User könnte eine `recipeId` direkt liefern, die geblockt ist.
      const targetRecipe = await prisma.recipe.findUnique({
        where: { id: resolvedRecipeId! },
      });
      if (!targetRecipe || targetRecipe.inTrash) {
        return fail(
          "RECIPE_NOT_FOUND",
          `Rezept mit id='${resolvedRecipeId}' nicht gefunden oder im Papierkorb.`,
          { recipeId: resolvedRecipeId },
        );
      }
      if (targetRecipe.excludeFromPlanning) {
        return fail(
          "RECIPE_EXCLUDED",
          `Das Rezept '${targetRecipe.name}' ist von der Wochenplanung ausgeschlossen. Bitte ein anderes wählen oder die Einstellung am Rezept ändern.`,
          { recipeId: targetRecipe.id, recipeName: targetRecipe.name },
        );
      }

      const existing = await getMealItemForDay(target);
      if (!existing) {
        return fail(
          "PLAN_NOT_FOUND",
          `Für ${isoDate(target)} existiert kein Wochenplan-Eintrag. Bitte zuerst einen Plan generieren.`,
          { date: isoDate(target) },
        );
      }

      // Atomar: Backup + Mutation in einer Transaktion.
      try {
        await withMealItemBackup({
          item: existing,
          action: "setMealForDay",
          mutate: (tx) => assignRecipeToMealItem(existing.id, resolvedRecipeId!, tx),
        });
      } catch (error) {
        return fail(
          "INTERNAL_ERROR",
          `Schreibvorgang fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      const fresh = await getMealItemById(existing.id);
      return ok({
        date: isoDate(target),
        action: "setMealForDay",
        meal: fresh ? compactMealItem(fresh) : undefined,
        undoHint: "Rückgängig mit dem Tool 'undoLastMealChange'.",
      });
    },
  );
}

/* ── replaceMealForDay ────────────────────────────────────────────── */

function registerReplaceMealForDay(server: McpServer): void {
  server.registerTool(
    "replaceMealForDay",
    {
      title: "Gericht für einen Tag neu planen",
      description:
        "Wirft das aktuell geplante Gericht für einen Tag weg und lässt den Cookingbot-Planner ein neues Rezept dafür wählen (gleiche Logik wie der 'Neu planen'-Button im UI). Speichert ein Undo-Backup nur bei Erfolg; mit `undoLastMealChange` rückgängig machbar.",
      inputSchema: {
        date: z.string().min(1).describe("Tag, der neu geplant werden soll."),
      },
      annotations: {
        title: "Gericht für einen Tag neu planen",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ date }): Promise<McpToolResult> => {
      const target = parseGermanDate(date);
      if (!target) {
        return fail("INVALID_DATE", `Datum konnte nicht interpretiert werden: '${date}'`, {
          input: date,
        });
      }
      const existing = await getMealItemForDay(target);
      if (!existing) {
        return fail(
          "PLAN_NOT_FOUND",
          `Für ${isoDate(target)} existiert kein Wochenplan-Eintrag.`,
          { date: isoDate(target) },
        );
      }

      // Backup VOR der Mutation schreiben, weil replanMealItem das LLM aufruft
      // und das nicht in einer DB-Transaktion stehen sollte (wäre eine lange Tx).
      // Wenn replanMealItem wirft, verwerfen wir das Backup wieder, sonst würde
      // ein "scheinbar undo-fähiger" Zustand zurückbleiben, der gar nicht
      // angetastet wurde.
      await captureMealItemBackup(existing, "replaceMealForDay");
      try {
        const updated = await replanMealItem(existing.id);
        const fresh = await getMealItemById(updated.id);
        return ok({
          date: isoDate(target),
          action: "replaceMealForDay",
          meal: fresh ? compactMealItem(fresh) : undefined,
          undoHint: "Rückgängig mit dem Tool 'undoLastMealChange'.",
        });
      } catch (error) {
        // Backup zurückrollen, damit der User keinen falschen Undo-Slot hat.
        await clearMealItemBackup().catch(() => undefined);
        return fail(
          "REPLAN_FAILED",
          `Replanung fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );
}

/* ── createRecipeFromIngredients ──────────────────────────────────── */

function registerCreateRecipeFromIngredients(server: McpServer): void {
  server.registerTool(
    "createRecipeFromIngredients",
    {
      title: "Neues Rezept aus Zutaten erstellen",
      description:
        "Lässt das LLM aus einer Liste verfügbarer Zutaten ein konkretes Abendessen-Rezept entwerfen. Das Rezept wird mit `origin='local-llm'` lokal gespeichert (kein Paprika-Sync, paprikaUid bleibt null). Optional kann das neue Rezept direkt einem Tag im Wochenplan zugewiesen werden (`planForDate`); dann läuft die Zuweisung in einer Transaktion mit dem Undo-Backup.",
      inputSchema: {
        ingredients: z
          .array(z.string().min(1))
          .min(1)
          .max(30)
          .describe("Liste der verfügbaren Zutaten, z. B. ['Hähnchenbrust', 'Reis', 'Brokkoli']."),
        constraint: z
          .string()
          .max(120)
          .optional()
          .describe("Optionale Einschränkung wie 'vegetarisch', 'schnell', 'mediterran'."),
        planForDate: z
          .string()
          .optional()
          .describe(
            "Wenn gesetzt, wird das Rezept dem MealItem dieses Tages zugewiesen (Backup in Tx).",
          ),
      },
      annotations: {
        title: "Neues Rezept aus Zutaten erstellen",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ ingredients, constraint, planForDate }): Promise<McpToolResult> => {
      let recipe;
      try {
        recipe = await createRecipeFromIngredientsFn({ ingredients, constraint });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Spezifische Fehlertypen aus dem Service-Layer differenzieren.
        if (message.toLowerCase().includes("kindertauglich")) {
          return fail("RECIPE_BLOCKED_UNSAFE", message);
        }
        if (message.toLowerCase().includes("timeout")) {
          return fail("LLM_TIMEOUT", message);
        }
        return fail("RECIPE_CREATE_FAILED", `Rezept-Erstellung fehlgeschlagen: ${message}`);
      }

      if (!planForDate) {
        return ok({ recipe: detailedRecipe(recipe) });
      }

      const target = parseGermanDate(planForDate);
      if (!target) {
        return ok({
          recipe: detailedRecipe(recipe),
          warning: `Rezept wurde gespeichert, aber Datum '${planForDate}' konnte nicht interpretiert werden.`,
        });
      }
      const existing = await getMealItemForDay(target);
      if (!existing) {
        return ok({
          recipe: detailedRecipe(recipe),
          warning: `Rezept wurde gespeichert, aber für ${isoDate(target)} existiert kein Wochenplan-Eintrag.`,
        });
      }

      try {
        await withMealItemBackup({
          item: existing,
          action: "createRecipeFromIngredients",
          mutate: (tx) => assignRecipeToMealItem(existing.id, recipe.id, tx),
        });
      } catch (error) {
        return ok({
          recipe: detailedRecipe(recipe),
          warning: `Rezept gespeichert, aber Zuweisung schlug fehl: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
      const fresh = await getMealItemById(existing.id);
      return ok({
        recipe: detailedRecipe(recipe),
        plannedFor: isoDate(target),
        meal: fresh ? compactMealItem(fresh) : undefined,
        undoHint: "Zuweisung rückgängig mit 'undoLastMealChange'.",
      });
    },
  );
}

/* ── undoLastMealChange ───────────────────────────────────────────── */

function registerUndoLastMealChange(server: McpServer): void {
  server.registerTool(
    "undoLastMealChange",
    {
      title: "Letzte Plan-Änderung rückgängig machen",
      description:
        "Stellt das MealItem wieder her, das durch den letzten MCP-Schreibzugriff (`setMealForDay`, `replaceMealForDay`, `createRecipeFromIngredients` mit `planForDate`) verändert wurde. Es gibt nur eine Stufe Undo — nach Anwendung wird das Backup gelöscht. Hat der User seitdem weitere Änderungen gemacht, ist nur die letzte rücknehmbar.",
      inputSchema: {},
      annotations: {
        title: "Letzte Plan-Änderung rückgängig machen",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (): Promise<McpToolResult> => {
      const snapshot = await readMealItemBackup();
      if (!snapshot) {
        return ok({
          undone: false,
          message: "Es gibt keine rückgängig-machbare Änderung.",
        });
      }
      const exists = await prisma.mealItem.findUnique({ where: { id: snapshot.item.id } });
      if (!exists) {
        await clearMealItemBackup();
        return fail(
          "MEAL_NOT_FOUND",
          "Das ursprüngliche MealItem existiert nicht mehr; Backup wurde verworfen.",
        );
      }
      await prisma.$transaction(async (tx) => {
        await tx.mealItem.update({
          where: { id: snapshot.item.id },
          data: {
            title: snapshot.item.title,
            recipeId: snapshot.item.recipeId,
            isRemix: snapshot.item.isRemix,
            remixSource: snapshot.item.remixSource,
            reasoning: snapshot.item.reasoning,
            ingredients: snapshot.item.ingredients,
            instructions: snapshot.item.instructions,
          },
        });
        await tx.appSetting.deleteMany({ where: { key: "lastMealItemChange" } });
      });
      const fresh = await getMealItemById(snapshot.item.id);
      return ok({
        undone: true,
        action: snapshot.action,
        capturedAt: snapshot.capturedAt,
        meal: fresh ? compactMealItem(fresh) : undefined,
      });
    },
  );
}

/* ── showRecentMcpActivity ───────────────────────────────────────── */

function registerShowRecentMcpActivity(server: McpServer): void {
  server.registerTool(
    "showRecentMcpActivity",
    {
      title: "Letzte MCP-Tool-Aufrufe anzeigen",
      description:
        "Liefert die letzten N MCP-Tool-Aufrufe (max. 50) aus dem Audit-Ringbuffer. Praktisch zum Debuggen, wenn unklar ist, ob ein vorhergehender Aufruf wirklich erfolgreich war oder welcher Fehlercode zurückkam. Liefert pro Eintrag Tool-Name, Zeitstempel, Dauer in ms, ok-Flag und (bei Fehlern) den Error-Code sowie eine gekürzte Args-Zusammenfassung.",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Wie viele Einträge zurückgegeben werden (default 20, max 50)."),
      },
      annotations: {
        title: "Letzte MCP-Tool-Aufrufe anzeigen",
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ limit }): Promise<McpToolResult> => {
      const entries = await listAuditEntries(limit ?? 20);
      // Reihenfolge: neueste zuerst, damit der Client die letzten Aktionen
      // gleich sieht ohne durchscrollen zu müssen.
      const ordered = [...entries].reverse();
      return ok({
        count: ordered.length,
        entries: ordered,
      });
    },
  );
}
