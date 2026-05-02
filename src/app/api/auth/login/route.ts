import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";
import { appUrl } from "@/lib/redirect";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, { count: number; resetAt: number }>();

function clientKey(req: NextRequest) {
  // Only honour proxy headers when explicitly trusted, otherwise an attacker
  // could spoof X-Forwarded-For per request to dodge the rate limit.
  if (process.env.TRUST_PROXY === "true") {
    const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
    const real = req.headers.get("x-real-ip");
    if (real) return real;
  }
  return "local";
}

function isLimited(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt < now) return false;
  return current.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  current.count += 1;
  // Sliding window: extend the lockout each time so distributed attempts
  // can't keep the window from rolling.
  current.resetAt = now + WINDOW_MS;
}

export async function POST(req: NextRequest) {
  const key = clientKey(req);
  if (isLimited(key)) return NextResponse.redirect(appUrl(req, "/login?error=rate_limit"), 303);

  const form = await req.formData();
  const password = String(form.get("password") || "");
  if (!verifyPassword(password)) {
    recordFailure(key);
    return NextResponse.redirect(appUrl(req, "/login?error=1"), 303);
  }

  attempts.delete(key);
  await setSessionCookie(createSessionToken());
  return NextResponse.redirect(appUrl(req, "/"), 303);
}
