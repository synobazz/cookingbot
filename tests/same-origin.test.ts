import { describe, expect, it, beforeAll } from "vitest";
import { NextRequest } from "next/server";

beforeAll(() => {
  process.env.APP_BASE_URL = "https://cookingbot.example.com";
});

function makeReq(headers: Record<string, string>) {
  return new NextRequest("https://cookingbot.example.com/api/foo", {
    method: "POST",
    headers,
  });
}

describe("isSameOrigin", () => {
  it("accepts matching Origin header", async () => {
    const { isSameOrigin } = await import("../src/lib/same-origin");
    expect(isSameOrigin(makeReq({ origin: "https://cookingbot.example.com" }))).toBe(true);
  });

  it("rejects mismatching Origin header", async () => {
    const { isSameOrigin } = await import("../src/lib/same-origin");
    expect(isSameOrigin(makeReq({ origin: "https://evil.example" }))).toBe(false);
  });

  it("falls back to Referer when Origin missing", async () => {
    const { isSameOrigin } = await import("../src/lib/same-origin");
    expect(isSameOrigin(makeReq({ referer: "https://cookingbot.example.com/login" }))).toBe(true);
    expect(isSameOrigin(makeReq({ referer: "https://evil.example/page" }))).toBe(false);
  });

  it("rejects when neither header is present", async () => {
    const { isSameOrigin } = await import("../src/lib/same-origin");
    expect(isSameOrigin(makeReq({}))).toBe(false);
  });

  it("guardSameOrigin returns redirect for cross-origin", async () => {
    const { guardSameOrigin } = await import("../src/lib/same-origin");
    const res = guardSameOrigin(makeReq({ origin: "https://evil.example" }));
    expect(res).not.toBeNull();
    expect(res?.status).toBe(303);
    expect(res?.headers.get("location")).toContain("/login?error=csrf");
  });

  it("guardSameOrigin returns null for same-origin", async () => {
    const { guardSameOrigin } = await import("../src/lib/same-origin");
    expect(guardSameOrigin(makeReq({ origin: "https://cookingbot.example.com" }))).toBeNull();
  });
});
