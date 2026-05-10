import { NextResponse } from "next/server";
import { runHealthChecks } from "@/lib/health";

export const dynamic = "force-dynamic";

/**
 * Healthcheck-Endpoint für externe Monitoring-Tools.
 * Antwortet mit 200 wenn alles `ok`, sonst 503 + JSON-Body mit Detail.
 */
export async function GET() {
  const report = await runHealthChecks();
  const httpStatus = report.status === "ok" ? 200 : 503;
  return NextResponse.json(report, { status: httpStatus });
}
