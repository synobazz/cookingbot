import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { exchangeMicrosoftCode, saveMicrosoftConnection } from "@/lib/microsoft";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error_description") || url.searchParams.get("error");
  const store = await cookies();
  const expectedState = store.get("microsoft_oauth_state")?.value;
  store.delete("microsoft_oauth_state");

  if (error) return NextResponse.redirect(new URL(`/shopping?error=${encodeURIComponent(error)}`, req.url), 303);
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/shopping?error=Microsoft%20OAuth%20State%20ung%C3%BCltig", req.url), 303);
  }

  try {
    const token = await exchangeMicrosoftCode(code);
    await saveMicrosoftConnection(token);
    return NextResponse.redirect(new URL("/shopping?microsoft=connected", req.url), 303);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Microsoft Verbindung fehlgeschlagen";
    return NextResponse.redirect(new URL(`/shopping?error=${encodeURIComponent(message)}`, req.url), 303);
  }
}
