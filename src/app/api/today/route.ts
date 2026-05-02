import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { appUrl } from "@/lib/redirect";

export async function POST(req: NextRequest) {
  if (!(await requireAuth())) return NextResponse.redirect(appUrl(req, "/login"), 303);

  // De-dupe: if a "Heute essen wir…" plan already exists for today, just open it.
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setHours(23, 59, 59, 999);
  const existing = await prisma.mealPlan.findFirst({
    where: {
      title: "Heute essen wir…",
      startsOn: { gte: startOfDay, lte: endOfDay },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    return NextResponse.redirect(appUrl(req, `/planner?today=${existing.id}`), 303);
  }

  const recipes = await prisma.recipe.findMany({
    where: { inTrash: false, excludeFromPlanning: false },
    orderBy: [{ onFavorites: "desc" }, { rating: "desc" }, { updatedAt: "desc" }],
    take: 12,
  });
  if (!recipes.length) {
    return NextResponse.redirect(appUrl(req, "/planner?error=Keine%20Rezepte%20vorhanden"), 303);
  }
  const suggestion = recipes[Math.floor(Math.random() * recipes.length)];
  const plan = await prisma.mealPlan.create({
    data: {
      title: "Heute essen wir…",
      startsOn: new Date(),
      daysJson: JSON.stringify(["today"]),
      items: {
        create: [{
          date: new Date(),
          dayName: "heute",
          title: suggestion.name,
          recipeId: suggestion.id,
          reasoning: "Schneller Vorschlag aus deinen Paprika-Rezepten.",
        }],
      },
    },
  });
  return NextResponse.redirect(appUrl(req, `/planner?today=${plan.id}`), 303);
}
