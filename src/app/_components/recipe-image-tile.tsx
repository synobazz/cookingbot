"use client";

import { useState } from "react";
import { glyphFor, tileVariantFor, type TileVariant } from "./recipe-color-tile";

type Props = {
  recipeId?: string | null;
  name: string;
  variant?: TileVariant;
  className?: string;
  children?: React.ReactNode;
  priority?: boolean;
};

export function RecipeImageTile({ recipeId, name, variant, className, children, priority = false }: Props) {
  const [failed, setFailed] = useState(false);
  const v = variant ?? tileVariantFor(recipeId || name);
  const showImage = Boolean(recipeId) && !failed;

  return (
    <div className={["recipe-img", v, showImage ? "has-photo" : "", className].filter(Boolean).join(" ")}>
      {showImage ? (
        <img
          className="recipe-photo"
          src={`/api/recipe-image/${encodeURIComponent(recipeId!)}`}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="recipe-img-glyph" aria-hidden>
          {glyphFor(name)}
        </span>
      )}
      {children}
    </div>
  );
}
