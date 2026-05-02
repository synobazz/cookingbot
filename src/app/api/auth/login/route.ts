import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, { count: number; resetAt: number }>();

function redirectUrl(req: NextRequest, path: string) {
  const base = process.env.APP_BASE_URL || req.url;
  return new URL(path, base);
}

function clientKey(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "local";
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
}

export async function POST(req: NextRequest) {
  const key = clientKey(req);
  if (isLimited(key)) return NextResponse.redirect(redirectUrl(req, "/login?error=rate_limit"), 303);

  const form = await req.formData();
  const password = String(form.get("password") || "");
  if (!verifyPassword(password)) {
    recordFailure(key);
    return NextResponse.redirect(redirectUrl(req, "/login?error=1"), 303);
  }

  attempts.delete(key);
  await setSessionCookie(createSessionToken());
  return NextResponse.redirect(redirectUrl(req, "/"), 303);
}
