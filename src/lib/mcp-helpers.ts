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
  mo: 1,
  mon: 1,
  dienstag: 2,
  di: 2,
  die: 2,
  tue: 2,
  mittwoch: 3,
  mi: 3,
  mit: 3,
  wed: 3,
  donnerstag: 4,
  do: 4,
  don: 4,
  thu: 4,
  freitag: 5,
  fr: 5,
  fre: 5,
  fri: 5,
  samstag: 6,
  sa: 6,
  sam: 6,
  sat: 6,
  sonntag: 7,
  so: 7,
  son: 7,
  sun: 7,
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
 *
 * Akzeptiert:
 * - Schlagworte: heute/today, morgen/tomorrow, übermorgen, gestern/yesterday
 * - Wochentage (lang/kurz): "Donnerstag", "Do", "Mi", "Fri"
 *   - Wenn der Wochentag heute ist, wird **die nächste Woche** zurückgegeben,
 *     weil "Donnerstag" am Donnerstag normalerweise "nächsten Donnerstag" meint.
 *     Für "heute" soll der User explizit "heute" sagen.
 * - Modifier vor Wochentag: "diesen Mittwoch", "nächsten Mittwoch", "kommenden Mittwoch"
 *   - "diesen X": gleicher Wochentag → heute, sonst die kommende Vorkommen
 *   - "nächsten X" / "kommenden X": immer die nächste Vorkommen, niemals heute
 * - Relativ: "in 3 Tagen", "vor 2 Tagen"
 * - "nächste Woche" → +7 Tage
 * - ISO YYYY-MM-DD
 * - Deutsches Format: 12.05.2026 oder 12.5. (ohne Jahr → aktuelles Jahr)
 *
 * Gibt `null` zurück, wenn nichts erkannt wird.
 */
export function parseGermanDate(input: string, base = new Date()): Date | null {
  // Normalisierung: Whitespace zusammenfassen, niedrige Buchstaben.
  const value = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (!value) return null;
  const today = startOfDay(base);

  // Schlagworte.
  if (value === "heute" || value === "today") return today;
  if (value === "morgen" || value === "tomorrow") return addDays(today, 1);
  if (value === "übermorgen" || value === "uebermorgen" || value === "day after tomorrow") {
    return addDays(today, 2);
  }
  if (value === "gestern" || value === "yesterday") return addDays(today, -1);
  if (value === "nächste woche" || value === "naechste woche" || value === "next week") {
    return addDays(today, 7);
  }

  // Relative: "in 3 tagen", "vor 2 tagen".
  const relIn = value.match(/^in\s+(\d+)\s+(tag|tagen|days?)$/);
  if (relIn) {
    const n = Number(relIn[1]);
    if (Number.isFinite(n) && n >= 0 && n <= 365) return addDays(today, n);
  }
  const relAgo = value.match(/^vor\s+(\d+)\s+(tag|tagen)$/);
  if (relAgo) {
    const n = Number(relAgo[1]);
    if (Number.isFinite(n) && n >= 0 && n <= 365) return addDays(today, -n);
  }

  // Wochentag mit optionalem Modifier.
  // "diesen donnerstag" → heute wenn Donnerstag, sonst nächste Vorkommen.
  // "nächsten donnerstag" → niemals heute, immer mind. +1 Vorkommen.
  // "donnerstag" → wenn heute Donnerstag, dann +7. Sonst nächste Vorkommen.
  const dowMatch = value.match(
    /^(?:(diesen|diese|dieser|nächsten|naechsten|nächste|naechste|kommenden|kommende|am)\s+)?([a-zäö]+)$/,
  );
  if (dowMatch) {
    const modifier = dowMatch[1] || "";
    const dowKey = dowMatch[2];
    const targetDow = WEEKDAY_MAP[dowKey];
    if (targetDow) {
      const todayDow = Number(format(today, "i"));
      const offset = (targetDow - todayDow + 7) % 7;
      const isThisWeek =
        modifier === "diesen" || modifier === "diese" || modifier === "dieser" || modifier === "am";
      const isNextWeek =
        modifier === "nächsten" ||
        modifier === "naechsten" ||
        modifier === "nächste" ||
        modifier === "naechste" ||
        modifier === "kommenden" ||
        modifier === "kommende";

      if (offset === 0) {
        // Heute ist der gefragte Wochentag.
        if (isThisWeek) return today;
        // "donnerstag" oder "nächsten donnerstag" am Donnerstag → +7.
        return addDays(today, 7);
      }
      if (isNextWeek) {
        // Wenn der nächste Vorkommen schon innerhalb der nächsten 6 Tage liegt,
        // ist das gemeint; "nächsten" verlangt nicht zwingend +7 nach dem Vorkommen.
        return addDays(today, offset);
      }
      return addDays(today, offset);
    }
  }

  // ISO-Datum YYYY-MM-DD.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = parse(value, "yyyy-MM-dd", new Date());
    return isValid(parsed) ? startOfDay(parsed) : null;
  }

  // Deutsches Format: 12.05.2026 oder 12.5. (ohne Jahr → aktuelles Jahr).
  const dotMatch = value.match(/^(\d{1,2})\.(\d{1,2})\.?(\d{4})?$/);
  if (dotMatch) {
    const day = Number(dotMatch[1]);
    const month = Number(dotMatch[2]);
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    const year = dotMatch[3] ? Number(dotMatch[3]) : today.getFullYear();
    const candidate = new Date(year, month - 1, day);
    // Strenge Validierung: bei z. B. 31.02. produziert new Date 03.03.,
    // also nochmal abgleichen.
    if (
      candidate.getFullYear() !== year ||
      candidate.getMonth() !== month - 1 ||
      candidate.getDate() !== day
    ) {
      return null;
    }
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
