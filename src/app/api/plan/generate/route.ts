import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createMealPlan, PlannerError, PlannerInputSchema, VALID_DAYS } from "@/lib/planner";
import { appUrl } from "@/lib/redirect";
import { guardSameOrigin } from "@/lib/same-origin";

function wantsJson(req: NextRequest) {
  return req.headers.get("accept")?.includes("application/json") ?? false;
}

function plannerFailure(req: NextRequest, message: string, status = 400) {
  return wantsJson(req)
    ? NextResponse.json({ ok: false, error: message }, { status })
    : plannerError(req, message);
}

function plannerError(req: NextRequest, message: string, status = 303) {
  return NextResponse.redirect(appUrl(req, `/planner?error=${encodeURIComponent(message)}`), status);
}

export async function POST(req: NextRequest) {
  const csrf = guardSameOrigin(req);
  if (csrf) return csrf;
  if (!(await requireAuth())) return NextResponse.redirect(appUrl(req, "/login"), 303);

  try {
    const form = await req.formData();
    const rawDays = form.getAll("days").map(String);
    const parsedInput = PlannerInputSchema.safeParse({
      start: String(form.get("start") || new Date().toISOString().slice(0, 10)),
      people: form.get("people") ?? 2.5,
      notes: String(form.get("notes") || ""),
      days: rawDays.length ? rawDays : VALID_DAYS,
    });
    if (!parsedInput.success) {
      return plannerFailure(
        req,
        "Ungültige Eingabe: " + parsedInput.error.issues.map((i) => i.message).join(", "),
      );
    }
    const plan = await createMealPlan(parsedInput.data);
    if (wantsJson(req)) return NextResponse.json({ ok: true, planId: plan.id, href: `/planner?plan=${plan.id}` });
    return NextResponse.redirect(appUrl(req, `/planner?plan=${plan.id}`), 303);
  } catch (error) {
    console.error("plan generation failed", error instanceof Error ? error.message : "unknown");
    if (error instanceof PlannerError) return plannerFailure(req, error.message, 502);
    return plannerFailure(req, "Die KI-Antwort war nicht verwendbar oder der Anbieter ist nicht erreichbar.", 502);
  }
}
