import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";
import { appUrl } from "@/lib/redirect";

export async function POST(req: NextRequest) {
  await clearSessionCookie();
  return NextResponse.redirect(appUrl(req, "/login"), 303);
}
