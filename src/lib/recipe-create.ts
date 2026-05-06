/**
 * Erzeugt ein neues Rezept aus einer Zutatenliste mit Hilfe des LLM und
 * speichert es lokal (origin="local-llm"). Wird vom MCP-Tool
 * `createRecipeFromIngredients` aufgerufen.
 *
 * Robustheit:
 * - Hartes Timeout per AbortController (default 45 s), damit ein hängender
 *   LLM-Call nicht die ganze Tool-Antwort blockiert.
 * - Eingabe wird normalisiert (trim, deduplizieren) — das LLM bekommt sauberen
 *   Input und der `containsUnsafeDinnerText`-Filter trifft nicht versehentlich
 *   auf Whitespace-Gulli.
 * - Geblockte Rezepte werden mit Detail-Log zurückgewiesen, damit man im
 *   Container-Log die Trigger-Keywords sieht.
 */
import { z } from "zod";
import type { Recipe } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getOpenAIClient, remixModel } from "@/lib/llm";
import { containsUnsafeDinnerText } from "@/lib/planning";

const RecipeSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  ingredients: z.string().min(1),
  directions: z.string().min(1),
  notes: z.string().optional().default(""),
  servings: z.string().optional().default(""),
  prepTime: z.string().optional().default(""),
  cookTime: z.string().optional().default(""),
  totalTime: z.string().optional().default(""),
});

export type GeneratedRecipe = z.infer<typeof RecipeSchema>;

export class RecipeCreationError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "RecipeCreationError";
  }
}

const SYSTEM_PROMPT =
  "Du bist eine kreative, familienfreundliche Kochhilfe. Antworte ausschließlich als valides JSON. Erstelle ein konkretes Abendessen-Rezept basierend auf den verfügbaren Zutaten. Das Rezept muss kindertauglich sein, keine alkoholischen Getränke oder reinen Snacks/Desserts.";

const RULES = [
  "Verwende möglichst nur die genannten Zutaten plus Standard-Vorrat (Salz, Pfeffer, Öl, Wasser, Zwiebel, Knoblauch).",
  "Wenn ein Constraint angegeben ist (z. B. 'vegetarisch', 'schnell'), halte dich strikt daran.",
  "Liefere klare Mengenangaben in den Zutaten, eine Zeile pro Zutat.",
  "Gib eine kurze, nummerierte Anleitung mit konkreten Schritten.",
  "Familientauglich, keine alkoholischen Zutaten, keine Drinks oder bloße Desserts.",
];

const OUTPUT_SCHEMA_DOC = {
  name: "kurzer prägnanter Name",
  description: "1-2 Sätze, was das Gericht ausmacht",
  ingredients: "newline-separated Zutaten mit Mengen",
  directions: "newline-separated, nummerierte Anleitung",
  notes: "optionale Tipps oder Variationen",
  servings: "z. B. '2-3 Personen'",
  prepTime: "z. B. '15 Min'",
  cookTime: "z. B. '20 Min'",
  totalTime: "z. B. '35 Min'",
};

const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_INGREDIENT_LENGTH = 80;

function normalizeIngredients(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const trimmed = item.trim().slice(0, MAX_INGREDIENT_LENGTH);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

/**
 * Generiert ein Rezept via LLM ohne es zu persistieren. Bricht den Aufruf
 * nach `timeoutMs` ab, damit ein hängender Provider den Tool-Call nicht
 * unbegrenzt offen hält.
 */
export async function generateRecipeFromIngredients(input: {
  ingredients: string[];
  constraint?: string;
  timeoutMs?: number;
}): Promise<GeneratedRecipe> {
  const ingredients = normalizeIngredients(input.ingredients);
  if (ingredients.length === 0) {
    throw new RecipeCreationError("Mindestens eine Zutat angeben.");
  }
  const client = getOpenAIClient();
  const controller = new AbortController();
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  let raw: string;
  try {
    const response = await client.chat.completions.create(
      {
        model: remixModel(),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              task: "Erstelle ein Abendessen-Rezept aus diesen Zutaten.",
              household: "2 Erwachsene und ein 5-jähriges Kind",
              availableIngredients: ingredients,
              constraint: input.constraint?.trim() || null,
              rules: RULES,
              outputSchema: OUTPUT_SCHEMA_DOC,
            }),
          },
        ],
      },
      { signal: controller.signal },
    );
    raw = response.choices[0]?.message?.content || "{}";
  } catch (error) {
    if (controller.signal.aborted) {
      throw new RecipeCreationError(
        `LLM timeout nach ${timeoutMs} ms beim Erzeugen des Rezepts.`,
        error,
      );
    }
    throw new RecipeCreationError("LLM-Aufruf fehlgeschlagen", error);
  } finally {
    clearTimeout(timeoutHandle);
  }

  let parsed: GeneratedRecipe;
  try {
    parsed = RecipeSchema.parse(JSON.parse(raw));
  } catch (error) {
    throw new RecipeCreationError("KI-Antwort hatte kein gültiges Schema", error);
  }

  const safetyCheck = `${parsed.name} ${parsed.description} ${parsed.ingredients} ${parsed.notes}`;
  if (containsUnsafeDinnerText(safetyCheck)) {
    // Container-Log bekommt einen kompakten Hinweis, damit man bei wiederholten
    // Blockaden nachvollziehen kann, was triggert.
    console.warn(
      "[recipe-create] blocked unsafe recipe candidate",
      JSON.stringify({ name: parsed.name, ingredients: ingredients.slice(0, 3) }),
    );
    throw new RecipeCreationError("Rezept wurde als nicht kindertauglich blockiert.");
  }
  return parsed;
}

/**
 * Generiert ein Rezept und speichert es als lokalen Recipe-Datensatz mit origin="local-llm".
 * Liefert das gespeicherte Recipe.
 */
export async function createRecipeFromIngredients(input: {
  ingredients: string[];
  constraint?: string;
  timeoutMs?: number;
}): Promise<Recipe> {
  const generated = await generateRecipeFromIngredients(input);
  const recipe = await prisma.recipe.create({
    data: {
      // Explizit null setzen, damit es lesbar ist und der Paprika-Sync (der
      // paprikaUid-IS-NOT-NULL filtert) das Rezept nie überschreibt.
      paprikaUid: null,
      name: generated.name,
      description: generated.description,
      ingredients: generated.ingredients,
      directions: generated.directions,
      notes: generated.notes,
      servings: generated.servings,
      prepTime: generated.prepTime,
      cookTime: generated.cookTime,
      totalTime: generated.totalTime,
      origin: "local-llm",
      rating: 0,
      onFavorites: false,
      excludeFromPlanning: false,
      inTrash: false,
      source: "",
      sourceUrl: "",
      photoUrl: "",
      hash: "",
    },
  });
  return recipe;
}
