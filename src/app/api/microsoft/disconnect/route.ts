import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { disconnectMicrosoft } from "@/lib/microsoft";
import { appUrl } from "@/lib/redirect";
import { guardSameOrigin } from "@/lib/same-origin";

export async function POST(req: NextRequest) {
  const csrf = guardSameOrigin(req);
  if (csrf) return csrf;
  if (!(await requireAuth())) return NextResponse.redirect(appUrl(req, "/login"), 303);
  await disconnectMicrosoft();
  return NextResponse.redirect(appUrl(req, "/shopping?microsoft=disconnected"), 303);
}
