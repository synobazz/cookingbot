import { redirect } from "next/navigation";
import Link from "next/link";
import { addDays, format, isAfter, startOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { dayLabel, defaultDays as defaultDayKeys } from "@/lib/planning";
import { CartIcon, CheckIcon, DownloadIcon } from "../_components/icons";
import { RecipeModal } from "../_components/recipe-modal";
import { PlannerForm } from "./planner-form";

const DAY_SHORT: Record<string, string> = {
  monday: "Mo",
  tuesday: "Di",
  wednesday: "Mi",
  thursday: "Do",
  friday: "Fr",
  saturday: "Sa",
  sunday: "So",
};

type SearchParams = {
  error?: string;
  exported?: string;
  plan?: string;
};

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (!(await requireAuth())) redirect("/login");
  const params = await searchParams;

  const plans = await prisma.mealPlan.findMany({
    orderBy: { startsOn: "desc" },
    take: 6,
    include: { items: { include: { recipe: true }, orderBy: { date: "asc" } } },
  });

  const requestedPlanId = params.plan;
  const activePlan = (requestedPlanId && plans.find((p) => p.id === requestedPlanId)) || plans[0] || null;

  const now = new Date();
  const nextMonday = startOfWeek(
    isAfter(now, startOfWeek(now, { weekStartsOn: 1 })) ? addDays(now, 7) : now,
    { weekStartsOn: 1 },
  );
  const startDateStr = format(nextMonday, "yyyy-MM-dd");
  const dayItems = defaultDayKeys.map((value, idx) => {
    const date = addDays(nextMonday, idx);
    return {
      value,
      short: DAY_SHORT[value] || value.slice(0, 2),
      dateNumber: parseInt(format(date, "d"), 10),
    };
  });

  const planWeekNumber = activePlan ? format(activePlan.startsOn, "II", { locale: de }) : null;
  const planRange = activePlan
    ? `${format(activePlan.startsOn, "d. MMM", { locale: de })} – ${format(addDays(activePlan.startsOn, 6), "d. MMM", { locale: de })}`
    : null;

  return (
    <>
      <div className="page-head">
        <div className="left">
          <span className="eyebrow">KI-Wochenplanung</span>
          <h1 className="display">
            Plan <em>kochen</em> lassen.
          </h1>
          <span className="sub">
            {activePlan
              ? `KW${"\u00a0"}${planWeekNumber} · ${planRange} · ${activePlan.people.toString().replace(".", ",")} Personen`
              : "Noch kein Plan vorhanden — fülle das Formular und lass die KI deine Woche kochen."}
          </span>
        </div>
      </div>

      {params.error ? (
        <p role="alert" style={{ color: "var(--warn)", marginBottom: 18 }}>
          Plan konnte nicht erzeugt werden: {decodeURIComponent(params.error)}
        </p>
      ) : null}
      {params.exported === "paprika" ? (
        <p role="status" style={{ color: "var(--forest)", marginBottom: 18 }}>
          Remix wurde nach Paprika exportiert.
        </p>
      ) : null}

      <div className="planner-grid">
        <aside className="planner-form">
          <PlannerForm
            defaultStart={startDateStr}
            dayItems={dayItems}
            defaultDays={defaultDayKeys}
            defaultPeople={activePlan?.people ?? 2.5}
          />
        </aside>

        <div className="card plan-week">
          <div className="plan-tabs" role="tablist" aria-label="Pläne">
            {plans.map((plan) => {
              const wk = format(plan.startsOn, "II", { locale: de });
              const on = activePlan?.id === plan.id;
              return (
                <Link
                  key={plan.id}
                  href={`/planner?plan=${plan.id}`}
                  className={`plan-tab${on ? " on" : ""}`}
                  role="tab"
                  aria-selected={on}
                >
                  {on ? "Aktueller Plan · " : ""}KW{"\u00a0"}{wk}
                </Link>
              );
            })}
          </div>

          {activePlan ? (
            <>
              {activePlan.items.map((item) => {
                const short = DAY_SHORT[item.dayName.toLowerCase()] || dayLabel(item.dayName).slice(0, 2);
                const dateLabel = format(item.date, "d. MMM", { locale: de });
                const tags: { label: string; tone?: "forest" | "terra" | "warn" | "gold" }[] = [];
                if (item.isRemix) tags.push({ label: "Remix", tone: "terra" });
                const time = item.recipe?.totalTime || item.recipe?.cookTime;
                if (time) {
                  const minutes = parseInt(time.replace(/\D/g, ""), 10);
                  if (Number.isFinite(minutes) && minutes > 0 && minutes <= 25)
                    tags.push({ label: "Schnell", tone: "forest" });
                }
                const subject = item.recipe
                  ? {
                      id: item.recipe.id,
                      name: item.title,
                      description: item.recipe.description,
                      ingredients: item.recipe.ingredients,
                      directions: item.recipe.directions,
                      notes: item.recipe.notes,
                      servings: item.recipe.servings,
                      prepTime: item.recipe.prepTime,
                      cookTime: item.recipe.cookTime,
                      totalTime: item.recipe.totalTime,
                      sourceUrl: item.recipe.sourceUrl,
                      rating: item.recipe.rating,
                    }
                  : {
                      name: item.title,
                      ingredients: item.ingredients,
                      directions: item.instructions,
                    };
                return (
                  <div className="plan-row" key={item.id}>
                    <div className="plan-day">
                      <b>{short}</b>
                      <span>{dateLabel}</span>
                    </div>
                    <div className="plan-meal">
                      <div className="pm-title">{item.title}</div>
                      {item.reasoning ? <div className="pm-reason">{item.reasoning}</div> : null}
                      {tags.length ? (
                        <div className="pm-tags">
                          {tags.map((t, i) => (
                            <span key={i} className={`chip${t.tone ? " " + t.tone : ""}`}>
                              {t.label}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="plan-acts">
                      <form action="/api/plan/item" method="post">
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="action" value="replan" />
                        <button className="btn ghost sm" type="submit">
                          Tausch
                        </button>
                      </form>
                      <form action="/api/plan/item" method="post">
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="action" value="remix" />
                        <button className="btn ghost sm" type="submit">
                          Remix
                        </button>
                      </form>
                      <RecipeModal
                        recipe={subject}
                        title={item.title}
                        triggerLabel="Öffnen"
                        triggerClassName="btn sm"
                        actionSlot={item.isRemix ? (
                          <form action="/api/paprika/export-remix" method="post">
                            <input type="hidden" name="itemId" value={item.id} />
                            <button className="btn sm" type="submit">
                              Dieses Rezept exportieren
                            </button>
                          </form>
                        ) : null}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="plan-foot">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="chip forest">
                    <CheckIcon /> Plan gespeichert
                  </span>
                  <span className="muted" style={{ fontSize: ".85rem" }}>
                    {format(activePlan.updatedAt, "d. MMM, HH:mm", { locale: de })}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <form action="/api/microsoft/export-shopping" method="post">
                    <input type="hidden" name="planId" value={activePlan.id} />
                    <button className="btn ghost" type="submit">
                      <DownloadIcon /> Export
                    </button>
                  </form>
                  <form action="/api/shopping/generate" method="post">
                    <input type="hidden" name="planId" value={activePlan.id} />
                    <button className="btn" type="submit">
                      <CartIcon /> Einkaufsliste erzeugen
                    </button>
                  </form>
                </div>
              </div>
            </>
          ) : (
            <p className="muted" style={{ padding: "32px 0", textAlign: "center" }}>
              Noch kein Plan vorhanden.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
