import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { adminPassword, sessionSecret } from "@/lib/env";

const COOKIE_NAME = "cookingbot_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function shouldUseSecureCookie() {
  return process.env.APP_BASE_URL?.startsWith("https://") ?? process.env.NODE_ENV === "production";
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function verifyPassword(password: string) {
  return safeEqual(password, adminPassword());
}

export function createSessionToken() {
  const payload = JSON.stringify({ sub: "admin", exp: Date.now() + MAX_AGE_SECONDS * 1000 });
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function isValidSessionToken(token?: string) {
  if (!token) return false;
  const [encoded, mac] = token.split(".");
  if (!encoded || !mac || !safeEqual(sign(encoded), mac)) return false;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return payload.sub === "admin" && typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export async function requireAuth() {
  const store = await cookies();
  return isValidSessionToken(store.get(COOKIE_NAME)?.value);
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(),
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export { COOKIE_NAME };
