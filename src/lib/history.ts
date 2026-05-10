/**
 * Koch-Historie (Meal-History).
 *
 * Wird vom Planner als Recency-Filter genutzt, damit das LLM nicht
 * dieselben Rezepte zwei Wochen hintereinander ausspielt. Die Historie
 * ist absichtlich entkoppelt vom Plan: ein Plan-Item kann mehrfach
 * gekocht werden (Reste, andere Wochen) und manuell ergänzt werden.
 */
import { prisma } from "@/lib/db";

/** Default-Fenster: 14 Tage Pause, bevor ein Rezept wiederholt werden darf. */
export const DEFAULT_RECENCY_DAYS = 14;

/**
 * Markiert ein Plan-Item als heute gekocht. Bei verlinkten Rezepten
 * wird `recipeId` mitgespeichert, sodass der Recency-Filter greifen kann.
 */
export async function recordCookedFromPlanItem(itemId: string): Promise<void> {
  const item = await prisma.mealItem.findUnique({
    where: { id: itemId },
    select: { id: true, title: true, recipeId: true, isRemix: true },
  });
  if (!item) throw new Error("Gericht nicht gefunden");
  await prisma.mealHistory.create({
    data: {
      title: item.title,
      recipeId: item.recipeId ?? null,
      cookedOn: new Date(),
      source: item.isRemix ? "remix" : item.recipeId ? "plan" : "manual",
    },
  });
}

/**
 * Liefert die Recipe-IDs, die in den letzten `daysBack` Tagen schon einmal
 * gekocht wurden. Wird vom Planner verwendet, um Wiederholungen zu drosseln.
 */
export async function loadRecentlyCookedRecipeIds(
  daysBack: number = DEFAULT_RECENCY_DAYS,
): Promise<Set<string>> {
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const rows = await prisma.mealHistory.findMany({
    where: { cookedOn: { gte: since }, recipeId: { not: null } },
    select: { recipeId: true },
  });
  return new Set(rows.map((r) => r.recipeId).filter((id): id is string => Boolean(id)));
}
