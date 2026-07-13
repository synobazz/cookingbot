import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { isUnsafeDinnerRecipe, safeJson, seasonForDate } from "@/lib/planning";
import { RecipeCard } from "../_components/recipe-card";
import { RecipeFilters, type FilterTag } from "../_components/recipe-filters";
import { RefreshIcon } from "../_components/icons";
import { PendingForm, PendingButton } from "../_components/pending-form";

type SearchParams = {
  q?: string;
  tag?: string;
  sort?: string;
  error?: string;
  synced?: string;
  skipped?: string;
  failed?: string;
};

const TAGS: FilterTag[] = [
  { id: "all", label: "Alle" },
  { id: "quick", label: "Schnell" },
  { id: "vegetarian", label: "Vegetarisch" },
  { id: "kids", label: "Kindertauglich" },
  { id: "seasonal", label: "Saisonal" },
  { id: "mealprep", label: "Meal Prep" },
  { id: "soup", label: "Suppe" },
];

function matchesCategory(cats: string[], patterns: RegExp[]) {
  return cats.some((c) => patterns.some((p) => p.test(c)));
}

function passesTag(
  recipe: { totalTime?: string | null; cookTime?: string | null; categoriesJson: string; name: string },
  tag: string,
  now: Date,
) {
  if (tag === "all") return true;
  const cats = safeJson<string[]>(recipe.categoriesJson, []);
  if (tag === "quick") {
    const t = recipe.totalTime || recipe.cookTime || "";
    const minutes = parseInt(t.replace(/\D/g, ""), 10);
    return Number.isFinite(minutes) && minutes > 0 && minutes <= 25;
  }
  if (tag === "vegetarian") return matchesCategory(cats, [/vegetarisch/i, /vegan/i, /veggie/i]);
  if (tag === "kids") return matchesCategory(cats, [/kinder/i, /familie/i, /family/i]);
  if (tag === "soup") return matchesCategory(cats, [/suppe/i, /soup/i, /eintopf/i]);
  if (tag === "mealprep") return matchesCategory(cats, [/meal\s*prep/i, /vorbereit/i, /lunchbox/i]);
  if (tag === "seasonal") {
    const season = seasonForDate(now);
    const seasonMap: Record<string, RegExp[]> = {
      spring: [/frühling/i, /spring/i, /spargel/i, /bärlauch/i, /rhabarber/i],
      summer: [/sommer/i, /summer/i, /grill/i, /tomate/i, /beeren/i, /melone/i],
      autumn: [/herbst/i, /autumn/i, /kürbis/i, /pilz/i, /apfel/i, /maroni/i],
      winter: [/winter/i, /eintopf/i, /kohl/i, /grünkohl/i, /rotkohl/i, /braten/i],
    };
    return matchesCategory(cats, seasonMap[season] || []);
  }
  return true;
}

type RecipeIndexItem = {
  id: string;
  name: string;
  categoriesJson: string;
  totalTime: string | null;
  cookTime: string | null;
  rating: number;
  lastSyncedAt: Date;
};

function applySort(list: RecipeIndexItem[], sort: string) {
  const arr = [...list];
  if (sort === "name") arr.sort((a, b) => a.name.localeCompare(b.name, "de"));
  else if (sort === "synced")
    arr.sort((a, b) => b.lastSyncedAt.getTime() - a.lastSyncedAt.getTime());
  else
    arr.sort(
      (a, b) =>
        (b.rating || 0) - (a.rating || 0) ||
        b.lastSyncedAt.getTime() - a.lastSyncedAt.getTime(),
    );
  return arr;
}

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (!(await requireAuth())) redirect("/login");
  const params = await searchParams;
  const q = (params.q || "").trim();
  const tag = params.tag || "all";
  const sort = params.sort || "rating";

  const where: Prisma.RecipeWhereInput = {
    inTrash: false,
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { description: { contains: q } },
            { ingredients: { contains: q } },
          ],
        }
      : {}),
  };

  // Für Filter/Sortierung nur kleine Metadaten laden. Zutaten, Anweisungen,
  // Notes und Bildfelder sind groß und werden erst für die 48 sichtbaren
  // Karten nachgeladen.
  const [indexItems, totalCount, latestSync] = await Promise.all([
    prisma.recipe.findMany({
      where,
      take: 600,
      select: {
        id: true,
        name: true,
        categoriesJson: true,
        totalTime: true,
        cookTime: true,
        rating: true,
        lastSyncedAt: true,
      },
    }),
    prisma.recipe.count({ where }),
    prisma.recipe.findFirst({ where, orderBy: { lastSyncedAt: "desc" }, select: { lastSyncedAt: true } }),
  ]);
  const now = new Date();
  const filtered = indexItems.filter((r) => passesTag(r, tag, now));
  const sorted = applySort(filtered, sort);
  const visibleIds = sorted.slice(0, 48).map((recipe) => recipe.id);
  const visibleRows = await prisma.recipe.findMany({ where: { id: { in: visibleIds } } });
  const visibleById = new Map(visibleRows.map((recipe) => [recipe.id, recipe]));
  const visible = visibleIds.flatMap((id) => {
    const recipe = visibleById.get(id);
    return recipe ? [recipe] : [];
  });
  const lastSync = latestSync?.lastSyncedAt ?? null;
  const syncSummary = params.synced
    ? [
        `${params.synced} aktualisiert`,
        params.skipped ? `${params.skipped} unverändert` : null,
        params.failed ? `${params.failed} fehlgeschlagen` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <>
      <div className="page-head">
        <div className="left">
          <span className="eyebrow">Paprika · lokaler Cache</span>
          <h1 className="display">
            Rezepte<em>.</em>
          </h1>
          <span className="sub">
            {totalCount} Rezepte
            {lastSync ? ` · zuletzt synchronisiert vor ${formatDistanceToNow(lastSync, { locale: de })}` : ""}
          </span>
        </div>
        <div className="actions">
          <PendingForm action="/api/sync/paprika" method="post" pendingMessage="Paprika wird synchronisiert…">
            <PendingButton className="btn ghost" type="submit">
              <RefreshIcon /> Jetzt synchronisieren
            </PendingButton>
          </PendingForm>
          <Link className="btn" href="/planner">
            Neue Woche planen
          </Link>
        </div>
      </div>

      {syncSummary ? (
        <p role="status" className="muted" style={{ marginTop: -10, marginBottom: 18 }}>
          {syncSummary}.
        </p>
      ) : null}
      {params.error ? (
        <p role="alert" style={{ color: "var(--warn)", marginTop: -10, marginBottom: 18 }}>
          Sync fehlgeschlagen: {decodeURIComponent(params.error)}
        </p>
      ) : null}

      <RecipeFilters tags={TAGS} totalCount={filtered.length} />

      {visible.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <p className="muted" style={{ margin: 0 }}>
            Keine Rezepte für diese Filter.
          </p>
        </div>
      ) : (
        <div className="rec-grid">
          {visible.map((r) => {
            const unsafe = isUnsafeDinnerRecipe(r);
            const excluded = r.excludeFromPlanning;
            const topChip = unsafe || excluded
              ? { label: "Nicht für Plan", tone: "warn" as const }
              : r.rating >= 5
                ? { label: "Lieblingsrezept", tone: "gold" as const }
                : undefined;
            return (
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
                topChip={topChip}
                extra={
                  <PendingForm action="/api/recipes/toggle-planning" method="post" pendingMessage={excluded ? "Wird wieder eingeplant…" : "Wird ausgeschlossen…"}>
                    <input type="hidden" name="recipeId" value={r.id} />
                    <PendingButton className="btn ghost sm" type="submit">
                      {excluded ? "Einplanen" : "Ausschließen"}
                    </PendingButton>
                  </PendingForm>
                }
              />
            );
          })}
        </div>
      )}

      {sorted.length > visible.length ? (
        <p className="muted" style={{ marginTop: 18, textAlign: "center" }}>
          Zeige {visible.length} von {sorted.length}. Verfeinere die Filter, um mehr zu finden.
        </p>
      ) : null}
    </>
  );
}
