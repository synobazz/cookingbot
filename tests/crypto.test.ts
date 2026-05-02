import { describe, expect, it, beforeAll } from "vitest";

beforeAll(() => {
  process.env.APP_SESSION_SECRET = "test-secret-please-ignore-1234567890abc";
});

describe("encrypt/decrypt", () => {
  it("round-trips a string", async () => {
    const { encrypt, decrypt } = await import("../src/lib/crypto");
    const value = "hello world — Microsoft refresh token sample 🎉";
    const enc = encrypt(value);
    expect(enc).not.toBe(value);
    expect(enc.split(".")).toHaveLength(3);
    expect(decrypt(enc)).toBe(value);
  });

  it("rejects malformed input", async () => {
    const { decrypt } = await import("../src/lib/crypto");
    expect(() => decrypt("not-a-token")).toThrow();
    expect(() => decrypt("a.b")).toThrow();
  });

  it("rejects tampered ciphertexts", async () => {
    const { encrypt, decrypt } = await import("../src/lib/crypto");
    const enc = encrypt("secret");
    const [iv, tag, ciphertext] = enc.split(".");
    const tampered = `${iv}.${tag}.${ciphertext.slice(0, -2)}AA`;
    expect(() => decrypt(tampered)).toThrow();
  });
});
