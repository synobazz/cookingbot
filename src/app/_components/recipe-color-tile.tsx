// Deterministische Farb-Zuweisung pro Recipe-ID + zwei-Buchstaben-Glyph aus dem Namen.
// Glyph wird via .recipe-img-glyph gerendert.

const TILE_VARIANTS = [
  "sage",
  "terra",
  "forest",
  "gold",
  "olive",
  "berry",
  "cream",
  "ink",
] as const;

export type TileVariant = (typeof TILE_VARIANTS)[number];

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function tileVariantFor(id: string): TileVariant {
  return TILE_VARIANTS[hashString(id) % TILE_VARIANTS.length]!;
}

export function glyphFor(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "··";
  const letters = trimmed.replace(/\s+/g, "");
  if (letters.length === 1) return letters[0]!.toUpperCase();
  return (letters[0]! + letters[1]!).replace(/^./, (c) => c.toUpperCase());
}

type Props = {
  recipeId: string;
  name: string;
  variant?: TileVariant;
  className?: string;
  children?: React.ReactNode;
};

export function RecipeColorTile({ recipeId, name, variant, className, children }: Props) {
  const v = variant ?? tileVariantFor(recipeId);
  return (
    <div className={["recipe-img", v, className].filter(Boolean).join(" ")}>
      <span className="recipe-img-glyph" aria-hidden>
        {glyphFor(name)}
      </span>
      {children}
    </div>
  );
}
