"use client";

import { ClockIcon, PeopleIcon } from "./icons";
import { tileVariantFor, type TileVariant } from "./recipe-color-tile";
import { RecipeImageTile } from "./recipe-image-tile";
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
      <RecipeModal
        recipe={recipe}
        variant={v}
        triggerClassName="recipe-image-trigger"
        triggerLabel={
          <RecipeImageTile recipeId={recipe.id} name={recipe.name} variant={v}>
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
          </RecipeImageTile>
        }
      />
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
        {extra ? (
          <div style={{ marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {extra}
          </div>
        ) : null}
      </div>
    </article>
  );
}
