import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { splitIngredients } from "@/lib/planning";
import { aggregateIngredients, type AggregatedItem } from "@/lib/ingredient-parser";
import { loadPantryKeySet } from "@/lib/pantry";
import { categorize, STAPLE_CHECK_CATEGORY } from "@/lib/shopping-categories";
import { appUrl } from "@/lib/redirect";
import { guardSameOrigin } from "@/lib/same-origin";

/**
 * Erzeugt die Einkaufsliste aus dem Plan.
 *
 * Pipeline:
 *   1. Alle Zutatenzeilen pro Mahlzeit aufsplitten.
 *   2. Pantry-Schlüssel laden → Items, die schon zu Hause sind, fliegen raus.
 *   3. `aggregateIngredients` fasst gleiche Zutaten/Einheiten zusammen
 *      und trennt Vorratszutaten (Salz, Öl, …) in einen "Hast du noch?"-Topf.
 *   4. Beide Listen werden persistiert; die Staples bekommen die magische
 *      Kategorie `STAPLE_CHECK_CATEGORY`, damit das Board sie als
 *      eigenen Block oben rendern kann.
 */
export async function POST(req: NextRequest) {
  const csrf = guardSameOrigin(req);
  if (csrf) return csrf;
  if (!(await requireAuth())) return NextResponse.redirect(appUrl(req, "/login"), 303);
  const form = await req.formData();
  const planId = String(form.get("planId") || "");
  const plan = await prisma.mealPlan.findUnique({
    where: { id: planId },
    include: { items: { include: { recipe: true } } },
  });
  if (!plan) return NextResponse.json({ error: "Plan nicht gefunden" }, { status: 404 });

  await prisma.shoppingList.deleteMany({ where: { mealPlanId: plan.id } });

  const rawEntries = plan.items.flatMap((item) => {
    const raw = item.isRemix ? item.ingredients : item.recipe?.ingredients || item.ingredients;
    return splitIngredients(raw).map((line) => ({ line, source: item.title }));
  });

  const pantryKeys = await loadPantryKeySet();
  const { items, staples } = aggregateIngredients(rawEntries, pantryKeys);

  const toCreate = [
    ...items.map((agg, idx) => mapToCreate(agg, idx, false)),
    ...staples.map((agg, idx) => mapToCreate(agg, items.length + idx, true)),
  ];

  await prisma.shoppingList.create({
    data: {
      mealPlanId: plan.id,
      title: `Einkauf für ${plan.title}`,
      items: { create: toCreate },
    },
  });
  return NextResponse.redirect(appUrl(req, "/shopping"), 303);
}

function mapToCreate(agg: AggregatedItem, order: number, isStaple: boolean) {
  return {
    name: agg.name,
    quantity: agg.quantity,
    category: isStaple ? STAPLE_CHECK_CATEGORY : categorize(agg.name),
    source: agg.sources.join(" · "),
    order,
  };
}
