/**
 * Erzeugt ein neues Rezept aus einer Zutatenliste mit Hilfe des LLM und
 * speichert es lokal (origin="local-llm"). Wird vom MCP-Tool
 * `createRecipeFromIngredients` aufgerufen.
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
  constructor(message: string, readonly cause?: unknown) {
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

/**
 * Generiert ein Rezept via LLM ohne es zu persistieren.
 */
export async function generateRecipeFromIngredients(input: {
  ingredients: string[];
  constraint?: string;
}): Promise<GeneratedRecipe> {
  if (input.ingredients.length === 0) {
    throw new RecipeCreationError("Mindestens eine Zutat angeben.");
  }
  const client = getOpenAIClient();

  let raw: string;
  try {
    const response = await client.chat.completions.create({
      model: remixModel(),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            task: "Erstelle ein Abendessen-Rezept aus diesen Zutaten.",
            household: "2 Erwachsene und ein 5-jähriges Kind",
            availableIngredients: input.ingredients,
            constraint: input.constraint || null,
            rules: RULES,
            outputSchema: OUTPUT_SCHEMA_DOC,
          }),
        },
      ],
    });
    raw = response.choices[0]?.message?.content || "{}";
  } catch (error) {
    throw new RecipeCreationError("LLM-Aufruf fehlgeschlagen", error);
  }

  let parsed: GeneratedRecipe;
  try {
    parsed = RecipeSchema.parse(JSON.parse(raw));
  } catch (error) {
    throw new RecipeCreationError("KI-Antwort hatte kein gültiges Schema", error);
  }

  if (
    containsUnsafeDinnerText(
      `${parsed.name} ${parsed.description} ${parsed.ingredients} ${parsed.notes}`,
    )
  ) {
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
}): Promise<Recipe> {
  const generated = await generateRecipeFromIngredients(input);
  const recipe = await prisma.recipe.create({
    data: {
      // paprikaUid bleibt null → kein Konflikt mit Paprika-Sync.
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
