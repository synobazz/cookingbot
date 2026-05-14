import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { microsoftAuthUrl } from "@/lib/microsoft";
import { appUrl } from "@/lib/redirect";
import { guardSameOrigin } from "@/lib/same-origin";

/**
 * Starts the Microsoft OAuth flow.
 *
 * POST-only by design: a GET-initiated OAuth start would let a malicious
 * site embed `<img src="…/microsoft/connect">` and write the OAuth state
 * cookie in a victim's browser. The callback already requires auth, so
 * the worst case is benign, but POST is the right scoping for any
 * state-changing endpoint.
 */
export async function POST(req: NextRequest) {
  const csrf = guardSameOrigin(req);
  if (csrf) return csrf;
  if (!(await requireAuth())) return NextResponse.redirect(appUrl(req, "/login"), 303);
  try {
    const state = randomBytes(24).toString("base64url");
    const store = await cookies();
    const secure =
      process.env.APP_BASE_URL?.startsWith("https://") ?? process.env.NODE_ENV === "production";
    store.set("microsoft_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      maxAge: 10 * 60,
      path: "/",
    });
    return NextResponse.redirect(microsoftAuthUrl(state), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Microsoft OAuth konnte nicht gestartet werden";
    return NextResponse.redirect(appUrl(req, `/shopping?error=${encodeURIComponent(message)}`), 303);
  }
}
