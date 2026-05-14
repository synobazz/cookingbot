import { NextRequest, NextResponse } from "next/server";
import { appBaseUrl } from "@/lib/env";
import { appUrl } from "@/lib/redirect";

/**
 * Defense-in-depth CSRF check on top of `SameSite=Lax` session cookies.
 *
 * Browsers attach the `Origin` header to all cross-site state-changing
 * requests (POST/PUT/DELETE/PATCH). We compare it to the trusted
 * `APP_BASE_URL` (configured at deploy time) — anything else is rejected.
 *
 * If `Origin` is missing (some legacy proxies strip it on same-origin
 * navigations) we fall back to `Referer`. If both are missing we reject.
 *
 * Returns `true` if the request is same-origin. In dev without
 * `APP_BASE_URL` configured we permit, mirroring the behaviour of
 * `appUrl()` which also falls back permissively in that environment.
 */
export function isSameOrigin(req: NextRequest): boolean {
  const expected = appBaseUrl();
  if (!expected) {
    return process.env.NODE_ENV !== "production";
  }

  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(expected).origin;
  } catch {
    return false;
  }

  const origin = req.headers.get("origin");
  if (origin) {
    return origin === expectedOrigin;
  }

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === expectedOrigin;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Convenience for route handlers: returns `null` if the request is
 * same-origin, otherwise returns a 303 redirect to `/login?error=csrf`.
 *
 * Call at the top of every state-changing handler:
 *
 *   const csrf = guardSameOrigin(req);
 *   if (csrf) return csrf;
 */
export function guardSameOrigin(req: NextRequest): NextResponse | null {
  if (isSameOrigin(req)) return null;
  return NextResponse.redirect(appUrl(req, "/login?error=csrf"), 303);
}
