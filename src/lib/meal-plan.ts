import { addDays, endOfDay, startOfDay } from "date-fns";
import type { MealItem, MealPlan, Prisma, Recipe } from "@prisma/client";
import { prisma } from "@/lib/db";

export type MealItemWithRecipe = MealItem & { recipe: Recipe | null };
export type MealItemWithPlan = MealItemWithRecipe & { mealPlan: MealPlan };

type ReadClient = Pick<Prisma.TransactionClient, "mealItem" | "recipe">;

/**
 * Liefert MealItems im inklusiven Datumsbereich [from, to], sortiert nach Datum aufsteigend.
 * Beide Grenzen werden auf Tagesanfang/-ende normalisiert.
 */
export async function getMealItemsInRange(from: Date, to: Date): Promise<MealItemWithPlan[]> {
  return prisma.mealItem.findMany({
    where: { date: { gte: startOfDay(from), lte: endOfDay(to) } },
    include: { recipe: true, mealPlan: true },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
}

/**
 * Liefert das (jüngste) MealItem für einen konkreten Tag, oder null wenn keiner geplant ist.
 * Wenn an einem Tag mehrere existieren (z. B. doppelter Plan), gewinnt das zuletzt erstellte.
 */
export async function getMealItemForDay(date: Date): Promise<MealItemWithPlan | null> {
  return prisma.mealItem.findFirst({
    where: { date: { gte: startOfDay(date), lte: endOfDay(date) } },
    include: { recipe: true, mealPlan: true },
    orderBy: { createdAt: "desc" },
  });
}

/** Lädt ein einzelnes MealItem mit Rezept und Plan. */
export async function getMealItemById(id: string): Promise<MealItemWithPlan | null> {
  return prisma.mealItem.findUnique({
    where: { id },
    include: { recipe: true, mealPlan: true },
  });
}

/**
 * Weist einem bestehenden MealItem ein konkretes Rezept zu und entfernt etwaige Remix-Inhalte.
 * Wirft wenn das MealItem oder das Rezept nicht existiert.
 *
 * Akzeptiert optional einen Prisma-Transaktions-Client, damit der Aufruf in einer
 * übergeordneten Tx (z. B. zusammen mit einem Backup-Schreibvorgang) laufen kann.
 */
export async function assignRecipeToMealItem(
  itemId: string,
  recipeId: string,
  client: ReadClient & { mealItem: { update: (args: Prisma.MealItemUpdateArgs) => Promise<MealItem> } } = prisma,
): Promise<MealItem> {
  const [item, recipe] = await Promise.all([
    client.mealItem.findUnique({ where: { id: itemId } }),
    client.recipe.findUnique({ where: { id: recipeId } }),
  ]);
  if (!item) throw new Error("MealItem nicht gefunden");
  if (!recipe) throw new Error("Rezept nicht gefunden");

  return client.mealItem.update({
    where: { id: itemId },
    data: {
      title: recipe.name,
      recipeId: recipe.id,
      isRemix: false,
      remixSource: "",
      reasoning: "Manuell zugewiesen.",
      ingredients: "",
      instructions: "",
    },
  });
}

/**
 * Sucht das jüngste passende MealItem für `date` und weist ihm `recipeId` zu.
 * Wenn an dem Tag noch keiner existiert, wird `null` zurückgegeben — Aufrufer entscheiden,
 * ob sie einen neuen Plan erzeugen oder einen Fehler werfen wollen.
 */
export async function setMealForDay(date: Date, recipeId: string): Promise<MealItem | null> {
  const existing = await getMealItemForDay(date);
  if (!existing) return null;
  return assignRecipeToMealItem(existing.id, recipeId);
}

/**
 * Liefert eine kompakte Liste an Recipe-Treffern für eine Volltextsuche über Name, Beschreibung
 * und Zutaten. Begrenzt auf `limit` Treffer (default 20). Excludiert gelöschte Rezepte.
 *
 * `excludeFromPlanning` filtert per Default Rezepte heraus, die der User explizit
 * von der Wochenplanung ausgeschlossen hat — relevant für Tools, die das Ergebnis
 * automatisch einplanen wollen. Reine Lese-Tools können `false` setzen, um auch
 * die ausgeschlossenen Rezepte zu zeigen.
 */
export type SearchRecipesOptions = {
  excludeFromPlanning?: boolean;
};

export async function searchRecipes(
  query: string,
  limit = 20,
  options: SearchRecipesOptions = {},
): Promise<Recipe[]> {
  const q = query.trim();
  const baseFilter: Prisma.RecipeWhereInput = { inTrash: false };
  if (options.excludeFromPlanning !== false) {
    // Default: ausgeschlossene Rezepte herausfiltern, damit `setMealForDay` & Co.
    // nicht versehentlich was Geblocktes auswählen.
    baseFilter.excludeFromPlanning = false;
  }
  if (!q) {
    return prisma.recipe.findMany({
      where: baseFilter,
      orderBy: [{ onFavorites: "desc" }, { rating: "desc" }, { updatedAt: "desc" }],
      take: limit,
    });
  }
  return prisma.recipe.findMany({
    where: {
      ...baseFilter,
      OR: [
        { name: { contains: q } },
        { description: { contains: q } },
        { ingredients: { contains: q } },
      ],
    },
    orderBy: [{ onFavorites: "desc" }, { rating: "desc" }, { updatedAt: "desc" }],
    take: limit,
  });
}

/** Heute + die nächsten N Tage als [from, to] für `getMealItemsInRange`. */
export function todayPlusDays(days: number, base = new Date()): { from: Date; to: Date } {
  return { from: startOfDay(base), to: endOfDay(addDays(base, days)) };
}

/**
 * Sucht das nächste geplante MealItem ab dem gegebenen Datum (inklusiv).
 * Hilfreich für die "an dem Tag ist nichts geplant — der nächste Tag mit Plan ist X"-UX.
 * Limitierung auf 60 Tage in die Zukunft, damit niemals der ganze Index gescannt wird.
 */
export async function getNextPlannedMealItem(from: Date): Promise<MealItemWithPlan | null> {
  const horizon = addDays(from, 60);
  return prisma.mealItem.findFirst({
    where: { date: { gte: startOfDay(from), lte: endOfDay(horizon) } },
    include: { recipe: true, mealPlan: true },
    orderBy: { date: "asc" },
  });
}
