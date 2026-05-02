import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getOpenAIClient, remixModel } from "@/lib/llm";
import { containsUnsafeDinnerText, isUnsafeDinnerRecipe, recipeForPrompt } from "@/lib/planning";
import { appUrl } from "@/lib/redirect";

const RemixSchema = z.object({
  title: z.string().min(1),
  reasoning: z.string().optional().default(""),
  ingredients: z.string().optional().default(""),
  instructions: z.string().optional().default(""),
});

function plannerRedirect(req: NextRequest, planId?: string, error?: string) {
  const params = new URLSearchParams();
  if (planId) params.set("plan", planId);
  if (error) params.set("error", error);
  return NextResponse.redirect(appUrl(req, `/planner${params.size ? `?${params.toString()}` : ""}`), 303);
}

export async function POST(req: NextRequest) {
  if (!(await requireAuth())) return NextResponse.redirect(appUrl(req, "/login"), 303);

  const form = await req.formData();
  const itemId = String(form.get("itemId") || "");
  const action = String(form.get("action") || "");
  const item = await prisma.mealItem.findUnique({ where: { id: itemId }, include: { mealPlan: { include: { items: true } }, recipe: true } });
  if (!item) return plannerRedirect(req, undefined, "Gericht nicht gefunden");

  if (action === "replan") {
    const usedRecipeIds = new Set(item.mealPlan.items.map((meal) => meal.recipeId).filter(Boolean));
    const candidates = (await prisma.recipe.findMany({ where: { inTrash: false, excludeFromPlanning: false }, orderBy: [{ onFavorites: "desc" }, { rating: "desc" }, { updatedAt: "desc" }], take: 160 }))
      .filter((recipe) => !isUnsafeDinnerRecipe(recipe) && recipe.id !== item.recipeId && !usedRecipeIds.has(recipe.id));
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    if (!pick) return plannerRedirect(req, item.mealPlanId, "Kein alternatives abendessentaugliches Rezept gefunden");
    await prisma.mealItem.update({
      where: { id: item.id },
      data: {
        title: pick.name,
        recipeId: pick.id,
        isRemix: false,
        remixSource: "",
        reasoning: "Neu geplant: anderes familien- und abendessentaugliches Paprika-Rezept.",
        ingredients: "",
        instructions: "",
      },
    });
    return plannerRedirect(req, item.mealPlanId);
  }

  if (action === "remix") {
    const sourceRecipe = item.recipe;
    if (!sourceRecipe && !item.ingredients) return plannerRedirect(req, item.mealPlanId, "Für dieses Gericht fehlen Rezeptdaten zum Remixen");
    let remix: z.infer<typeof RemixSchema>;
    try {
      const client = getOpenAIClient();
      const response = await client.chat.completions.create({
        model: remixModel,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Du bist eine kreative, familienfreundliche Kochhilfe. Antworte ausschließlich als valides JSON. Erzeuge einen kindertauglichen Abendessen-Remix. Keine alkoholischen Getränke, Cocktails, Drinks, reine Desserts oder Snacks." },
          { role: "user", content: JSON.stringify({
            task: "Mach aus diesem Rezept einen coolen, aber realistisch kochbaren Remix fürs Abendessen.",
            household: "2 Erwachsene und ein 5-jähriges Kind",
            rules: ["keine alkoholischen Zutaten/Drinks", "familien- und kindertauglich", "konkrete Zutaten und kurze Kochanleitung liefern", "nicht zu experimentell"],
            outputSchema: { title: "string", reasoning: "short German reason", ingredients: "newline-separated ingredients", instructions: "short German instructions" },
            source: sourceRecipe ? recipeForPrompt(sourceRecipe) : { name: item.title, ingredients: item.ingredients, instructions: item.instructions },
          }) },
        ],
      });
      const raw = response.choices[0]?.message?.content || "{}";
      remix = RemixSchema.parse(JSON.parse(raw));
    } catch (error) {
      console.error("remix generation failed", error);
      return plannerRedirect(req, item.mealPlanId, "Remix konnte nicht erstellt werden");
    }
    if (containsUnsafeDinnerText(`${remix.title} ${remix.reasoning} ${remix.ingredients}`)) {
      return plannerRedirect(req, item.mealPlanId, "Remix wurde blockiert, weil er nicht kindertauglich wirkt");
    }
    await prisma.mealItem.update({
      where: { id: item.id },
      data: {
        title: remix.title,
        isRemix: true,
        remixSource: sourceRecipe?.name || item.title,
        reasoning: remix.reasoning || `Remix von ${sourceRecipe?.name || item.title}`,
        ingredients: remix.ingredients,
        instructions: remix.instructions,
      },
    });
    return plannerRedirect(req, item.mealPlanId);
  }

  return plannerRedirect(req, item.mealPlanId, "Unbekannte Aktion");
}
