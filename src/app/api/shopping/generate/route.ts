import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { splitIngredients } from "@/lib/planning";

export async function POST(req: NextRequest) {
  if (!(await requireAuth())) return NextResponse.redirect(new URL("/login", req.url), 303);
  const form = await req.formData();
  const planId = String(form.get("planId") || "");
  const plan = await prisma.mealPlan.findUnique({ where: { id: planId }, include: { items: { include: { recipe: true } } } });
  if (!plan) return NextResponse.json({ error: "Plan nicht gefunden" }, { status: 404 });

  await prisma.shoppingList.deleteMany({ where: { mealPlanId: plan.id } });
  const rawItems = plan.items.flatMap((item) => {
    const raw = item.isRemix ? item.ingredients : item.recipe?.ingredients || item.ingredients;
    return splitIngredients(raw).map((line) => ({ line, source: item.title }));
  });

  await prisma.shoppingList.create({
    data: {
      mealPlanId: plan.id,
      title: `Einkauf für ${plan.title}`,
      items: { create: rawItems.map((item, index) => ({ name: item.line, source: item.source, order: index })) },
    },
  });
  return NextResponse.redirect(new URL("/shopping", req.url), 303);
}
