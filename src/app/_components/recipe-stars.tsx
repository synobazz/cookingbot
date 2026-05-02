type Props = {
  rating?: number | null; // 0..5, kann auch float (4.5)
  max?: number;
  className?: string;
};

export function RecipeStars({ rating, max = 5, className }: Props) {
  const r = Math.max(0, Math.min(max, Math.round(rating ?? 0)));
  return (
    <div
      className={["recipe-stars", className].filter(Boolean).join(" ")}
      aria-label={`Bewertung ${r} von ${max}`}
    >
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={i < r ? undefined : "off"}>
          ★
        </span>
      ))}
    </div>
  );
}
