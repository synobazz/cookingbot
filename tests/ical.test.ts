import { describe, expect, it } from "vitest";
import { buildIcs, escapeIcsText, foldLine } from "../src/lib/ical";

describe("escapeIcsText", () => {
  it("escapes backslash, comma, semicolon, newline", () => {
    expect(escapeIcsText("a, b; c\\d\ne")).toBe("a\\, b\\; c\\\\d\\ne");
  });

  it("normalizes CRLF to escaped \\n", () => {
    expect(escapeIcsText("line1\r\nline2")).toBe("line1\\nline2");
  });
});

describe("foldLine", () => {
  it("leaves short lines untouched", () => {
    expect(foldLine("short")).toBe("short");
  });

  it("folds long lines with CRLF + space", () => {
    const long = "X".repeat(200);
    const folded = foldLine(long);
    expect(folded).toContain("\r\n ");
    // Jeder physische Chunk darf max. 75 Bytes sein; Continuation-Lines
    // enthalten im echten iCal zusätzlich das führende Leerzeichen.
    folded.split("\r\n ").forEach((chunk, index) => {
      const continuationPrefix = index === 0 ? 0 : 1;
      expect(Buffer.byteLength(chunk, "utf8") + continuationPrefix).toBeLessThanOrEqual(75);
    });
  });

  it("does not split multi-byte characters while folding", () => {
    const long = `SUMMARY:${"Äpfel 🍎 ".repeat(30)}`;
    const folded = foldLine(long);
    expect(folded).not.toContain("�");
    expect(folded.replace(/\r\n /g, "")).toBe(long);
  });
});

describe("buildIcs", () => {
  it("emits a valid VCALENDAR envelope with CRLF endings", () => {
    const ics = buildIcs(
      [
        {
          uid: "evt-1",
          date: new Date("2025-05-12T00:00:00"),
          summary: "Pasta mit Tomaten",
          description: "Reasoning: schnell\nZutaten: ...",
        },
      ],
      "cookingbot.example.com",
    );
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics).toContain("PRODID:-//cookingbot//meal-plan//DE");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toMatch(/END:VCALENDAR\r\n$/);
  });

  it("emits all-day events with DTSTART;VALUE=DATE and exclusive DTEND", () => {
    const ics = buildIcs(
      [{ uid: "u", date: new Date("2025-05-12T00:00:00"), summary: "X" }],
      "h",
    );
    expect(ics).toContain("DTSTART;VALUE=DATE:20250512");
    expect(ics).toContain("DTEND;VALUE=DATE:20250513");
  });

  it("escapes summary text correctly", () => {
    const ics = buildIcs(
      [{ uid: "u", date: new Date("2025-05-12T00:00:00"), summary: "Pasta, mit Salz; mhm" }],
      "h",
    );
    expect(ics).toContain("SUMMARY:Pasta\\, mit Salz\\; mhm");
  });

  it("appends hostname to UID", () => {
    const ics = buildIcs(
      [{ uid: "abc", date: new Date("2025-05-12T00:00:00"), summary: "X" }],
      "cookingbot.test",
    );
    expect(ics).toContain("UID:abc@cookingbot.test");
  });
});
