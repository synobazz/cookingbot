import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const password = String(form.get("password") || "");
  if (!verifyPassword(password)) return NextResponse.redirect(new URL("/login?error=1", req.url), 303);
  await setSessionCookie(createSessionToken());
  return NextResponse.redirect(new URL("/", req.url), 303);
}
