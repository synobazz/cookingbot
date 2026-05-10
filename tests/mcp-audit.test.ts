import { describe, expect, it } from "vitest";
import { _redactSensitive, _summarizeArgs } from "@/lib/mcp-audit";

describe("redactSensitive", () => {
  it("ersetzt Werte unter sensitiven Schlüsseln", () => {
    const input = { user: "alice", password: "geheim123" };
    expect(_redactSensitive(input)).toEqual({ user: "alice", password: "[REDACTED]" });
  });

  it("matcht case-insensitive Substrings", () => {
    const input = { apiKey: "k", apikey: "k", BEARERToken: "t", auth_token: "t" };
    expect(_redactSensitive(input)).toEqual({
      apiKey: "[REDACTED]",
      apikey: "[REDACTED]",
      BEARERToken: "[REDACTED]",
      auth_token: "[REDACTED]",
    });
  });

  it("redaktiert rekursiv in nested Objekten", () => {
    const input = {
      meta: { credential: "x", name: "ok" },
      list: [{ password: "p" }, { other: "fine" }],
    };
    expect(_redactSensitive(input)).toEqual({
      meta: { credential: "[REDACTED]", name: "ok" },
      list: [{ password: "[REDACTED]" }, { other: "fine" }],
    });
  });

  it("lässt nicht-sensitive Strukturen unverändert", () => {
    const input = { ingredients: ["mehl", "wasser"], constraint: "vegetarisch" };
    expect(_redactSensitive(input)).toEqual(input);
  });

  it("erkennt zyklische Referenzen", () => {
    const input: Record<string, unknown> = { name: "x" };
    input.self = input;
    const result = _redactSensitive(input) as Record<string, unknown>;
    expect(result.name).toBe("x");
    expect(result.self).toBe("[CIRCULAR]");
  });

  it("trunkiert tief verschachtelte Strukturen", () => {
    let nested: Record<string, unknown> = { leaf: "ok" };
    for (let i = 0; i < 10; i++) nested = { inner: nested };
    const result = _redactSensitive(nested);
    const json = JSON.stringify(result);
    expect(json).toContain("[TRUNCATED_DEPTH]");
  });

  it("behandelt Primitive korrekt", () => {
    expect(_redactSensitive("foo")).toBe("foo");
    expect(_redactSensitive(42)).toBe(42);
    expect(_redactSensitive(null)).toBe(null);
  });
});

describe("summarizeArgs", () => {
  it("liefert undefined für null/undefined", () => {
    expect(_summarizeArgs(null)).toBeUndefined();
    expect(_summarizeArgs(undefined)).toBeUndefined();
  });

  it("redaktiert vor der Serialisierung", () => {
    const out = _summarizeArgs({ password: "secret", name: "alice" });
    expect(out).toContain("[REDACTED]");
    expect(out).not.toContain("secret");
    expect(out).toContain("alice");
  });

  it("kürzt zu lange Argumente am Ende", () => {
    const long = "x".repeat(2000);
    const out = _summarizeArgs({ note: long });
    expect(out).toBeDefined();
    expect(out!.length).toBeLessThanOrEqual(601); // 600 + ellipsis
    expect(out!.endsWith("…")).toBe(true);
  });
});
