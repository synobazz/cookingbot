import { addDays, endOfDay, startOfDay } from "date-fns";
import type { MealItem, MealPlan, Recipe } from "@prisma/client";
import { prisma } from "@/lib/db";

export type MealItemWithRecipe = MealItem & { recipe: Recipe | null };
export type MealItemWithPlan = MealItemWithRecipe & { mealPlan: MealPlan };

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
 */
export async function assignRecipeToMealItem(itemId: string, recipeId: string): Promise<MealItem> {
  const [item, recipe] = await Promise.all([
    prisma.mealItem.findUnique({ where: { id: itemId } }),
    prisma.recipe.findUnique({ where: { id: recipeId } }),
  ]);
  if (!item) throw new Error("MealItem nicht gefunden");
  if (!recipe) throw new Error("Rezept nicht gefunden");

  return prisma.mealItem.update({
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
 */
export async function searchRecipes(query: string, limit = 20): Promise<Recipe[]> {
  const q = query.trim();
  if (!q) {
    return prisma.recipe.findMany({
      where: { inTrash: false },
      orderBy: [{ onFavorites: "desc" }, { rating: "desc" }, { updatedAt: "desc" }],
      take: limit,
    });
  }
  return prisma.recipe.findMany({
    where: {
      inTrash: false,
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
