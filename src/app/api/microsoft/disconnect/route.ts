import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { disconnectMicrosoft } from "@/lib/microsoft";

export async function POST(req: NextRequest) {
  if (!(await requireAuth())) return NextResponse.redirect(new URL("/login", req.url), 303);
  await disconnectMicrosoft();
  return NextResponse.redirect(new URL("/shopping?microsoft=disconnected", req.url), 303);
}
