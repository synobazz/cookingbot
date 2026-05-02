import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createRecipeInPaprika } from "@/lib/paprika";
import { appUrl } from "@/lib/redirect";

function plannerUrl(req: NextRequest, planId: string, itemId: string, params: Record<string, string>) {
  const search = new URLSearchParams({ plan: planId, ...params });
  return appUrl(req, `/planner?${search.toString()}#meal-${itemId}`);
}

export async function POST(req: NextRequest) {
  if (!(await requireAuth())) return NextResponse.redirect(appUrl(req, "/login"), 303);

  const form = await req.formData();
  const itemId = String(form.get("itemId") || "");
  const item = await prisma.mealItem.findUnique({ where: { id: itemId }, include: { mealPlan: true, recipe: true } });
  if (!item) return NextResponse.redirect(appUrl(req, "/planner?error=Gericht%20nicht%20gefunden"), 303);
  if (!item.isRemix || !item.ingredients || !item.instructions) {
    return NextResponse.redirect(plannerUrl(req, item.mealPlanId, item.id, { error: "Nur Remixe mit Zutaten und Zubereitung können exportiert werden" }), 303);
  }

  try {
    const exported = await createRecipeInPaprika({
      name: item.title,
      ingredients: item.ingredients,
      directions: item.instructions,
      notes: item.remixSource ? `Cookingbot Remix von: ${item.remixSource}\n\n${item.reasoning || ""}`.trim() : item.reasoning || "",
      source: "Cookingbot Remix",
      categories: ["Cookingbot", "Remix"],
    });

    const recipe = await prisma.recipe.create({
      data: {
        paprikaUid: exported.uid,
        hash: exported.hash,
        name: item.title,
        ingredients: item.ingredients,
        directions: item.instructions,
        notes: item.remixSource ? `Cookingbot Remix von: ${item.remixSource}\n\n${item.reasoning || ""}`.trim() : item.reasoning || "",
        categoriesJson: JSON.stringify(["Cookingbot", "Remix"]),
        source: "Cookingbot Remix",
        onFavorites: true,
      },
    });

    await prisma.mealItem.update({
      where: { id: item.id },
      data: { recipeId: recipe.id, isRemix: false, remixSource: "", reasoning: `${item.reasoning || ""} In Paprika gespeichert.`.trim() },
    });

    return NextResponse.redirect(plannerUrl(req, item.mealPlanId, item.id, { exported: "paprika" }), 303);
  } catch (error) {
    console.error("paprika export failed", error);
    return NextResponse.redirect(plannerUrl(req, item.mealPlanId, item.id, { error: "Paprika-Export fehlgeschlagen" }), 303);
  }
}
