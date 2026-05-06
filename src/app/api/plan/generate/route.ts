import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createMealPlan, PlannerError, PlannerInputSchema, VALID_DAYS } from "@/lib/planner";
import { appUrl } from "@/lib/redirect";

function plannerError(req: NextRequest, message: string, status = 303) {
  return NextResponse.redirect(appUrl(req, `/planner?error=${encodeURIComponent(message)}`), status);
}

export async function POST(req: NextRequest) {
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
      return plannerError(
        req,
        "Ungültige Eingabe: " + parsedInput.error.issues.map((i) => i.message).join(", "),
      );
    }
    const plan = await createMealPlan(parsedInput.data);
    return NextResponse.redirect(appUrl(req, `/planner?plan=${plan.id}`), 303);
  } catch (error) {
    console.error("plan generation failed", error);
    if (error instanceof PlannerError) return plannerError(req, error.message);
    return plannerError(req, "Die KI-Antwort war nicht verwendbar oder der Anbieter ist nicht erreichbar.");
  }
}
