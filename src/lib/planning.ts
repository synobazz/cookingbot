import { addDays, format } from "date-fns";
import { Recipe } from "@prisma/client";

export type PlanningDate = { date: Date; dayName: string };

/** Formatiert ein Date als lokalen Kalendertag, ohne UTC-Konvertierung. */
export function calendarDateKey(date: Date) {
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export const defaultDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const seasonMap = {
  winter: "Winter",
  spring: "Frühling",
  summer: "Sommer",
  autumn: "Herbst",
} as const;

const dayMap: Record<string, string> = {
  monday: "Montag",
  tuesday: "Dienstag",
  wednesday: "Mittwoch",
  thursday: "Donnerstag",
  friday: "Freitag",
  saturday: "Samstag",
  sunday: "Sonntag",
  today: "Heute",
  heute: "Heute",
};

export function seasonForDate(date = new Date()) {
  const month = date.getMonth() + 1;
  if ([12, 1, 2].includes(month)) return "winter";
  if ([3, 4, 5].includes(month)) return "spring";
  if ([6, 7, 8].includes(month)) return "summer";
  return "autumn";
}

export function seasonLabel(date = new Date()) {
  return seasonMap[seasonForDate(date)];
}

export function dayLabel(day: string) {
  return dayMap[day.toLowerCase()] || day;
}

export function buildPlanningDates(start: Date, days: string[]): PlanningDate[] {
  const wanted = new Set(days.map((d) => d.toLowerCase()));
  const dates: { date: Date; dayName: string }[] = [];
  for (let offset = 0; dates.length < days.length && offset < 14; offset++) {
    const date = addDays(start, offset);
    const dayName = format(date, "EEEE").toLowerCase();
    if (wanted.has(dayName)) dates.push({ date, dayName });
  }
  return dates;
}

/**
 * Bindet die LLM-Antwort wieder an den deterministisch berechneten Kalender.
 * Das Modell darf Inhalt vorschlagen, aber weder Tage erfinden noch Datumswerte
 * verschieben. Fehlende, doppelte oder unbekannte Tage werden abgewiesen.
 */
export function reconcileMealSchedule<T extends { dayName: string; date: string }>(
  meals: T[],
  planningDates: PlanningDate[],
): T[] {
  if (meals.length !== planningDates.length) {
    throw new Error("Die Anzahl der Mahlzeiten passt nicht zu den angeforderten Tagen.");
  }

  const byDay = new Map<string, T>();
  for (const meal of meals) {
    const dayName = meal.dayName.toLowerCase();
    if (byDay.has(dayName)) throw new Error(`Der Tag ${dayName} wurde doppelt geplant.`);
    byDay.set(dayName, meal);
  }

  return planningDates.map(({ date, dayName }) => {
    const meal = byDay.get(dayName);
    if (!meal) throw new Error(`Für ${dayName} fehlt eine Mahlzeit.`);
    return { ...meal, dayName, date: calendarDateKey(date) };
  });
}

const unsafeDinnerNameTerms = [
  "hotbull", "hot bull", "cocktail", "drink", "shot", "longdrink", "bowle", "punsch", "glühwein",
  "aperol", "campari", "gin", "rum", "vodka", "wodka", "tequila", "whisky", "whiskey", "likör",
  "prosecco", "sekt", "bier", "weinschorle", "sangria", "mojito", "caipirinha", "margarita",
];

const unsafeDinnerCategoryTerms = ["getränk", "getraenk", "cocktail", "drinks", "drink", "bar", "alkohol", "aperitif"];
const unsafeDinnerIngredientTerms = ["vodka", "wodka", "rum", "gin", "tequila", "whisky", "whiskey", "likör", "aperol", "campari", "prosecco", "sekt"];

function normalizeText(value: string | null | undefined) {
  return (value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsWholeTerm(text: string, term: string) {
  const normalizedTerm = normalizeText(term).trim();
  if (!normalizedTerm) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(normalizedTerm)}([^a-z0-9]|$)`, "i").test(text);
}

export function containsUnsafeDinnerText(value: string | null | undefined) {
  const text = normalizeText(value);
  return unsafeDinnerNameTerms.some((term) => containsWholeTerm(text, term));
}

export function isUnsafeDinnerRecipe(recipe: Recipe) {
  const name = normalizeText(recipe.name);
  const categories = safeJson<string[]>(recipe.categoriesJson, []).map(normalizeText);
  const ingredients = normalizeText(recipe.ingredients);
  const notes = normalizeText(recipe.notes || "");
  return (
    containsUnsafeDinnerText(name) ||
    categories.some((category) => unsafeDinnerCategoryTerms.some((term) => containsWholeTerm(category, term))) ||
    unsafeDinnerIngredientTerms.some((term) => containsWholeTerm(ingredients, term) || containsWholeTerm(notes, term))
  );
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

export function displayCategories(categories: string[]) {
  return categories.filter((category) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:-\d+-\d+)?$/i.test(category));
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
