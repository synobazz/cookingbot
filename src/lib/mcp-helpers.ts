/**
 * Hilfsfunktionen für die MCP-Tools.
 *
 * - Deutsche Datums-Parser ("heute", "morgen", "Donnerstag", "2026-05-12")
 * - Kompakte Serializer für Rezepte und Mahlzeiten, damit der LLM-Kontext
 *   nicht durch 10-kB-JSON-Blobs aufgeblasen wird.
 */

import { addDays, format, isValid, parse, startOfDay } from "date-fns";
import type { MealItem, Recipe } from "@prisma/client";
import type { MealItemWithPlan } from "@/lib/meal-plan";

const WEEKDAY_MAP: Record<string, number> = {
  // ISO Wochentag: 1=Mo, 7=So.  date-fns format("i") liefert 1..7.
  montag: 1,
  dienstag: 2,
  mittwoch: 3,
  donnerstag: 4,
  freitag: 5,
  samstag: 6,
  sonntag: 7,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

/**
 * Parst eine deutsche oder englische Datumseingabe in einen Date am Tagesanfang.
 * Akzeptiert ISO (YYYY-MM-DD), "heute"/"today", "morgen"/"tomorrow",
 * "übermorgen"/"day after tomorrow" und Wochentagsnamen.
 *
 * Gibt `null` zurück, wenn nichts erkannt wird.
 */
export function parseGermanDate(input: string, base = new Date()): Date | null {
  const value = input.trim().toLowerCase();
  if (!value) return null;
  const today = startOfDay(base);

  if (/^(heute|today)$/.test(value)) return today;
  if (/^(morgen|tomorrow)$/.test(value)) return addDays(today, 1);
  if (/^(übermorgen|uebermorgen|day after tomorrow)$/.test(value)) return addDays(today, 2);
  if (/^(gestern|yesterday)$/.test(value)) return addDays(today, -1);

  // Wochentag → nächstes Vorkommen ab heute (heute eingeschlossen).
  const targetDow = WEEKDAY_MAP[value];
  if (targetDow) {
    const todayDow = Number(format(today, "i"));
    const offset = (targetDow - todayDow + 7) % 7;
    return addDays(today, offset);
  }

  // ISO-Datum.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = parse(value, "yyyy-MM-dd", new Date());
    return isValid(parsed) ? startOfDay(parsed) : null;
  }

  // Deutsches Format: 12.05.2026 oder 12.5.
  const dotMatch = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})?$/);
  if (dotMatch) {
    const day = Number(dotMatch[1]);
    const month = Number(dotMatch[2]);
    const year = dotMatch[3] ? Number(dotMatch[3]) : today.getFullYear();
    const candidate = new Date(year, month - 1, day);
    return isValid(candidate) ? startOfDay(candidate) : null;
  }

  return null;
}

/** ISO-YYYY-MM-DD-Repräsentation eines Datums (lokale Zone des Servers). */
export function isoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Liefert ein kompaktes Rezept-Objekt für Tool-Antworten. */
export function compactRecipe(recipe: Recipe) {
  return {
    id: recipe.id,
    name: recipe.name,
    description: trimTo(recipe.description, 280),
    rating: recipe.rating,
    servings: recipe.servings || undefined,
    prepTime: recipe.prepTime || undefined,
    cookTime: recipe.cookTime || undefined,
    totalTime: recipe.totalTime || undefined,
    sourceUrl: recipe.sourceUrl || undefined,
    origin: recipe.origin,
    onFavorites: recipe.onFavorites || undefined,
    excludeFromPlanning: recipe.excludeFromPlanning || undefined,
  };
}

/** Liefert ein kompaktes Rezept-Detail mit Zutaten/Anleitung (für Lesetools). */
export function detailedRecipe(recipe: Recipe) {
  return {
    ...compactRecipe(recipe),
    ingredients: recipe.ingredients,
    directions: recipe.directions,
    notes: trimTo(recipe.notes, 600),
  };
}

/** Kompakte Serialisierung eines MealItem (mit Rezept und Plan-Kontext). */
export function compactMealItem(item: MealItemWithPlan | (MealItem & { recipe: Recipe | null })) {
  return {
    id: item.id,
    date: isoDate(item.date),
    dayName: item.dayName,
    title: item.title,
    isRemix: item.isRemix,
    remixSource: item.remixSource || undefined,
    reasoning: trimTo(item.reasoning, 280),
    recipeId: item.recipeId || undefined,
    recipeName: item.recipe?.name,
    // Bei Remixen sind ingredients/instructions die Quelle der Wahrheit, sonst kommen sie vom Rezept.
    ingredients: item.isRemix
      ? item.ingredients
      : item.recipe?.ingredients || item.ingredients || "",
    instructions: item.isRemix
      ? item.instructions
      : item.recipe?.directions || item.instructions || "",
    mealPlanId: "mealPlanId" in item ? item.mealPlanId : undefined,
  };
}

function trimTo(value: string | null | undefined, max: number): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}
