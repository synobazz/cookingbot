import { describe, expect, it } from "vitest";
import {
  buildPlanningDates,
  containsUnsafeDinnerText,
  dayLabel,
  defaultDays,
  isUnsafeDinnerRecipe,
  safeJson,
  seasonForDate,
  splitIngredients,
} from "../src/lib/planning";

describe("seasonForDate", () => {
  it("maps months to seasons", () => {
    expect(seasonForDate(new Date("2025-01-15"))).toBe("winter");
    expect(seasonForDate(new Date("2025-04-15"))).toBe("spring");
    expect(seasonForDate(new Date("2025-07-15"))).toBe("summer");
    expect(seasonForDate(new Date("2025-10-15"))).toBe("autumn");
  });
});

describe("dayLabel", () => {
  it("translates known days", () => {
    expect(dayLabel("monday")).toBe("Montag");
    expect(dayLabel("MONDAY")).toBe("Montag");
    expect(dayLabel("today")).toBe("Heute");
  });
  it("falls back to input for unknown", () => {
    expect(dayLabel("sometime")).toBe("sometime");
  });
});

describe("buildPlanningDates", () => {
  it("builds the requested days starting at start", () => {
    // 2025-05-05 is a Monday
    const result = buildPlanningDates(new Date("2025-05-05T00:00:00Z"), ["monday", "wednesday", "friday"]);
    expect(result).toHaveLength(3);
    expect(result[0].dayName).toBe("monday");
    expect(result[1].dayName).toBe("wednesday");
    expect(result[2].dayName).toBe("friday");
  });

  it("contains all 7 days when defaultDays is passed", () => {
    const result = buildPlanningDates(new Date("2025-05-05T00:00:00Z"), defaultDays);
    expect(result).toHaveLength(7);
  });
});

describe("containsUnsafeDinnerText", () => {
  it("flags cocktail-ish names", () => {
    expect(containsUnsafeDinnerText("Caipirinha mit Limette")).toBe(true);
    expect(containsUnsafeDinnerText("Linseneintopf")).toBe(false);
    expect(containsUnsafeDinnerText("")).toBe(false);
    expect(containsUnsafeDinnerText(null)).toBe(false);
  });
});

describe("isUnsafeDinnerRecipe", () => {
  const base = {
    id: "x",
    paprikaUid: "u",
    hash: null,
    name: "",
    description: "",
    ingredients: "",
    directions: "",
    notes: "",
    servings: "",
    prepTime: "",
    cookTime: "",
    totalTime: "",
    difficulty: "",
    rating: 0,
    categoriesJson: "[]",
    source: "",
    sourceUrl: "",
    imageUrl: "",
    photo: "",
    photoLarge: "",
    photoHash: "",
    photoUrl: "",
    excludeFromPlanning: false,
    inTrash: false,
    onFavorites: false,
    lastSyncedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Parameters<typeof isUnsafeDinnerRecipe>[0];

  it("flags by name", () => {
    expect(isUnsafeDinnerRecipe({ ...base, name: "Aperol Spritz" })).toBe(true);
  });

  it("flags by category", () => {
    expect(
      isUnsafeDinnerRecipe({ ...base, name: "Punch", categoriesJson: JSON.stringify(["Cocktail"]) }),
    ).toBe(true);
  });

  it("flags by alcoholic ingredients", () => {
    expect(isUnsafeDinnerRecipe({ ...base, name: "Mystery", ingredients: "200ml Rum\nZucker" })).toBe(true);
  });

  it("does not flag a normal recipe", () => {
    expect(isUnsafeDinnerRecipe({ ...base, name: "Linsensuppe", ingredients: "Linsen\nKarotten" })).toBe(false);
  });
});

describe("safeJson", () => {
  it("parses valid json", () => {
    expect(safeJson<string[]>('["a","b"]', [])).toEqual(["a", "b"]);
  });
  it("returns fallback on invalid", () => {
    expect(safeJson("nope", "fallback")).toBe("fallback");
    expect(safeJson(null, "f")).toBe("f");
    expect(safeJson(undefined, "f")).toBe("f");
  });
});

describe("splitIngredients", () => {
  it("splits and trims", () => {
    expect(splitIngredients("100g Nudeln\n  Salz\n\n2 EL Öl")).toEqual(["100g Nudeln", "Salz", "2 EL Öl"]);
  });

  it("drops section headers", () => {
    expect(splitIngredients("FÜR DIE SAUCE:\n100ml Sahne\n50g Käse")).toEqual(["100ml Sahne", "50g Käse"]);
  });
});
