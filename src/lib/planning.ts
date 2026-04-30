import { addDays, format } from "date-fns";
import { Recipe } from "@prisma/client";

export const defaultDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export function seasonForDate(date = new Date()) {
  const month = date.getMonth() + 1;
  if ([12, 1, 2].includes(month)) return "winter";
  if ([3, 4, 5].includes(month)) return "spring";
  if ([6, 7, 8].includes(month)) return "summer";
  return "autumn";
}

export function buildPlanningDates(start: Date, days: string[]) {
  const wanted = new Set(days.map((d) => d.toLowerCase()));
  const dates: { date: Date; dayName: string }[] = [];
  for (let offset = 0; dates.length < days.length && offset < 14; offset++) {
    const date = addDays(start, offset);
    const dayName = format(date, "EEEE").toLowerCase();
    if (wanted.has(dayName)) dates.push({ date, dayName });
  }
  return dates;
}

export function recipeForPrompt(recipe: Recipe) {
  return {
    id: recipe.id,
    paprikaUid: recipe.paprikaUid,
    name: recipe.name,
    rating: recipe.rating,
    categories: safeJson<string[]>(recipe.categoriesJson, []),
    servings: recipe.servings,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    ingredients: recipe.ingredients.slice(0, 1200),
    notes: recipe.notes?.slice(0, 500),
  };
}

export function safeJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function splitIngredients(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.match(/^[A-ZÄÖÜ ]{3,}:?$/));
}
