import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordCookedFromPlanItem } from "@/lib/history";
import { appUrl } from "@/lib/redirect";

/**
 * Markiert ein Plan-Item als heute gekocht (eigene Route, weil ein
 * `MealHistory`-Insert deutlich schlanker ist als der Replan/Remix-Pfad
 * und keine LLM-Kosten verursacht).
 */
export async function POST(req: NextRequest) {
  if (!(await requireAuth())) return NextResponse.redirect(appUrl(req, "/login"), 303);
  const form = await req.formData();
  const itemId = String(form.get("itemId") || "");
  if (!itemId) return NextResponse.redirect(appUrl(req, "/planner?error=Ungültige%20Eingabe"), 303);

  const item = await prisma.mealItem.findUnique({
    where: { id: itemId },
    select: { mealPlanId: true },
  });
  if (!item) return NextResponse.redirect(appUrl(req, "/planner?error=Gericht%20nicht%20gefunden"), 303);

  try {
    await recordCookedFromPlanItem(itemId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Konnte nicht als gekocht markieren";
    return NextResponse.redirect(
      appUrl(req, `/planner?plan=${item.mealPlanId}&error=${encodeURIComponent(message)}#meal-${itemId}`),
      303,
    );
  }

  return NextResponse.redirect(
    appUrl(req, `/planner?plan=${item.mealPlanId}&cooked=1#meal-${itemId}`),
    303,
  );
}
