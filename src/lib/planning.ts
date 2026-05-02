import { addDays, format } from "date-fns";
import { Recipe } from "@prisma/client";

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

export function containsUnsafeDinnerText(value: string | null | undefined) {
  const text = normalizeText(value);
  return unsafeDinnerNameTerms.some((term) => text.includes(term));
}

export function isUnsafeDinnerRecipe(recipe: Recipe) {
  const name = normalizeText(recipe.name);
  const categories = safeJson<string[]>(recipe.categoriesJson, []).map(normalizeText);
  const ingredients = normalizeText(recipe.ingredients);
  const notes = normalizeText(recipe.notes || "");
  return (
    containsUnsafeDinnerText(name) ||
    categories.some((category) => unsafeDinnerCategoryTerms.some((term) => category.includes(term))) ||
    unsafeDinnerIngredientTerms.some((term) => ingredients.includes(term) || notes.includes(term))
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
