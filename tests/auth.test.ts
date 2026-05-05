import { describe, expect, it, beforeAll } from "vitest";

// Use a strong dev secret so the auth helpers don't fall back to the insecure default.
beforeAll(() => {
  process.env.APP_SESSION_SECRET = "test-secret-please-ignore-1234567890abc";
  process.env.APP_ADMIN_PASSWORD = "test-password-1234567";
});

describe("session token", () => {
  it("round-trips a valid token", async () => {
    const { createSessionToken, isValidSessionToken } = await import("../src/lib/auth");
    const token = createSessionToken();
    expect(isValidSessionToken(token)).toBe(true);
  });

  it("rejects empty/garbage tokens", async () => {
    const { isValidSessionToken } = await import("../src/lib/auth");
    expect(isValidSessionToken(undefined)).toBe(false);
    expect(isValidSessionToken("")).toBe(false);
    expect(isValidSessionToken("a.b")).toBe(false);
  });

  it("rejects tampered tokens", async () => {
    const { createSessionToken, isValidSessionToken } = await import("../src/lib/auth");
    const token = createSessionToken();
    const [head, mac] = token.split(".");
    expect(isValidSessionToken(`${head}xx.${mac}`)).toBe(false);
  });
});

describe("verifyPassword", () => {
  it("matches the configured password", async () => {
    const { verifyPassword } = await import("../src/lib/auth");
    expect(verifyPassword("test-password-1234567")).toBe(true);
    expect(verifyPassword("nope")).toBe(false);
  });
});
