import { redirect } from "next/navigation";
import { addDays, format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

const days = [
  ["monday", "Mo"], ["tuesday", "Di"], ["wednesday", "Mi"], ["thursday", "Do"], ["friday", "Fr"], ["saturday", "Sa"], ["sunday", "So"],
];

export default async function PlannerPage() {
  if (!(await requireAuth())) redirect("/login");
  const plans = await prisma.mealPlan.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { items: true } });
  const nextMonday = addDays(new Date(), (8 - new Date().getDay()) % 7 || 7);
  return (
    <div className="grid">
      <section className="card">
        <div className="eyebrow">LLM Wochenplanung</div>
        <h1>Plan generieren</h1>
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
        </form>
      </section>

      <section className="grid">
        {plans.map((plan) => (
          <article className="card" key={plan.id}>
            <div className="eyebrow">{format(plan.startsOn, "dd.MM.yyyy")}</div>
            <h2>{plan.title}</h2>
            <div className="grid cols-3">
              {plan.items.map((item) => <div className="card tight meal" key={item.id}><span className="badge">{item.dayName}</span><h3>{item.title}</h3><p>{item.reasoning}</p></div>)}
            </div>
            <form action="/api/shopping/generate" method="post" style={{ marginTop: 16 }}>
              <input type="hidden" name="planId" value={plan.id} />
              <button className="button secondary">Einkaufsliste erzeugen</button>
            </form>
          </article>
        ))}
      </section>
    </div>
  );
}
