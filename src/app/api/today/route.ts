import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!(await requireAuth())) return NextResponse.redirect(new URL("/login", req.url), 303);
  const recipes = await prisma.recipe.findMany({ where: { inTrash: false }, orderBy: [{ onFavorites: "desc" }, { rating: "desc" }, { updatedAt: "desc" }], take: 12 });
  const suggestion = recipes[Math.floor(Math.random() * Math.max(recipes.length, 1))];
  if (!suggestion) return NextResponse.json({ error: "Keine Rezepte vorhanden" }, { status: 400 });
  const plan = await prisma.mealPlan.create({
    data: {
      title: "Heute essen wir…",
      startsOn: new Date(),
      daysJson: JSON.stringify(["today"]),
      items: { create: [{ date: new Date(), dayName: "heute", title: suggestion.name, recipeId: suggestion.id, reasoning: "Schneller Vorschlag aus deinen Paprika-Rezepten." }] },
    },
  });
  return NextResponse.redirect(new URL(`/planner?today=${plan.id}`, req.url), 303);
}
