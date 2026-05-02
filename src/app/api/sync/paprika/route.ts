import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { syncRecipesFromPaprika } from "@/lib/paprika";
import { appUrl } from "@/lib/redirect";

export async function POST(req: NextRequest) {
  if (!(await requireAuth())) return NextResponse.redirect(appUrl(req, "/login"), 303);
  try {
    let upserted = 0;
    const result = await syncRecipesFromPaprika(async (recipe) => {
      await prisma.recipe.upsert({
        where: { paprikaUid: recipe.uid },
        create: {
          paprikaUid: recipe.uid,
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
        },
        update: {
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
          lastSyncedAt: new Date(),
        },
      });
      upserted += 1;
    });
    await prisma.appSetting.upsert({ where: { key: "lastPaprikaSync" }, create: { key: "lastPaprikaSync", value: new Date().toISOString() }, update: { value: new Date().toISOString() } });
    return NextResponse.redirect(appUrl(req, `/recipes?synced=${upserted}&listed=${result.listed}`), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.redirect(appUrl(req, `/recipes?error=${encodeURIComponent(message)}`), 303);
  }
}
