"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon, ListCheckIcon, MenuIcon } from "./icons";
import { tileVariantFor, type TileVariant } from "./recipe-color-tile";
import { RecipeImageTile } from "./recipe-image-tile";
import { RecipeStars } from "./recipe-stars";

export type RecipeModalSubject = {
  id?: string | null;
  name: string;
  description?: string | null;
  ingredients?: string | null;
  directions?: string | null;
  notes?: string | null;
  servings?: string | null;
  prepTime?: string | null;
  cookTime?: string | null;
  totalTime?: string | null;
  sourceUrl?: string | null;
  rating?: number | null;
  source?: string | null;
};

type Props = {
  recipe: RecipeModalSubject;
  /** Optionaler vorgerenderter Titel (z. B. Plan-Item-Title weicht von recipe.name ab) */
  title?: string;
  /** Tile-Variante. Default: deterministisch aus recipe.id oder name. */
  variant?: TileVariant;
  /** Trigger-Button-Inhalt. Default: "Rezept öffnen" */
  triggerLabel?: React.ReactNode;
  /** Trigger-Button-Klasse. Default: "btn sm" */
  triggerClassName?: string;
};

function cleanRecipeText(value?: string | null) {
  if (!value) return "";
  return value
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(
      (line) =>
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:-\d+-\d+)?$/i.test(
          line.trim(),
        ),
    )
    .join("\n")
    .trim();
}

/** Splittet eine Zutaten-Zeile in [menge, name]. Heuristik: führende Zahl + optionale Einheit. */
function splitIngredientLine(line: string): { qty: string; name: string } {
  const trimmed = line.trim().replace(/^[-•*]\s*/, "");
  const m = trimmed.match(/^(\d+[.,]?\d*\s*(?:[a-zA-ZäöüÄÖÜ]+\.?)?)\s+(.+)$/);
  if (m) return { qty: m[1]!.trim(), name: m[2]!.trim() };
  return { qty: "", name: trimmed };
}

function parseIngredients(raw: string): { qty: string; name: string }[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map(splitIngredientLine);
}

function parseSteps(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean);
}

export function RecipeModal({
  recipe,
  title,
  variant,
  triggerLabel = "Rezept öffnen",
  triggerClassName = "btn sm",
}: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();

  const displayTitle = title || recipe.name || "Rezept";
  const ingredientsRaw = cleanRecipeText(recipe.ingredients);
  const directionsRaw = cleanRecipeText(recipe.directions);
  const notes = cleanRecipeText(recipe.notes);
  const description = cleanRecipeText(recipe.description);
  const ingredients = parseIngredients(ingredientsRaw);
  const steps = parseSteps(directionsRaw);
  const tileKey = recipe.id || displayTitle;
  const tileVariant: TileVariant = variant ?? tileVariantFor(tileKey);
  const meta = [
    recipe.servings ? `${recipe.servings} Portionen` : null,
    recipe.prepTime ? `${recipe.prepTime} Vorbereitung` : null,
    recipe.cookTime ? `${recipe.cookTime} Kochzeit` : null,
    !recipe.prepTime && !recipe.cookTime && recipe.totalTime ? `${recipe.totalTime} gesamt` : null,
  ].filter((v): v is string => Boolean(v));

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const modal = closeRef.current?.closest(".modal");
      if (!modal) return;
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button, a[href], textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      triggerRef.current?.focus();
    };
  }, [open]);

  const modal =
    open && mounted
      ? createPortal(
          <div
            className="modal-back"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby={headingId}
            >
              <RecipeImageTile recipeId={recipe.id} name={displayTitle} variant={tileVariant} className="modal-hero" priority>
                <button
                  ref={closeRef}
                  className="modal-close"
                  type="button"
                  aria-label="Schließen"
                  onClick={() => setOpen(false)}
                >
                  <CloseIcon />
                </button>
              </RecipeImageTile>
              <div className="modal-body">
                <span className="eyebrow">Rezept · Paprika-Cache</span>
                <h2 id={headingId}>{displayTitle}</h2>
                <div className="modal-meta">
                  {meta.map((m, i) => (
                    <span key={i}>
                      {i > 0 ? <span aria-hidden style={{ marginRight: 8 }}>·</span> : null}
                      {m}
                    </span>
                  ))}
                  {typeof recipe.rating === "number" && recipe.rating > 0 ? (
                    <>
                      {meta.length > 0 ? <span aria-hidden>·</span> : null}
                      <RecipeStars rating={recipe.rating} />
                    </>
                  ) : null}
                </div>
                {description ? (
                  <p className="muted" style={{ margin: "0 0 22px" }}>
                    {description}
                  </p>
                ) : null}
                <div className="modal-cols">
                  <div className="modal-panel ingredients">
                    <h4>
                      <MenuIcon />
                      Zutaten
                    </h4>
                    {ingredients.length ? (
                      <ul>
                        {ingredients.map((it, i) => (
                          <li key={i}>
                            <span style={{ color: "var(--ink)" }}>{it.name}</span>
                            <span>{it.qty || ""}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted" style={{ fontSize: ".88rem" }}>
                        Keine Zutaten hinterlegt.
                      </p>
                    )}
                  </div>
                  <div className="modal-panel steps">
                    <h4>
                      <ListCheckIcon />
                      Zubereitung
                    </h4>
                    {steps.length ? (
                      <ul>
                        {steps.map((s, i) => (
                          <li key={i}>
                            <span className="step-n">{i + 1}</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted" style={{ fontSize: ".88rem" }}>
                        Keine Anleitung hinterlegt.
                      </p>
                    )}
                  </div>
                </div>
                {notes ? (
                  <div className="modal-panel" style={{ marginTop: 22 }}>
                    <h4>Notizen</h4>
                    <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: ".92rem", lineHeight: 1.5 }}>
                      {notes}
                    </p>
                  </div>
                ) : null}
                {recipe.sourceUrl ? (
                  <p style={{ margin: "22px 0 0" }}>
                    <a
                      className="chip"
                      href={recipe.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Quelle öffnen ↗
                    </a>
                  </p>
                ) : null}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </button>
      {modal}
    </>
  );
}
