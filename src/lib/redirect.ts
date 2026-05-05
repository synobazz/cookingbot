import { NextRequest } from "next/server";

/**
 * Build an absolute redirect URL.
 *
 * Falls back to `req.url` only when APP_BASE_URL is unset *and* we’re not in
 * production — in production we hard-require the env var so an attacker can’t
 * influence the redirect target via Host/X-Forwarded-Host headers.
 */
export function appUrl(req: NextRequest, path: string) {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) return new URL(path, configured);
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_BASE_URL must be configured in production");
  }
  return new URL(path, req.url);
}
