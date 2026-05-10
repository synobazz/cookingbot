import { describe, expect, it } from "vitest";
import {
  STAPLE_KEYS,
  aggregateIngredients,
  isStapleKey,
  parseIngredient,
} from "../src/lib/ingredient-parser";

describe("parseIngredient", () => {
  it("parses 'g' quantities", () => {
    const r = parseIngredient("200 g Tomaten");
    expect(r.quantity).toBe(200);
    expect(r.unit).toBe("g");
    expect(r.name).toBe("Tomaten");
  });

  it("parses kg with comma decimals", () => {
    const r = parseIngredient("1,5 kg Kartoffeln");
    expect(r.quantity).toBe(1.5);
    expect(r.unit).toBe("kg");
  });

  it("recognizes EL alias", () => {
    const r = parseIngredient("2 EL Olivenöl");
    expect(r.quantity).toBe(2);
    expect(r.unit).toBe("EL");
    expect(r.name).toBe("Olivenöl");
  });

  it("recognizes Esslöffel as EL", () => {
    const r = parseIngredient("3 Esslöffel Honig");
    expect(r.unit).toBe("EL");
  });

  it("treats unitless count as Stk via empty unit", () => {
    const r = parseIngredient("2 Zwiebeln");
    expect(r.quantity).toBe(2);
    expect(r.unit).toBe("");
    expect(r.name).toBe("Zwiebeln");
  });

  it("strips comma-suffix preparation hints", () => {
    const r = parseIngredient("1 Zwiebel, in Würfeln");
    expect(r.name).toBe("Zwiebel");
  });

  it("parses mixed fraction '1 1/2'", () => {
    const r = parseIngredient("1 1/2 TL Salz");
    expect(r.quantity).toBe(1.5);
    expect(r.unit).toBe("TL");
  });

  it("handles fraction-only", () => {
    const r = parseIngredient("1/2 l Milch");
    expect(r.quantity).toBe(0.5);
    expect(r.unit).toBe("l");
  });

  it("returns null quantity for unparseable lines", () => {
    const r = parseIngredient("Salz nach Geschmack");
    expect(r.quantity).toBeNull();
    expect(r.name.toLowerCase()).toContain("salz");
  });

  it("normalizes diacritics in key", () => {
    const r1 = parseIngredient("200 g Tomaten");
    const r2 = parseIngredient("100 g Tomate");
    expect(r1.key).toBe(r2.key);
  });
});

describe("isStapleKey", () => {
  it("matches direct staples", () => {
    expect(isStapleKey("salz")).toBe(true);
    expect(isStapleKey("pfeffer")).toBe(true);
  });

  it("matches Olivenöl via prefix", () => {
    const r = parseIngredient("2 EL Olivenöl");
    expect(isStapleKey(r.key)).toBe(true);
  });

  it("does not flag tomato as staple", () => {
    const r = parseIngredient("200 g Tomaten");
    expect(isStapleKey(r.key)).toBe(false);
  });

  it("staple set is non-empty", () => {
    expect(STAPLE_KEYS.size).toBeGreaterThan(10);
  });
});

describe("aggregateIngredients", () => {
  it("sums identical ingredients with same unit", () => {
    const result = aggregateIngredients([
      { line: "200 g Tomaten", source: "Pasta" },
      { line: "150 g Tomaten", source: "Salat" },
    ]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].quantity).toBe("350 g");
    expect(result.items[0].sources).toEqual(["Pasta", "Salat"]);
  });

  it("keeps separate units side by side", () => {
    const result = aggregateIngredients([
      { line: "200 g Zwiebeln", source: "A" },
      { line: "2 Zwiebeln", source: "B" },
    ]);
    expect(result.items).toHaveLength(1);
    // Reihenfolge der unit-Map ist Insertion-Order: erst "g", dann ""
    expect(result.items[0].quantity).toBe("200 g + 2");
  });

  it("buckets staples separately", () => {
    const result = aggregateIngredients([
      { line: "200 g Tomaten", source: "Pasta" },
      { line: "1 TL Salz", source: "Pasta" },
      { line: "2 EL Olivenöl", source: "Pasta" },
    ]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe("Tomaten");
    expect(result.staples.length).toBeGreaterThanOrEqual(2);
    const stapleNames = result.staples.map((s) => s.name.toLowerCase()).join(" ");
    expect(stapleNames).toContain("salz");
    expect(stapleNames).toContain("olivenöl");
  });

  it("filters out pantry items", () => {
    const result = aggregateIngredients(
      [
        { line: "200 g Tomaten", source: "Pasta" },
        { line: "1 Zwiebel", source: "Pasta" },
      ],
      new Set(["zwiebel"]),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe("Tomaten");
  });

  it("preserves unparsed quantity hints", () => {
    const result = aggregateIngredients([
      { line: "Salz nach Geschmack", source: "Pasta" },
    ]);
    // Salz ist Staple → in staples
    expect(result.staples).toHaveLength(1);
    expect(result.staples[0].quantity.toLowerCase()).toContain("salz");
  });

  it("ignores empty keys", () => {
    const result = aggregateIngredients([{ line: "   ", source: "X" }]);
    expect(result.items).toHaveLength(0);
    expect(result.staples).toHaveLength(0);
  });
});
