"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { SearchIcon } from "./icons";

export type FilterTag = { id: string; label: string };

type Props = {
  tags: FilterTag[];
  totalCount: number;
};

const SORT_OPTIONS = [
  { value: "rating", label: "Bewertung" },
  { value: "name", label: "Name (A–Z)" },
  { value: "synced", label: "Zuletzt synchronisiert" },
];

export function RecipeFilters({ tags, totalCount }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const activeTag = searchParams.get("tag") || "all";
  const activeSort = searchParams.get("sort") || "rating";
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);

  // Debounce ?q=
  useEffect(() => {
    const handle = setTimeout(() => {
      const current = searchParams.get("q") || "";
      if (current === query) return;
      const params = new URLSearchParams(searchParams.toString());
      if (query) params.set("q", query);
      else params.delete("q");
      startTransition(() => router.replace(`/recipes?${params.toString()}`));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, router, searchParams]);

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === "" || (key === "tag" && value === "all") || (key === "sort" && value === "rating")) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    startTransition(() => router.replace(`/recipes${params.toString() ? `?${params.toString()}` : ""}`));
  }

  const activeFilterCount = (activeTag !== "all" ? 1 : 0) + (query ? 1 : 0);

  return (
    <>
      <form
        className="search-bar"
        onSubmit={(e) => {
          e.preventDefault();
        }}
        role="search"
      >
        <SearchIcon style={{ marginLeft: 14, color: "var(--muted)" }} />
        <input
          className="input"
          placeholder="Suche nach Risotto, Curry, …"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Rezepte durchsuchen"
        />
        {query ? (
          <button className="btn sm" style={{ marginRight: 6 }} type="button" onClick={() => setQuery("")}>
            Leeren
          </button>
        ) : null}
      </form>

      <div className="filters-row">
        {tags.map((tag) => {
          const on = activeTag === tag.id;
          return (
            <button
              key={tag.id}
              type="button"
              className={`filter-pill${on ? " on" : ""}`}
              aria-pressed={on}
              onClick={() => setParam("tag", on ? null : tag.id)}
            >
              {tag.label}
              {on && tag.id !== "all" ? <span className="x" aria-hidden> ✕</span> : null}
            </button>
          );
        })}
        <div className="filters-spacer" />
        <div className="sort-dd">
          <label htmlFor="recipes-sort">Sortieren:</label>
          <select
            id="recipes-sort"
            value={activeSort}
            onChange={(e) => setParam("sort", e.target.value)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="recipe-count" aria-live="polite">
        {isPending ? "Filter werden angewendet…" : `${totalCount} Rezepte${activeFilterCount ? ` · ${activeFilterCount} Filter aktiv` : ""}`}
      </div>
    </>
  );
}
