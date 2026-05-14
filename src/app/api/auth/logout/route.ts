import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";
import { appUrl } from "@/lib/redirect";
import { guardSameOrigin } from "@/lib/same-origin";

export async function POST(req: NextRequest) {
  const csrf = guardSameOrigin(req);
  if (csrf) return csrf;
  await clearSessionCookie();
  return NextResponse.redirect(appUrl(req, "/login"), 303);
}
