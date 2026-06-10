import { cookies } from "next/headers";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { adminPassword, mcpBearerToken, sessionSecret } from "@/lib/env";

/**
 * Session cookie name. When we're on HTTPS we additionally use the
 * `__Host-` prefix variant, which forbids the cookie from carrying a
 * `Domain` attribute and requires `Secure`+`Path=/`. That makes the
 * cookie impossible to forge from a sibling/parent subdomain even if
 * one is ever taken over.
 *
 * On HTTP (dev) we fall back to the plain name so login still works.
 */
const COOKIE_NAME_PLAIN = "cookingbot_session";
const COOKIE_NAME_HOST = "__Host-cookingbot_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function shouldUseSecureCookie() {
  return process.env.APP_BASE_URL?.startsWith("https://") ?? process.env.NODE_ENV === "production";
}

function activeCookieName() {
  return shouldUseSecureCookie() ? COOKIE_NAME_HOST : COOKIE_NAME_PLAIN;
}

/**
 * Constant-time comparison that does not leak the length of the secret
 * by short-circuiting on unequal buffer lengths. We hash both inputs to
 * a fixed 32-byte SHA-256 digest first.
 */
function safeEqual(a: string, b: string) {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

/**
 * Kurzer, nicht umkehrbarer Fingerprint des Admin-Passworts. Fließt in die
 * Session-Signatur ein, damit ein Passwortwechsel alle Sessions invalidiert.
 * 16 Hex-Zeichen reichen: Der Wert ist kein Geheimnis-Ersatz, nur ein
 * Rotations-Anker; die Vertraulichkeit kommt weiterhin aus dem HMAC-Secret.
 */
function passwordFingerprint(): string {
  return createHash("sha256").update(adminPassword()).digest("hex").slice(0, 16);
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret())
    .update(`${payload}.${passwordFingerprint()}`)
    .digest("base64url");
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
  // In secure mode only accept the `__Host-` cookie. On plain HTTP
  // development setups, keep the unprefixed fallback so login still works.
  const token = shouldUseSecureCookie()
    ? store.get(COOKIE_NAME_HOST)?.value
    : (store.get(COOKIE_NAME_HOST)?.value ?? store.get(COOKIE_NAME_PLAIN)?.value);
  return isValidSessionToken(token);
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  const secure = shouldUseSecureCookie();
  store.set(activeCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  // Clear both variants so a stale plain cookie can't outlive an HTTPS rotation.
  store.delete(COOKIE_NAME_PLAIN);
  store.delete(COOKIE_NAME_HOST);
}

export { COOKIE_NAME_PLAIN as COOKIE_NAME };

/* ── MCP Bearer-Auth ─────────────────────────────────────────────── */

export type McpAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; message: string };

/**
 * Prüft den Authorization-Header eines MCP-Requests gegen `MCP_BEARER_TOKEN`
 * mit konstantzeit-Vergleich. Gibt strukturierte Ergebnisse zurück, damit
 * Aufrufer entscheiden können, wie sie antworten (HTTP 401 vs. 503).
 *
 * - 503 wenn `MCP_BEARER_TOKEN` nicht gesetzt ist (MCP-Endpoint deaktiviert).
 * - 401 wenn Header fehlt, falsches Schema hat oder Token nicht passt.
 */
export function verifyMcpBearer(authorizationHeader: string | null | undefined): McpAuthResult {
  const expected = mcpBearerToken();
  if (!expected) {
    return {
      ok: false,
      status: 503,
      message: "MCP server disabled: MCP_BEARER_TOKEN is not configured",
    };
  }
  const header = (authorizationHeader || "").trim();
  if (!header) {
    return { ok: false, status: 401, message: "Missing Authorization header" };
  }
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    return { ok: false, status: 401, message: "Authorization header must use the Bearer scheme" };
  }
  const presented = match[1]!.trim();
  if (presented.length === 0) {
    return { ok: false, status: 401, message: "Empty bearer token" };
  }
  if (!safeEqual(presented, expected)) {
    return { ok: false, status: 401, message: "Invalid bearer token" };
  }
  return { ok: true };
}
