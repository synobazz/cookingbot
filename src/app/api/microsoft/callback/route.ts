import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { exchangeMicrosoftCode, saveMicrosoftConnection } from "@/lib/microsoft";
import { appUrl } from "@/lib/redirect";

export async function GET(req: NextRequest) {
  const url = appUrl(req, req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error_description") || url.searchParams.get("error");
  const store = await cookies();
  const expectedState = store.get("microsoft_oauth_state")?.value;
  store.delete("microsoft_oauth_state");

  if (error) return NextResponse.redirect(appUrl(req, `/shopping?error=${encodeURIComponent(error)}`), 303);
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(appUrl(req, "/shopping?error=Microsoft%20OAuth%20State%20ung%C3%BCltig"), 303);
  }

  try {
    const token = await exchangeMicrosoftCode(code);
    await saveMicrosoftConnection(token);
    return NextResponse.redirect(appUrl(req, "/shopping?microsoft=connected"), 303);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Microsoft Verbindung fehlgeschlagen";
    return NextResponse.redirect(appUrl(req, `/shopping?error=${encodeURIComponent(message)}`), 303);
  }
}
