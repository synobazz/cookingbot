import { describe, expect, it } from "vitest";
import { categorize } from "../src/lib/shopping-categories";

describe("categorize", () => {
  it("puts Reis into Vorrat, not Tiefkühl", () => {
    expect(categorize("Reis")).toBe("Vorrat");
    expect(categorize("Risottoreis")).toBe("Vorrat");
    expect(categorize("Basmati-Reis")).toBe("Vorrat");
  });

  it("still detects real frozen goods", () => {
    expect(categorize("TK-Erbsen")).toBe("Tiefkühl");
    expect(categorize("Vanille-Eis")).toBe("Tiefkühl");
    expect(categorize("Tiefkühlspinat")).toBe("Tiefkühl");
  });

  it("puts tomato paste and canned tomatoes into Vorrat, not Obst & Gemüse", () => {
    expect(categorize("Tomatenmark")).toBe("Vorrat");
    expect(categorize("Passata")).toBe("Vorrat");
    expect(categorize("Gehackte Tomaten")).toBe("Vorrat");
  });

  it("keeps fresh tomatoes in Obst & Gemüse", () => {
    expect(categorize("Kirschtomaten")).toBe("Obst & Gemüse");
    expect(categorize("Tomaten")).toBe("Obst & Gemüse");
  });

  it("puts plant milks into Vorrat, not Milchprodukte", () => {
    expect(categorize("Kokosmilch")).toBe("Vorrat");
    expect(categorize("Hafermilch")).toBe("Vorrat");
    expect(categorize("Mandelmilch")).toBe("Vorrat");
  });

  it("keeps dairy in Milchprodukte", () => {
    expect(categorize("Milch")).toBe("Milchprodukte");
    expect(categorize("Sahne")).toBe("Milchprodukte");
    expect(categorize("Parmesan")).toBe("Milchprodukte");
  });

  it("falls back to Sonstiges", () => {
    expect(categorize("Alufolie")).toBe("Sonstiges");
    expect(categorize(null)).toBe("Sonstiges");
  });
});
