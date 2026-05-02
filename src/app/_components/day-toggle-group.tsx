"use client";

import { useId } from "react";

export type DayToggleItem = {
  value: string;
  short: string;
  dateNumber: number;
};

type Props = {
  items: DayToggleItem[];
  selected: string[];
  onChange: (next: string[]) => void;
  name?: string;
};

export function DayToggleGroup({ items, selected, onChange, name = "days" }: Props) {
  const groupId = useId();
  const selectedSet = new Set(selected);

  function toggle(value: string) {
    const next = new Set(selectedSet);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(items.map((i) => i.value).filter((v) => next.has(v)));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>, idx: number) {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const target = (idx + dir + items.length) % items.length;
      const buttons = e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button.day-toggle");
      buttons?.[target]?.focus();
    }
  }

  return (
    <div className="day-toggles" role="group" aria-labelledby={groupId}>
      <span id={groupId} className="sr-only">
        Tage auswählen
      </span>
      {items.map((item, idx) => {
        const on = selectedSet.has(item.value);
        return (
          <button
            key={item.value}
            type="button"
            className={`day-toggle${on ? " on" : ""}`}
            aria-pressed={on}
            onClick={() => toggle(item.value)}
            onKeyDown={(e) => onKeyDown(e as unknown as React.KeyboardEvent<HTMLDivElement>, idx)}
          >
            <b>{item.short}</b>
            <span>{item.dateNumber}</span>
          </button>
        );
      })}
      {/* Hidden inputs damit Form-Submit funktioniert */}
      {items
        .filter((i) => selectedSet.has(i.value))
        .map((i) => (
          <input key={i.value} type="hidden" name={name} value={i.value} />
        ))}
    </div>
  );
}
