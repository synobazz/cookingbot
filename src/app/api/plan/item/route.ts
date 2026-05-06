import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { RemixError, remixMealItem, replanMealItem } from "@/lib/remix";
import { appUrl } from "@/lib/redirect";

const InputSchema = z.object({
  itemId: z.string().min(1),
  action: z.enum(["replan", "remix"]),
});

function plannerRedirect(req: NextRequest, planId?: string, error?: string, itemId?: string) {
  const params = new URLSearchParams();
  if (planId) params.set("plan", planId);
  if (error) params.set("error", error);
  const hash = itemId ? `#meal-${itemId}` : "";
  return NextResponse.redirect(
    appUrl(req, `/planner${params.size ? `?${params.toString()}` : ""}${hash}`),
    303,
  );
}

export async function POST(req: NextRequest) {
  if (!(await requireAuth())) return NextResponse.redirect(appUrl(req, "/login"), 303);

  const form = await req.formData();
  const parsed = InputSchema.safeParse({
    itemId: String(form.get("itemId") || ""),
    action: String(form.get("action") || ""),
  });
  if (!parsed.success) return plannerRedirect(req, undefined, "Ungültige Eingabe");
  const { itemId, action } = parsed.data;

  // Plan-ID nachschlagen, damit wir auf Fehlerfall mit Plan-Kontext zurück können.
  const item = await prisma.mealItem.findUnique({
    where: { id: itemId },
    select: { id: true, mealPlanId: true },
  });
  if (!item) return plannerRedirect(req, undefined, "Gericht nicht gefunden");

  try {
    if (action === "replan") {
      await replanMealItem(itemId);
    } else {
      await remixMealItem(itemId);
    }
    return plannerRedirect(req, item.mealPlanId, undefined, item.id);
  } catch (error) {
    console.error(`${action} failed`, error);
    if (error instanceof RemixError) return plannerRedirect(req, item.mealPlanId, error.message, item.id);
    return plannerRedirect(req, item.mealPlanId, "Aktion fehlgeschlagen", item.id);
  }
}
