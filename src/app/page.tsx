import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { dayLabel, seasonLabel } from "@/lib/planning";
import { RecipeDetails } from "./recipe-details";

export default async function HomePage() {
  if (!(await requireAuth())) redirect("/login");
  const [recipeCount, latestPlan, shoppingCount] = await Promise.all([
    prisma.recipe.count({ where: { inTrash: false } }),
    prisma.mealPlan.findFirst({ orderBy: { createdAt: "desc" }, include: { items: { include: { recipe: true } } } }),
    prisma.shoppingListItem.count({ where: { checked: false } }),
  ]);

  return (
    <div className="grid">
      <section className="hero">
        <div className="card">
          <div className="eyebrow">Aktuelle Saison: {seasonLabel(new Date())}</div>
          <h1>Was essen wir diese Woche?</h1>
          <p>Plane 7 Abendessen für 2 Erwachsene und ein Kind, saisonal gedacht, aus deinen Paprika-Rezepten — mit Platz für clevere Remixe.</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
            <Link className="button" href="/planner">Woche planen</Link>
            <form action="/api/sync/paprika" method="post"><button className="button secondary" type="submit">Paprika syncen</button></form>
            <form action="/api/today" method="post"><button className="button green" type="submit">Was essen wir heute?</button></form>
          </div>
        </div>
        <div className="grid">
          <div className="card tight"><div className="stat">{recipeCount}</div><div className="muted">Rezepte im lokalen Cache</div></div>
          <div className="card tight"><div className="stat">{latestPlan?.items.length ?? 0}</div><div className="muted">Gerichte im letzten Plan</div></div>
          <div className="card tight"><div className="stat">{shoppingCount}</div><div className="muted">offene Einkaufspunkte</div></div>
        </div>
      </section>

      {latestPlan ? (
        <section className="card">
          <div className="eyebrow">Letzter Plan</div>
          <h2>{latestPlan.title}</h2>
          <div className="grid cols-3">
            {latestPlan.items.map((item) => (
              <div className="card tight meal" key={item.id}>
                <span className="badge">{dayLabel(item.dayName)}</span>
                <h3>{item.title}</h3>
                <p>{item.reasoning || (item.isRemix ? "Remix" : "Paprika-Rezept")}</p>
                <RecipeDetails recipe={item.recipe} fallbackIngredients={item.ingredients} fallbackInstructions={item.instructions} />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
