import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { safeJson } from "@/lib/planning";

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
        <form action="/api/sync/paprika" method="post"><button className="button">Jetzt synchronisieren</button></form>
      </section>
      <section className="recipe-list">
        {recipes.map((recipe) => {
          const categories = safeJson<string[]>(recipe.categoriesJson, []);
          return (
            <article className="card tight recipe-card" key={recipe.id}>
              <div>
                <span className="badge">{recipe.rating ? "★".repeat(recipe.rating) : "unbewertet"}</span>
              </div>
              <h3>{recipe.name}</h3>
              <p>{[recipe.prepTime, recipe.cookTime, recipe.servings].filter(Boolean).join(" · ") || "Keine Zeitangabe"}</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{categories.slice(0, 4).map((c) => <span className="badge" key={c}>{c}</span>)}</div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
