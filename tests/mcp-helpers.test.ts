import { describe, expect, it } from "vitest";
import { isoDate, parseGermanDate } from "../src/lib/mcp-helpers";

// Reference date: Wednesday, 2026-05-06.
// All tests use this fixed base, so weekday-relative parsing is deterministic.
const BASE = new Date(2026, 4, 6); // May 6 2026, Wednesday (Mi)

function iso(d: Date | null) {
  return d ? isoDate(d) : null;
}

describe("parseGermanDate — Schlagworte", () => {
  it("erkennt heute/today", () => {
    expect(iso(parseGermanDate("heute", BASE))).toBe("2026-05-06");
    expect(iso(parseGermanDate("today", BASE))).toBe("2026-05-06");
    expect(iso(parseGermanDate("HEUTE", BASE))).toBe("2026-05-06");
    expect(iso(parseGermanDate("  heute  ", BASE))).toBe("2026-05-06");
  });

  it("erkennt morgen/tomorrow", () => {
    expect(iso(parseGermanDate("morgen", BASE))).toBe("2026-05-07");
    expect(iso(parseGermanDate("tomorrow", BASE))).toBe("2026-05-07");
  });

  it("erkennt übermorgen", () => {
    expect(iso(parseGermanDate("übermorgen", BASE))).toBe("2026-05-08");
    expect(iso(parseGermanDate("uebermorgen", BASE))).toBe("2026-05-08");
  });

  it("erkennt gestern/yesterday", () => {
    expect(iso(parseGermanDate("gestern", BASE))).toBe("2026-05-05");
  });

  it("erkennt 'nächste Woche'", () => {
    expect(iso(parseGermanDate("nächste Woche", BASE))).toBe("2026-05-13");
    expect(iso(parseGermanDate("naechste woche", BASE))).toBe("2026-05-13");
  });
});

describe("parseGermanDate — Wochentage", () => {
  it("BASE ist Mittwoch — 'donnerstag' liefert morgen (offset 1)", () => {
    expect(iso(parseGermanDate("Donnerstag", BASE))).toBe("2026-05-07");
    expect(iso(parseGermanDate("do", BASE))).toBe("2026-05-07");
    expect(iso(parseGermanDate("thursday", BASE))).toBe("2026-05-07");
  });

  it("'Mittwoch' (heutiger Wochentag) liefert nächsten Mittwoch, nicht heute", () => {
    expect(iso(parseGermanDate("Mittwoch", BASE))).toBe("2026-05-13");
    expect(iso(parseGermanDate("mi", BASE))).toBe("2026-05-13");
  });

  it("'diesen Mittwoch' am Mittwoch liefert heute", () => {
    expect(iso(parseGermanDate("diesen Mittwoch", BASE))).toBe("2026-05-06");
    expect(iso(parseGermanDate("dieser Mittwoch", BASE))).toBe("2026-05-06");
  });

  it("'nächsten Donnerstag' liefert kommenden Donnerstag", () => {
    expect(iso(parseGermanDate("nächsten Donnerstag", BASE))).toBe("2026-05-07");
    expect(iso(parseGermanDate("naechsten donnerstag", BASE))).toBe("2026-05-07");
    expect(iso(parseGermanDate("kommenden Donnerstag", BASE))).toBe("2026-05-07");
  });

  it("'am Mittwoch' am Mittwoch liefert heute", () => {
    expect(iso(parseGermanDate("am Mittwoch", BASE))).toBe("2026-05-06");
  });

  it("Wochentag rückwärts: Sonntag bei BASE=Mi → +4 Tage", () => {
    expect(iso(parseGermanDate("Sonntag", BASE))).toBe("2026-05-10");
    expect(iso(parseGermanDate("So", BASE))).toBe("2026-05-10");
  });

  it("Wochentag zur Wochenmitte: Montag bei BASE=Mi → +5 Tage (nächster Mo)", () => {
    expect(iso(parseGermanDate("Montag", BASE))).toBe("2026-05-11");
  });
});

describe("parseGermanDate — Relativ", () => {
  it("'in 3 Tagen'", () => {
    expect(iso(parseGermanDate("in 3 Tagen", BASE))).toBe("2026-05-09");
    expect(iso(parseGermanDate("in 1 Tag", BASE))).toBe("2026-05-07");
    expect(iso(parseGermanDate("in 0 Tagen", BASE))).toBe("2026-05-06");
  });

  it("'vor 2 Tagen'", () => {
    expect(iso(parseGermanDate("vor 2 Tagen", BASE))).toBe("2026-05-04");
  });

  it("ablehnt unrealistische Werte", () => {
    expect(parseGermanDate("in 9999 Tagen", BASE)).toBe(null);
  });
});

describe("parseGermanDate — ISO und deutsches Datum", () => {
  it("akzeptiert ISO YYYY-MM-DD", () => {
    expect(iso(parseGermanDate("2026-12-24", BASE))).toBe("2026-12-24");
    expect(iso(parseGermanDate("2027-01-01", BASE))).toBe("2027-01-01");
  });

  it("ablehnt ungültige ISO-Daten", () => {
    expect(parseGermanDate("2026-13-01", BASE)).toBe(null);
    expect(parseGermanDate("2026-02-30", BASE)).toBe(null);
  });

  it("akzeptiert 12.05.2026", () => {
    expect(iso(parseGermanDate("12.05.2026", BASE))).toBe("2026-05-12");
    expect(iso(parseGermanDate("1.5.2026", BASE))).toBe("2026-05-01");
  });

  it("ergänzt Jahr aus base bei 12.5. ohne Jahr", () => {
    expect(iso(parseGermanDate("12.5.", BASE))).toBe("2026-05-12");
    expect(iso(parseGermanDate("12.5", BASE))).toBe("2026-05-12");
  });

  it("ablehnt unmögliche Tage wie 31.02.", () => {
    expect(parseGermanDate("31.02.2026", BASE)).toBe(null);
    expect(parseGermanDate("32.05.2026", BASE)).toBe(null);
    expect(parseGermanDate("12.13.2026", BASE)).toBe(null);
  });
});

describe("parseGermanDate — Edge Cases", () => {
  it("liefert null bei Müll", () => {
    expect(parseGermanDate("", BASE)).toBe(null);
    expect(parseGermanDate("   ", BASE)).toBe(null);
    expect(parseGermanDate("xyz", BASE)).toBe(null);
    expect(parseGermanDate("schlauchboot", BASE)).toBe(null);
  });

  it("ist case-insensitive", () => {
    expect(iso(parseGermanDate("DONNERSTAG", BASE))).toBe("2026-05-07");
    expect(iso(parseGermanDate("HeUtE", BASE))).toBe("2026-05-06");
  });
});
