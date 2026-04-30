import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { microsoftAuthUrl } from "@/lib/microsoft";

export async function POST(req: NextRequest) {
  if (!(await requireAuth())) return NextResponse.redirect(new URL("/login", req.url), 303);
  try {
    const state = randomBytes(24).toString("base64url");
    const store = await cookies();
    store.set("microsoft_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.APP_BASE_URL?.startsWith("https://") ?? process.env.NODE_ENV === "production",
      maxAge: 10 * 60,
      path: "/",
    });
    return NextResponse.redirect(microsoftAuthUrl(state), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Microsoft OAuth konnte nicht gestartet werden";
    return NextResponse.redirect(new URL(`/shopping?error=${encodeURIComponent(message)}`, req.url), 303);
  }
}
