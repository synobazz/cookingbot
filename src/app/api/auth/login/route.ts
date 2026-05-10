import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";
import { appUrl } from "@/lib/redirect";

// 8 Fehlversuche pro Quarter-Hour pro IP/Bucket. Sliding window: jeder
// Fehlversuch schiebt das Window weiter nach hinten, sodass ein Angreifer
// nicht durch geduldetes Warten am Limit vorbeikommt.
const limiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 8 });

export async function POST(req: NextRequest) {
  const key = clientKey(req);
  if (limiter.isLimited(key)) return NextResponse.redirect(appUrl(req, "/login?error=rate_limit"), 303);

  const form = await req.formData();
  const password = String(form.get("password") || "");
  if (!verifyPassword(password)) {
    limiter.recordFailure(key);
    return NextResponse.redirect(appUrl(req, "/login?error=1"), 303);
  }

  limiter.reset(key);
  await setSessionCookie(createSessionToken());
  return NextResponse.redirect(appUrl(req, "/"), 303);
}
