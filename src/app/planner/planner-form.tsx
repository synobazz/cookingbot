"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon } from "../_components/icons";
import { DayToggleGroup, type DayToggleItem } from "../_components/day-toggle-group";
import { PeopleStepper } from "../_components/people-stepper";
import { PendingForm } from "../_components/pending-form";

type Props = {
  defaultStart: string;
  dayItems: DayToggleItem[];
  defaultDays: string[];
  defaultPeople: number;
};

const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const months = ["Jänner", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

function localIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isoToDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year || new Date().getFullYear(), (month || 1) - 1, day || 1);
}

function isoToDisplay(value: string) {
  const date = isoToDate(value);
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
}

function displayToIso(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2})[.\-/\s](\d{1,2})[.\-/\s](\d{2}|\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]!.length === 2 ? `20${match[3]}` : match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) return null;
  return localIso(date);
}

function shiftDays(value: string, days: number) {
  const date = isoToDate(value);
  date.setDate(date.getDate() + days);
  return localIso(date);
}

function calendarDates(year: number, month: number) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function PlannerForm({ defaultStart, dayItems, defaultDays, defaultPeople }: Props) {
  const [days, setDays] = useState<string[]>(defaultDays);
  const [people, setPeople] = useState<number>(defaultPeople);
  const [start, setStart] = useState(defaultStart);
  const [startDisplay, setStartDisplay] = useState(isoToDisplay(defaultStart));
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const selectedDate = isoToDate(start);
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());
  const dates = useMemo(() => calendarDates(viewYear, viewMonth), [viewYear, viewMonth]);
  const today = localIso(new Date());

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) setPickerOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function setDate(value: string) {
    const date = isoToDate(value);
    setStart(value);
    setStartDisplay(isoToDisplay(value));
    setViewYear(date.getFullYear());
    setViewMonth(date.getMonth());
  }

  function commitDisplayDate() {
    const parsed = displayToIso(startDisplay);
    if (!parsed) {
      setStartDisplay(isoToDisplay(start));
      return;
    }
    setDate(parsed);
  }

  function shiftStart(offset: number) {
    setDate(shiftDays(start, offset));
  }

  function shiftMonth(offset: number) {
    const next = new Date(viewYear, viewMonth + offset, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  return (
    <PendingForm
      action="/api/plan/generate"
      method="post"
      className="card card-pad"
      pendingMessage="Plan wird erstellt…"
      pendingDetail="Dauert ~1–2 Minuten"
    >
      <h3>Neue Woche</h3>
      <div className="form-grid">
        <div>
          <label className="label" htmlFor="planner-start-display">
            Startdatum
          </label>
          <input type="hidden" name="start" value={start} />

          <div className="desktop-date-wrap" ref={pickerRef}>
            <div className="date-field desktop-date-field">
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
                onFocus={() => setPickerOpen(true)}
                onChange={(event) => setStartDisplay(event.target.value)}
                onBlur={commitDisplayDate}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitDisplayDate();
                    setPickerOpen(false);
                  }
                }}
                placeholder="TT.MM.JJJJ"
              />
              <button className="date-picker-toggle" type="button" aria-label="Kalender öffnen" aria-expanded={pickerOpen} onClick={() => setPickerOpen((open) => !open)}>
                ▾
              </button>
              <button className="date-nudge" type="button" aria-label="Eine Woche weiter" onClick={() => shiftStart(7)}>
                +7
              </button>
            </div>

            {pickerOpen ? (
              <div className="date-popover" role="dialog" aria-label="Kalender zur Datumsauswahl">
                <div className="date-popover-head">
                  <button type="button" className="date-month-btn" aria-label="Vorheriger Monat" onClick={() => shiftMonth(-1)}>‹</button>
                  <strong>{months[viewMonth]} {viewYear}</strong>
                  <button type="button" className="date-month-btn" aria-label="Nächster Monat" onClick={() => shiftMonth(1)}>›</button>
                </div>
                <div className="date-weekdays" aria-hidden="true">
                  {weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
                </div>
                <div className="date-grid">
                  {dates.map((date) => {
                    const iso = localIso(date);
                    return (
                      <button
                        key={iso}
                        type="button"
                        className={`date-day${date.getMonth() !== viewMonth ? " muted" : ""}${iso === start ? " selected" : ""}${iso === today ? " today" : ""}`}
                        onClick={() => {
                          setDate(iso);
                          setPickerOpen(false);
                        }}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div className="date-field mobile-date-field">
            <button className="date-nudge" type="button" aria-label="Eine Woche zurück" onClick={() => shiftStart(-7)}>
              −7
            </button>
            <input className="input" type="date" value={start} onChange={(event) => setDate(event.target.value)} aria-label="Startdatum" />
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
    </PendingForm>
  );
}
