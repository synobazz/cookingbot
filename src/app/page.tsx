import { redirect } from "next/navigation";
import Link from "next/link";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { seasonLabel } from "@/lib/planning";
import { BookIcon, CalendarIcon, CartIcon, PlusIcon, RefreshIcon, ShuffleIcon } from "./_components/icons";
import { RecipeCard } from "./_components/recipe-card";
import { RecipeModal } from "./_components/recipe-modal";
import { PendingForm, PendingButton } from "./_components/pending-form";

const WEEKDAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const WEEKDAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

function greeting(date: Date) {
  const hour = date.getHours();
  if (hour < 5) return "Gute Nacht";
  if (hour < 11) return "Guten Morgen";
  if (hour < 17) return "Hallo";
  return "Guten Abend";
}

function deriveTag(item: { isRemix: boolean; reasoning: string | null; recipe: { totalTime?: string | null; cookTime?: string | null; categoriesJson?: string } | null }) {
  if (item.isRemix) return "Remix";
  const time = item.recipe?.totalTime || item.recipe?.cookTime || "";
  const minutes = parseInt(time.replace(/\D/g, ""), 10);
  if (Number.isFinite(minutes) && minutes > 0 && minutes <= 25) return "Schnell";
  try {
    const cats = JSON.parse(item.recipe?.categoriesJson || "[]") as string[];
    if (cats.some((c) => /vegetarisch|vegan/i.test(c))) return "Vegetarisch";
    if (cats.some((c) => /suppe/i.test(c))) return "Suppe";
    if (cats.some((c) => /klassiker|familie/i.test(c))) return "Klassiker";
  } catch {}
  return "Plan";
}

export default async function HomePage() {
  if (!(await requireAuth())) redirect("/login");

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 7);

  const [recipeCount, latestPlan, shoppingCount, seasonalRecipes] = await Promise.all([
    prisma.recipe.count({ where: { inTrash: false } }),
    prisma.mealPlan.findFirst({
      where: { startsOn: { gte: addDays(weekStart, -7), lt: weekEnd } },
      orderBy: { startsOn: "desc" },
      include: { items: { include: { recipe: true }, orderBy: { date: "asc" } } },
    }),
    prisma.shoppingListItem.count({ where: { checked: false } }),
    prisma.recipe.findMany({
      where: { inTrash: false, onFavorites: true },
      orderBy: [{ rating: "desc" }, { updatedAt: "desc" }],
      take: 4,
    }),
  ]);

  // Tonight: heute aus aktuellem Plan oder erstes künftiges Item
  const tonight =
    latestPlan?.items.find((i) => isSameDay(i.date, now)) ??
    latestPlan?.items.find((i) => i.date.getTime() >= now.getTime()) ??
    null;

  const plannedDays = latestPlan?.items.length ?? 0;
  const weekNumber = format(weekStart, "II", { locale: de });
  const eyebrow = `${format(now, "EEEE · d. MMMM", { locale: de })} · ${seasonLabel(now)}`;

  // 7-Tage Slots der aktuellen Kalenderwoche, mit Plan-Items gemappt
  const weekSlots = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const item = latestPlan?.items.find((it) => isSameDay(it.date, date)) ?? null;
    return {
      date,
      key: WEEKDAY_KEYS[i],
      short: WEEKDAY_SHORT[i],
      isToday: isSameDay(date, now),
      item,
    };
  });

  const totalSeasonal = await prisma.recipe.count({ where: { inTrash: false } });

  return (
    <>
      <div className="page-head">
        <div className="left">
          <span className="eyebrow">{eyebrow}</span>
          <h1 className="display">
            {greeting(now)}, <em>Familie.</em>
          </h1>
          <span className="sub">
            {latestPlan
              ? `${plannedDays} Abendessen für ${latestPlan.people.toString().replace(".", ",")} Personen — KW${"\u00a0"}${weekNumber} ist geplant.`
              : "Noch kein Plan für diese Woche. Lass uns das ändern."}
          </span>
        </div>
        <div className="actions">
          <PendingForm action="/api/sync/paprika" method="post" pendingMessage="Paprika wird synchronisiert…">
            <PendingButton className="btn ghost" type="submit">
              <RefreshIcon /> Paprika syncen
            </PendingButton>
          </PendingForm>
          <Link className="btn" href="/planner">
            <PlusIcon /> Neue Woche planen
          </Link>
        </div>
      </div>

      <div className="dash-grid">
        <div className="tonight">
          <div className="eyebrow">
            {tonight && isSameDay(tonight.date, now) ? "Heute Abend · geplant" : tonight ? "Als nächstes" : "Heute Abend"}
          </div>
          {tonight ? (
            <>
              <h2>{tonight.title}</h2>
              <div className="meta">
                {tonight.recipe?.totalTime || tonight.recipe?.cookTime ? (
                  <span>{tonight.recipe.totalTime || tonight.recipe.cookTime}</span>
                ) : null}
                {tonight.recipe?.servings ? <span>{tonight.recipe.servings} Personen</span> : null}
                {tonight.isRemix ? <span>Remix</span> : null}
              </div>
              <div className="acts">
                {tonight.recipe ? (
                  <RecipeModal
                    recipe={{
                      id: tonight.recipe.id,
                      name: tonight.title,
                      description: tonight.recipe.description,
                      ingredients: tonight.recipe.ingredients,
                      directions: tonight.recipe.directions,
                      notes: tonight.recipe.notes,
                      servings: tonight.recipe.servings,
                      prepTime: tonight.recipe.prepTime,
                      cookTime: tonight.recipe.cookTime,
                      totalTime: tonight.recipe.totalTime,
                      sourceUrl: tonight.recipe.sourceUrl,
                      rating: tonight.recipe.rating,
                      source: tonight.recipe.source,
                    }}
                    title={tonight.title}
                    triggerLabel="Rezept öffnen"
                    triggerClassName="btn"
                  />
                ) : (
                  <RecipeModal
                    recipe={{
                      name: tonight.title,
                      ingredients: tonight.ingredients,
                      directions: tonight.instructions,
                    }}
                    triggerLabel="Rezept öffnen"
                    triggerClassName="btn"
                  />
                )}
                <Link className="btn ghost" href="/planner">
                  <ShuffleIcon /> Anderes Gericht
                </Link>
              </div>
            </>
          ) : (
            <>
              <h2>
                Plane deine erste <em>Woche.</em>
              </h2>
              <div className="meta">
                <span>Saisonal · KW{"\u00a0"}{weekNumber}</span>
              </div>
              <div className="acts">
                <Link className="btn" href="/planner">
                  Jetzt planen
                </Link>
              </div>
            </>
          )}
        </div>
        <div className="stack">
          <div className="stat-card terra">
            <div className="stat-icon">
              <BookIcon />
            </div>
            <div>
              <div className="num">{recipeCount}</div>
              <div className="lab">Rezepte synchronisiert</div>
            </div>
          </div>
          <div className="stat-card forest">
            <div className="stat-icon">
              <CalendarIcon />
            </div>
            <div>
              <div className="num">{plannedDays}/7</div>
              <div className="lab">Tage geplant diese Woche</div>
            </div>
          </div>
          <div className="stat-card gold">
            <div className="stat-icon">
              <CartIcon />
            </div>
            <div>
              <div className="num">{shoppingCount}</div>
              <div className="lab">offene Einkaufspunkte</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card week-card">
        <div className="week-head">
          <div className="ttl">
            <span className="eyebrow">Familienplan · KW {weekNumber}</span>
            <h2 className="section">Diese Woche im Blick</h2>
          </div>
          <Link className="btn ghost sm" href="/planner">
            Plan bearbeiten →
          </Link>
        </div>
        <div className="week-grid">
          {weekSlots.map((slot) => {
            const empty = !slot.item;
            const tag = slot.item ? (slot.isToday ? "Heute Abend" : deriveTag(slot.item)) : null;
            return (
              <div
                key={slot.key}
                className={`day${slot.isToday ? " today" : ""}${empty ? " empty" : ""}`}
              >
                <div className="dlabel">
                  <b>{slot.short}</b>
                  <small>{format(slot.date, "d")}</small>
                </div>
                {empty ? (
                  <Link className="add-btn" href="/planner">
                    + Gericht wählen
                  </Link>
                ) : (
                  <>
                    {tag ? <span className="meal-tag">{tag}</span> : null}
                    <span className="meal-name">{slot.item!.title}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {seasonalRecipes.length > 0 ? (
        <>
          <div className="section-head">
            <div className="l">
              <span className="eyebrow">Saisonal</span>
              <h2 className="section">{seasonLabel(now)}sfavoriten aus Paprika</h2>
            </div>
            <Link href="/recipes">Alle {totalSeasonal} Rezepte →</Link>
          </div>
          <div className="rec-strip">
            {seasonalRecipes.map((r) => (
              <RecipeCard
                key={r.id}
                recipe={{
                  id: r.id,
                  name: r.name,
                  description: r.description,
                  ingredients: r.ingredients,
                  directions: r.directions,
                  notes: r.notes,
                  servings: r.servings,
                  prepTime: r.prepTime,
                  cookTime: r.cookTime,
                  totalTime: r.totalTime,
                  sourceUrl: r.sourceUrl,
                  rating: r.rating,
                  source: r.source,
                }}
              />
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
