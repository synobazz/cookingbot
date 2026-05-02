import { redirect } from "next/navigation";
import { addDays, format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { dayLabel } from "@/lib/planning";
import { RecipeDetails } from "../recipe-details";

const days = [
  ["monday", "Mo"], ["tuesday", "Di"], ["wednesday", "Mi"], ["thursday", "Do"], ["friday", "Fr"], ["saturday", "Sa"], ["sunday", "So"],
];

export default async function PlannerPage({ searchParams }: { searchParams: Promise<{ error?: string; plan?: string; today?: string }> }) {
  if (!(await requireAuth())) redirect("/login");
  const params = await searchParams;
  const plans = await prisma.mealPlan.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { items: { include: { recipe: true } } } });
  const nextMonday = addDays(new Date(), (8 - new Date().getDay()) % 7 || 7);
  return (
    <div className="grid">
      <section className="card">
        <div className="eyebrow">LLM Wochenplanung</div>
        <h1>Plan generieren</h1>
        {params.error ? <p style={{ color: "#b91c1c" }}>Plan konnte nicht erzeugt werden: {decodeURIComponent(params.error)}</p> : null}
        <p className="muted">Die KI-Planung kann je nach Rezeptmenge 1–2 Minuten dauern.</p>
        <form className="form" method="post" action="/api/plan/generate">
          <div className="grid cols-2">
            <label><div className="label">Startdatum</div><input className="input" name="start" type="date" defaultValue={format(nextMonday, "yyyy-MM-dd")} /></label>
            <label><div className="label">Personen</div><input className="input" name="people" type="number" min="1" step="0.5" defaultValue="2.5" /></label>
          </div>
          <div>
            <div className="label">Welche Tage?</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {days.map(([value, label]) => <label className="badge" key={value}><input type="checkbox" name="days" value={value} defaultChecked /> {label}</label>)}
            </div>
          </div>
          <label><div className="label">Wünsche für diese Woche</div><textarea className="textarea" name="notes" placeholder="z.B. 2x schnell, 1x kindertauglich, Kartoffeln gerne als Beilage, Samstag darf aufwendiger sein…" /></label>
          <button className="button" type="submit">Plan kochen lassen</button>
          <p className="loading-note"><span className="spinner" /> Wochenplan wird erstellt… das kann 1–2 Minuten dauern.</p>
        </form>
      </section>

      <section className="grid">
        {plans.map((plan) => (
          <article className="card" key={plan.id}>
            <div className="eyebrow">{format(plan.startsOn, "dd.MM.yyyy")}</div>
            <h2>{plan.title}</h2>
            <div className="grid cols-3">
              {plan.items.map((item) => (
                <div className="card tight meal" key={item.id}>
                  <span className="badge">{dayLabel(item.dayName)}</span>
                  <h3>{item.title}</h3>
                  <p>{item.reasoning}</p>
                  <RecipeDetails recipe={item.recipe} fallbackIngredients={item.ingredients} fallbackInstructions={item.instructions} />
                </div>
              ))}
            </div>
            <form action="/api/shopping/generate" method="post" style={{ marginTop: 16 }}>
              <input type="hidden" name="planId" value={plan.id} />
              <button className="button secondary" type="submit">Einkaufsliste erzeugen</button>
              <p className="loading-note"><span className="spinner" /> Einkaufsliste wird erzeugt…</p>
            </form>
          </article>
        ))}
      </section>
    </div>
  );
}
