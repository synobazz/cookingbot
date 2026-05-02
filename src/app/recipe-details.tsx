import { Recipe } from "@prisma/client";

export function RecipeDetails({ recipe, fallbackIngredients, fallbackInstructions }: { recipe?: Recipe | null; fallbackIngredients?: string; fallbackInstructions?: string }) {
  const ingredients = recipe?.ingredients || fallbackIngredients || "";
  const directions = recipe?.directions || fallbackInstructions || "";
  const notes = recipe?.notes || "";
  const description = recipe?.description || "";

  if (!ingredients && !directions && !notes && !description) return null;

  return (
    <details className="recipe-details">
      <summary className="recipe-summary badge">Rezept anzeigen</summary>
      <div className="recipe-body">
        {description ? <p>{description}</p> : null}
        {ingredients ? <section><h4>Zutaten</h4><pre>{ingredients}</pre></section> : null}
        {directions ? <section><h4>Zubereitung</h4><pre>{directions}</pre></section> : null}
        {notes ? <section><h4>Notizen</h4><pre>{notes}</pre></section> : null}
      </div>
    </details>
  );
}
