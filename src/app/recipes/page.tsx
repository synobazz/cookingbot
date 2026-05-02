import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { displayCategories, isUnsafeDinnerRecipe, safeJson } from "@/lib/planning";
import { RecipeDetails } from "../recipe-details";
import { RecipeImage } from "../recipe-image";

export default async function RecipesPage({ searchParams }: { searchParams: Promise<{ error?: string; synced?: string }> }) {
  if (!(await requireAuth())) redirect("/login");
  const params = await searchParams;
  const recipes = await prisma.recipe.findMany({ where: { inTrash: false }, orderBy: [{ rating: "desc" }, { name: "asc" }], take: 300 });
  return (
    <div className="grid">
      <section className="card">
        <div className="eyebrow">Paprika</div>
        <h1>Rezepte</h1>
        <p>Lokaler Cache deiner Paprika-Rezepte. Der Sync holt neue und geänderte Rezepte von Paprika Cloud und kann beim ersten Mal 1–2 Minuten dauern.</p>
        {params.synced ? <p style={{ color: "#15803d" }}>{params.synced} Rezepte synchronisiert.</p> : null}
        {params.error ? <p style={{ color: "#b91c1c" }}>Sync fehlgeschlagen: {decodeURIComponent(params.error)}</p> : null}
        <form action="/api/sync/paprika" method="post">
          <button className="button" type="submit">Jetzt synchronisieren</button>
          <p className="loading-note"><span className="spinner" /> Sync läuft, das kann kurz dauern…</p>
        </form>
      </section>
      <section className="recipe-list">
        {recipes.map((recipe) => {
          const categories = displayCategories(safeJson<string[]>(recipe.categoriesJson, []));
          return (
            <article className="card recipe-card" key={recipe.id}>
              <div className="recipe-card-media">
                <RecipeImage recipeId={recipe.id} className="recipe-card-image" />
              </div>
              <div className="recipe-card-header">
                <span className="badge">{recipe.rating ? "★".repeat(recipe.rating) : "unbewertet"}</span>
                {isUnsafeDinnerRecipe(recipe) ? <span className="badge warning-badge">nicht für Abendplanung</span> : null}
              </div>
              <div className="recipe-card-content">
                <h3>{recipe.name}</h3>
                <p>{[recipe.prepTime, recipe.cookTime, recipe.servings].filter(Boolean).join(" · ") || "Keine Zeitangabe"}</p>
                <div className="recipe-category-row">{categories.slice(0, 3).map((c) => <span className="badge" key={c}>{c}</span>)}</div>
                <div className="recipe-card-actions"><RecipeDetails recipe={recipe} /></div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
