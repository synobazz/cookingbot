"use client";

type Props = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  name?: string;
};

export function PeopleStepper({ value, onChange, min = 1, max = 6, step = 0.5, name = "people" }: Props) {
  function clamp(n: number) {
    return Math.min(max, Math.max(min, Math.round(n / step) * step));
  }

  return (
    <div className="people-stepper" role="group" aria-label="Personen">
      <button type="button" aria-label="Weniger" onClick={() => onChange(clamp(value - step))}>
        −
      </button>
      <span className="v" aria-live="polite">
        {value.toString().replace(".", ",")}
      </span>
      <button type="button" aria-label="Mehr" onClick={() => onChange(clamp(value + step))}>
        +
      </button>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
