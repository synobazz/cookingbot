import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "node:crypto";
import { requireAuth } from "@/lib/auth";
import { runHealthChecks } from "@/lib/health";

export const dynamic = "force-dynamic";

function tokenMatches(presented: string, expected: string) {
  const a = createHash("sha256").update(presented).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Healthcheck-Endpoint für externe Monitoring-Tools und Docker HEALTHCHECK.
 *
 * Auth-Matrix:
 *   - Anonym → minimaler Body `{status, generatedAt}` mit 200/503. Genug
 *     für Docker's HEALTHCHECK und einen Uptime-Pinger, ohne irgendwelche
 *     Service-Details preiszugeben.
 *   - Authentifizierter Browser-Aufruf, korrektes `HEALTH_PUBLIC_TOKEN`
 *     (Bearer oder `?token=`), oder `HEALTH_DETAILS_PUBLIC=true`
 *     → voller Report mit Check-Aufschlüsselung.
 */
export async function GET(req: NextRequest) {
  const report = await runHealthChecks();
  const httpStatus = report.status === "ok" ? 200 : 503;

  const isAuthed = await requireAuth();
  const detailsPublic = process.env.HEALTH_DETAILS_PUBLIC === "true";
  const publicToken = process.env.HEALTH_PUBLIC_TOKEN?.trim();
  let tokenOk = false;
  if (publicToken) {
    const header = req.headers.get("authorization") || "";
    const bearerMatch = /^Bearer\s+(.+)$/i.exec(header);
    const presented = bearerMatch?.[1]?.trim() || req.nextUrl.searchParams.get("token") || "";
    if (presented && tokenMatches(presented, publicToken)) {
      tokenOk = true;
    }
  }

  if (isAuthed || detailsPublic || tokenOk) {
    return NextResponse.json(report, { status: httpStatus });
  }
  return NextResponse.json(
    { status: report.status, generatedAt: report.generatedAt },
    { status: httpStatus },
  );
}
