import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { appUrl } from "@/lib/redirect";
import { guardSameOrigin } from "@/lib/same-origin";

export async function POST(req: NextRequest) {
  const csrf = guardSameOrigin(req);
  if (csrf) return csrf;
  if (!(await requireAuth())) return NextResponse.redirect(appUrl(req, "/login"), 303);

  const form = await req.formData();
  const recipeId = String(form.get("recipeId") || "");
  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId }, select: { excludeFromPlanning: true } });
  if (!recipe) return NextResponse.redirect(appUrl(req, "/recipes?error=Rezept%20nicht%20gefunden"), 303);

  await prisma.recipe.update({
    where: { id: recipeId },
    data: { excludeFromPlanning: !recipe.excludeFromPlanning },
  });

  return NextResponse.redirect(appUrl(req, "/recipes"), 303);
}
