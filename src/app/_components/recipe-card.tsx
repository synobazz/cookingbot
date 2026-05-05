"use client";

import { ClockIcon, PeopleIcon } from "./icons";
import { glyphFor, tileVariantFor, type TileVariant } from "./recipe-color-tile";
import { RecipeModal, type RecipeModalSubject } from "./recipe-modal";
import { RecipeStars } from "./recipe-stars";

type Props = {
  recipe: RecipeModalSubject;
  variant?: TileVariant;
  topChip?: { label: string; tone?: "default" | "forest" | "terra" | "warn" | "gold" };
  showFavorite?: boolean;
  extra?: React.ReactNode;
};

export function RecipeCard({ recipe, variant, topChip, showFavorite = false, extra }: Props) {
  const v = variant ?? tileVariantFor(recipe.id || recipe.name);
  const time = recipe.totalTime || recipe.cookTime || recipe.prepTime;
  return (
    <article className="recipe-card">
      <div className={`recipe-img ${v}`}>
        <span className="recipe-img-glyph" aria-hidden>
          {glyphFor(recipe.name)}
        </span>
        {topChip ? (
          <div className="recipe-meta">
            <span className={`chip${topChip.tone && topChip.tone !== "default" ? " " + topChip.tone : ""}`}>
              {topChip.label}
            </span>
          </div>
        ) : null}
        {showFavorite ? (
          <span className="recipe-fav" aria-hidden>
            ♡
          </span>
        ) : null}
      </div>
      <div className="recipe-info">
        {typeof recipe.rating === "number" && recipe.rating > 0 ? (
          <RecipeStars rating={recipe.rating} />
        ) : null}
        <h4>{recipe.name}</h4>
        <div className="recipe-meta-2">
          {time ? (
            <span>
              <ClockIcon />
              {time}
            </span>
          ) : null}
          {recipe.servings ? (
            <span>
              <PeopleIcon />
              {recipe.servings}
            </span>
          ) : null}
        </div>
        <div style={{ marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <RecipeModal recipe={recipe} variant={v} triggerLabel="Öffnen" triggerClassName="btn ghost sm" />
          {extra}
        </div>
      </div>
    </article>
  );
}
