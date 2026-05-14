import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { syncRecipesFromPaprika, type PaprikaRecipe } from "@/lib/paprika";
import { appUrl } from "@/lib/redirect";
import { guardSameOrigin } from "@/lib/same-origin";

const SETTING_LAST_SYNC = "lastPaprikaSync";

function recipeData(recipe: PaprikaRecipe) {
  return {
    hash: recipe.hash,
    name: recipe.name || "Unbenanntes Rezept",
    description: recipe.description || "",
    ingredients: recipe.ingredients || "",
    directions: recipe.directions || "",
    notes: recipe.notes || "",
    servings: recipe.servings || "",
    prepTime: recipe.prep_time || "",
    cookTime: recipe.cook_time || "",
    totalTime: recipe.total_time || "",
    difficulty: recipe.difficulty || "",
    rating: recipe.rating || 0,
    categoriesJson: JSON.stringify(recipe.categories || []),
    source: recipe.source || "",
    sourceUrl: recipe.source_url || "",
    imageUrl: recipe.image_url || "",
    photo: recipe.photo || "",
    photoLarge: recipe.photo_large || "",
    photoHash: recipe.photo_hash || "",
    photoUrl: recipe.photo_url || "",
    inTrash: Boolean(recipe.in_trash),
    onFavorites: Boolean(recipe.on_favorites),
  };
}

export async function POST(req: NextRequest) {
  const csrf = guardSameOrigin(req);
  if (csrf) return csrf;
  if (!(await requireAuth())) return NextResponse.redirect(appUrl(req, "/login"), 303);
  try {
    // Pre-load existing hashes so we can skip unchanged recipes entirely.
    const existing = new Map<string, string | null>();
    const stored = await prisma.recipe.findMany({
      select: { paprikaUid: true, hash: true, imageUrl: true, photo: true, photoLarge: true, photoUrl: true },
    });
    for (const r of stored) {
      // Existing caches from before image-field support have matching hashes but
      // empty image fields. Force one refetch so photos get backfilled.
      const hasAnyImage = Boolean(r.imageUrl || r.photo || r.photoLarge || r.photoUrl);
      // Lokal erzeugte Rezepte haben keine paprikaUid und kommen nie aus dem Sync.
      if (hasAnyImage && r.paprikaUid) existing.set(r.paprikaUid, r.hash);
    }

    const result = await syncRecipesFromPaprika(async (recipe) => {
      const data = recipeData(recipe);
      await prisma.recipe.upsert({
        where: { paprikaUid: recipe.uid },
        create: { paprikaUid: recipe.uid, ...data },
        update: { ...data, lastSyncedAt: new Date() },
      });
    }, { existingHashes: existing });

    await prisma.appSetting.upsert({
      where: { key: SETTING_LAST_SYNC },
      create: { key: SETTING_LAST_SYNC, value: new Date().toISOString() },
      update: { value: new Date().toISOString() },
    });

    const params = new URLSearchParams({
      synced: String(result.fetched),
      listed: String(result.listed),
      skipped: String(result.skipped),
    });
    if (result.failed) params.set("failed", String(result.failed));
    return NextResponse.redirect(appUrl(req, `/recipes?${params.toString()}`), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.redirect(appUrl(req, `/recipes?error=${encodeURIComponent(message)}`), 303);
  }
}
