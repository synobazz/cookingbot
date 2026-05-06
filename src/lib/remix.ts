import { z } from "zod";
import type { MealItem, Recipe } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getOpenAIClient, remixModel } from "@/lib/llm";
import {
  containsUnsafeDinnerText,
  isUnsafeDinnerRecipe,
  recipeForPrompt,
} from "@/lib/planning";

const RemixSchema = z.object({
  title: z.string().min(1),
  reasoning: z.string().optional().default(""),
  ingredients: z.string().optional().default(""),
  instructions: z.string().optional().default(""),
});

export type RemixOutput = z.infer<typeof RemixSchema>;

export class RemixError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "RemixError";
  }
}

const SYSTEM_PROMPT =
  "Du bist eine kreative, familienfreundliche Kochhilfe. Antworte ausschließlich als valides JSON. Erzeuge einen kindertauglichen Abendessen-Remix aus dem Quellrezept. Keine alkoholischen Getränke, Cocktails, Drinks, reine Desserts oder Snacks. Keine reinen Fertigprodukt-/Nugget-/Dino-/Convenience-Varianten als Lösung.";

const RULES = [
  "keine alkoholischen Zutaten/Drinks",
  "familien- und kindertauglich",
  "konkrete Zutaten und kurze Kochanleitung liefern",
  "nicht zu experimentell",
  "keine bloßen Fertigprodukte wie Knusperdinos, Nuggets oder Tiefkühl-Snacks als Remix",
];

const OUTPUT_SCHEMA_DOC = {
  title: "string",
  reasoning: "short German reason",
  ingredients: "newline-separated ingredients",
  instructions: "short German instructions",
};

type RemixSource =
  | { kind: "recipe"; recipe: Recipe }
  | { kind: "freeform"; name: string; ingredients: string; instructions: string };

/**
 * Erzeugt einen Remix-Vorschlag via LLM, ohne ihn zu speichern.
 * Wirft `RemixError` bei LLM-Fehlern, Schema-Verstößen oder Sicherheitsfilter-Treffern.
 */
export async function generateRemix(source: RemixSource): Promise<RemixOutput> {
  const client = getOpenAIClient();
  const sourcePayload =
    source.kind === "recipe"
      ? recipeForPrompt(source.recipe)
      : {
          name: source.name,
          ingredients: source.ingredients,
          instructions: source.instructions,
        };

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
            task: "Mach aus diesem Rezept einen coolen, aber realistisch kochbaren Remix fürs Abendessen. Behalte die Grundidee des Originalrezepts erkennbar bei und ändere Würzung, Beilage, Form oder Sauce sinnvoll.",
            household: "2 Erwachsene und ein 5-jähriges Kind",
            rules: RULES,
            outputSchema: OUTPUT_SCHEMA_DOC,
            source: sourcePayload,
          }),
        },
      ],
    });
    raw = response.choices[0]?.message?.content || "{}";
  } catch (error) {
    throw new RemixError("Remix konnte nicht erstellt werden", error);
  }

  let remix: RemixOutput;
  try {
    remix = RemixSchema.parse(JSON.parse(raw));
  } catch (error) {
    throw new RemixError("Die KI-Antwort hatte kein gültiges Schema", error);
  }

  if (containsUnsafeDinnerText(`${remix.title} ${remix.reasoning} ${remix.ingredients}`)) {
    throw new RemixError("Remix wurde blockiert, weil er nicht kindertauglich wirkt");
  }

  return remix;
}

/**
 * Wählt zufällig ein anderes, abendessentaugliches Paprika-Rezept und ersetzt das gegebene MealItem.
 * Wirft, wenn keine Alternative gefunden wird.
 */
export async function replanMealItem(itemId: string): Promise<MealItem> {
  const item = await prisma.mealItem.findUnique({
    where: { id: itemId },
    include: { mealPlan: { include: { items: true } } },
  });
  if (!item) throw new RemixError("Gericht nicht gefunden");

  const usedRecipeIds = new Set(item.mealPlan.items.map((meal) => meal.recipeId).filter(Boolean));
  const candidates = (
    await prisma.recipe.findMany({
      where: { inTrash: false, excludeFromPlanning: false },
      orderBy: [{ onFavorites: "desc" }, { rating: "desc" }, { updatedAt: "desc" }],
      take: 160,
    })
  ).filter(
    (recipe) =>
      !isUnsafeDinnerRecipe(recipe) &&
      recipe.id !== item.recipeId &&
      !usedRecipeIds.has(recipe.id),
  );
  if (!candidates.length) {
    throw new RemixError("Kein alternatives abendessentaugliches Rezept gefunden");
  }
  const pick = candidates[Math.floor(Math.random() * candidates.length)]!;

  return prisma.mealItem.update({
    where: { id: item.id },
    data: {
      title: pick.name,
      recipeId: pick.id,
      isRemix: false,
      remixSource: "",
      reasoning: "Neu geplant: anderes familien- und abendessentaugliches Paprika-Rezept.",
      ingredients: "",
      instructions: "",
    },
  });
}

/**
 * Erzeugt einen Remix für ein bestehendes MealItem und schreibt das Ergebnis in den Datensatz.
 */
export async function remixMealItem(itemId: string): Promise<MealItem> {
  const item = await prisma.mealItem.findUnique({
    where: { id: itemId },
    include: { recipe: true },
  });
  if (!item) throw new RemixError("Gericht nicht gefunden");
  if (!item.recipe && !item.ingredients) {
    throw new RemixError("Für dieses Gericht fehlen Rezeptdaten zum Remixen");
  }

  const remix = await generateRemix(
    item.recipe
      ? { kind: "recipe", recipe: item.recipe }
      : {
          kind: "freeform",
          name: item.title,
          ingredients: item.ingredients,
          instructions: item.instructions,
        },
  );

  return prisma.mealItem.update({
    where: { id: item.id },
    data: {
      title: remix.title,
      recipeId: null,
      isRemix: true,
      remixSource: item.recipe?.name || item.title,
      reasoning: remix.reasoning || `Remix von ${item.recipe?.name || item.title}`,
      ingredients: remix.ingredients,
      instructions: remix.instructions,
    },
  });
}
