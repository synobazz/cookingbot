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

export function PlannerForm({ defaultStart, dayItems, defaultDays, defaultPeople }: Props) {
  const [days, setDays] = useState<string[]>(defaultDays);
  const [people, setPeople] = useState<number>(defaultPeople);

  return (
    <form action="/api/plan/generate" method="post" className="card card-pad">
      <h3>Neue Woche</h3>
      <div className="form-grid">
        <div>
          <label className="label" htmlFor="planner-start">
            Startdatum
          </label>
          <input className="input" id="planner-start" type="date" name="start" defaultValue={defaultStart} />
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
