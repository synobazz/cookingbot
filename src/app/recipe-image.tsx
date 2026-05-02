"use client";

import { useState } from "react";

export function RecipeImage({ recipeId, className, placeholderClassName = "recipe-card-placeholder", priority = false }: { recipeId?: string | null; className: string; placeholderClassName?: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!recipeId || failed) return <div className={placeholderClassName}>🍲</div>;
  return (
    <img
      className={className}
      src={`/api/recipe-image/${encodeURIComponent(recipeId)}`}
      alt=""
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
