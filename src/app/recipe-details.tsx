"use client";

import { useEffect, useId, useState } from "react";

type RecipeLike = {
  name: string;
  description?: string | null;
  ingredients?: string | null;
  directions?: string | null;
  notes?: string | null;
  servings?: string | null;
  prepTime?: string | null;
  cookTime?: string | null;
  totalTime?: string | null;
  imageUrl?: string | null;
  photoUrl?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
};

function cleanRecipeText(value?: string | null) {
  if (!value) return "";
  return value
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:-\d+-\d+)?$/i.test(line.trim()))
    .join("\n")
    .trim();
}

function imageFor(recipe?: RecipeLike | null) {
  const url = recipe?.photoUrl || recipe?.imageUrl || "";
  if (/^(https?:|data:image\/)/.test(url)) return url;
  return "";
}

export function RecipeDetails({ recipe, title, fallbackIngredients, fallbackInstructions }: { recipe?: RecipeLike | null; title?: string; fallbackIngredients?: string; fallbackInstructions?: string }) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const displayTitle = title || recipe?.name || "Rezept";
  const ingredients = cleanRecipeText(fallbackIngredients || recipe?.ingredients);
  const directions = cleanRecipeText(fallbackInstructions || recipe?.directions);
  const notes = cleanRecipeText(recipe?.notes);
  const description = cleanRecipeText(recipe?.description);
  const image = imageFor(recipe);
  const meta = [recipe?.servings, recipe?.prepTime, recipe?.cookTime, recipe?.totalTime].filter(Boolean).join(" · ");

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!ingredients && !directions && !notes && !description && !image) return null;

  return (
    <>
      <button className="button secondary recipe-open-button" type="button" onClick={() => setOpen(true)}>Rezept anzeigen</button>
      {open ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="recipe-modal" role="dialog" aria-modal="true" aria-labelledby={headingId}>
            <button className="modal-close" type="button" aria-label="Rezept schließen" onClick={() => setOpen(false)}>×</button>
            {image ? <img className="recipe-hero-image" src={image} alt="" /> : null}
            <div className="recipe-modal-content">
              <div className="eyebrow">Rezept</div>
              <h2 id={headingId}>{displayTitle}</h2>
              {meta ? <p className="muted">{meta}</p> : null}
              {description ? <p>{description}</p> : null}
              <div className="recipe-body">
                {ingredients ? <section><h4>Zutaten</h4><pre>{ingredients}</pre></section> : null}
                {directions ? <section><h4>Zubereitung</h4><pre>{directions}</pre></section> : null}
                {notes ? <section><h4>Notizen</h4><pre>{notes}</pre></section> : null}
              </div>
              {recipe?.sourceUrl ? <p><a className="badge" href={recipe.sourceUrl} target="_blank" rel="noreferrer">Quelle öffnen</a></p> : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
