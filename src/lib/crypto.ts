import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { sessionSecret } from "@/lib/env";

/**
 * AES-256-GCM key for at-rest encryption of secrets (Microsoft refresh tokens
 * etc.). Derived from APP_SESSION_SECRET. Rotating that secret will invalidate
 * existing ciphertexts — users will need to reconnect Microsoft. Documented.
 */
function key() {
  return createHash("sha256").update(sessionSecret({ allowDev: true })).digest();
}

export function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decrypt(value: string) {
  const [ivRaw, tagRaw, encryptedRaw] = value.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error("Invalid encrypted value");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
