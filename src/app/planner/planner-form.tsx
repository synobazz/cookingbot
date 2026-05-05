"use client";

import { useState } from "react";
import { CheckIcon } from "../_components/icons";
import { DayToggleGroup, type DayToggleItem } from "../_components/day-toggle-group";
import { PeopleStepper } from "../_components/people-stepper";

type Props = {
  defaultStart: string;
  dayItems: DayToggleItem[];
  defaultDays: string[];
  defaultPeople: number;
};

function isoToDisplay(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
}

function displayToIso(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2})[.\-/\s](\d{1,2})[.\-/\s](\d{2}|\d{4})$/);
  if (!match) return null;
  const day = match[1]!.padStart(2, "0");
  const month = match[2]!.padStart(2, "0");
  const year = match[3]!.length === 2 ? `20${match[3]}` : match[3]!;
  const date = new Date(`${year}-${month}-${day}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getFullYear() !== Number(year) || date.getMonth() + 1 !== Number(month) || date.getDate() !== Number(day)) return null;
  return `${year}-${month}-${day}`;
}

function shiftDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function PlannerForm({ defaultStart, dayItems, defaultDays, defaultPeople }: Props) {
  const [days, setDays] = useState<string[]>(defaultDays);
  const [people, setPeople] = useState<number>(defaultPeople);
  const [start, setStart] = useState(defaultStart);
  const [startDisplay, setStartDisplay] = useState(isoToDisplay(defaultStart));

  function commitDisplayDate() {
    const parsed = displayToIso(startDisplay);
    if (!parsed) {
      setStartDisplay(isoToDisplay(start));
      return;
    }
    setStart(parsed);
    setStartDisplay(isoToDisplay(parsed));
  }

  function shiftStart(offset: number) {
    const next = shiftDays(start, offset);
    setStart(next);
    setStartDisplay(isoToDisplay(next));
  }

  return (
    <form action="/api/plan/generate" method="post" className="card card-pad">
      <h3>Neue Woche</h3>
      <div className="form-grid">
        <div>
          <label className="label" htmlFor="planner-start-display">
            Startdatum
          </label>
          <input type="hidden" name="start" value={start} />
          <div className="date-field">
            <button className="date-nudge" type="button" aria-label="Eine Woche zurück" onClick={() => shiftStart(-7)}>
              −7
            </button>
            <input
              className="input"
              id="planner-start-display"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={startDisplay}
              onChange={(event) => setStartDisplay(event.target.value)}
              onBlur={commitDisplayDate}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitDisplayDate();
                }
              }}
              placeholder="TT.MM.JJJJ"
            />
            <button className="date-nudge" type="button" aria-label="Eine Woche weiter" onClick={() => shiftStart(7)}>
              +7
            </button>
          </div>
        </div>
        <div>
          <label className="label">Personen</label>
          <PeopleStepper value={people} onChange={setPeople} />
        </div>
        <div>
          <label className="label">Welche Tage?</label>
          <DayToggleGroup items={dayItems} selected={days} onChange={setDays} />
        </div>
        <div>
          <label className="label" htmlFor="planner-notes">
            Wünsche / Constraints
          </label>
          <textarea
            className="textarea"
            id="planner-notes"
            name="notes"
            rows={4}
            placeholder="z. B. 2× schnell, 1× kindertauglich, Samstag darf aufwendiger sein…"
          />
        </div>
        <button className="btn forest block" type="submit" disabled={days.length === 0}>
          <CheckIcon />
          Plan generieren
        </button>
        <p className="muted" style={{ fontSize: ".78rem", textAlign: "center", margin: 0 }}>
          Dauert ~1–2&nbsp;Minuten
        </p>
      </div>
    </form>
  );
}
