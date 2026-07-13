import { describe, expect, it } from "vitest";
import {
  buildPlanningDates,
  calendarDateKey,
  containsUnsafeDinnerText,
  dayLabel,
  defaultDays,
  isUnsafeDinnerRecipe,
  reconcileMealSchedule,
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

describe("calendarDateKey", () => {
  it("keeps the local calendar day instead of converting through UTC", () => {
    expect(calendarDateKey(new Date(2025, 4, 5, 0, 0, 0))).toBe("2025-05-05");
  });
});

describe("reconcileMealSchedule", () => {
  const dates = buildPlanningDates(new Date(2025, 4, 5), ["monday", "wednesday"]);

  it("orders meals by requested day and replaces model-supplied dates", () => {
    const result = reconcileMealSchedule(
      [
        { dayName: "wednesday", date: "2099-01-01", title: "Mittwoch" },
        { dayName: "monday", date: "1999-01-01", title: "Montag" },
      ],
      dates,
    );
    expect(result.map(({ dayName, date, title }) => ({ dayName, date, title }))).toEqual([
      { dayName: "monday", date: "2025-05-05", title: "Montag" },
      { dayName: "wednesday", date: "2025-05-07", title: "Mittwoch" },
    ]);
  });

  it("rejects missing, duplicate, and unknown planning days", () => {
    expect(() => reconcileMealSchedule([{ dayName: "monday", date: "2025-05-05" }], dates)).toThrow();
    expect(() =>
      reconcileMealSchedule(
        [
          { dayName: "monday", date: "2025-05-05" },
          { dayName: "monday", date: "2025-05-06" },
        ],
        dates,
      ),
    ).toThrow(/doppelt/);
    expect(() =>
      reconcileMealSchedule(
        [
          { dayName: "monday", date: "2025-05-05" },
          { dayName: "friday", date: "2025-05-09" },
        ],
        dates,
      ),
    ).toThrow(/wednesday/);
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
