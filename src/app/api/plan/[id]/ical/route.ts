import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { buildIcs, type IcsEvent } from "@/lib/ical";
import { splitIngredients } from "@/lib/planning";

/**
 * Liefert den Plan als iCalendar (.ics) — eine Ganztags-Mahlzeit pro Tag.
 *
 * SUMMARY = Titel des Plan-Items.
 * DESCRIPTION = Reasoning + Zutatenliste, damit man die Karte direkt im
 * Kalender lesen kann (Apple Calendar / Outlook zeigen das im Detail-Pane).
 *
 * UID nutzt die MealItem-ID, damit Folge-Updates dieselbe Reservierung
 * im Kalender aktualisieren statt zu duplizieren.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAuth())) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;

  const plan = await prisma.mealPlan.findUnique({
    where: { id },
    include: { items: { include: { recipe: true }, orderBy: { date: "asc" } } },
  });
  if (!plan) return new NextResponse("Plan nicht gefunden", { status: 404 });

  const hostname = new URL(req.url).hostname || "cookingbot.local";

  const events: IcsEvent[] = plan.items.map((item) => {
    const ingredientsRaw = item.isRemix ? item.ingredients : item.recipe?.ingredients || item.ingredients;
    const ingredients = splitIngredients(ingredientsRaw).slice(0, 20);
    const descriptionParts: string[] = [];
    if (item.reasoning) descriptionParts.push(item.reasoning);
    if (ingredients.length > 0) {
      descriptionParts.push("");
      descriptionParts.push("Zutaten:");
      descriptionParts.push(ingredients.map((line) => `- ${line}`).join("\n"));
    }
    return {
      uid: item.id,
      date: item.date,
      summary: item.title,
      description: descriptionParts.join("\n"),
    };
  });

  const ics = buildIcs(events, hostname);
  const safeTitle = plan.title.replace(/[^a-zA-Z0-9-_]+/g, "-").toLowerCase() || "plan";
  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="cookingbot-${safeTitle}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
