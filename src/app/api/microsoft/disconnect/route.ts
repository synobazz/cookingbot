import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { disconnectMicrosoft } from "@/lib/microsoft";
import { appUrl } from "@/lib/redirect";

export async function POST(req: NextRequest) {
  if (!(await requireAuth())) return NextResponse.redirect(appUrl(req, "/login"), 303);
  await disconnectMicrosoft();
  return NextResponse.redirect(appUrl(req, "/shopping?microsoft=disconnected"), 303);
}
