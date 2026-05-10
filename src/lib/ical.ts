/**
 * iCal-Generator (RFC 5545) für einen Wochenplan.
 *
 * Bewusst handgeschrieben — die spec ist klein genug, kein Bedarf für
 * eine Library. Wichtig sind drei Dinge:
 *   - CRLF-Zeilenenden ("\r\n"), sonst akzeptieren manche Clients (Apple
 *     Calendar, Outlook) die Datei nicht.
 *   - Escaping in TEXT-Feldern: backslash, semicolon, comma, newline.
 *   - Zeilen-Umbruch nach 75 Oktetten ("Folding"), getriggert mit "\r\n ".
 *
 * Wir erzeugen Ganztags-VEVENTs (`DTSTART;VALUE=DATE`), das passt zur
 * Logik des Plans (eine Mahlzeit pro Tag, ohne fixe Uhrzeit) und macht
 * die Anzeige in den meisten Kalender-Apps am ruhigsten.
 */

export type IcsEvent = {
  /** Stabile UID (ohne @-Suffix) — wir hängen die Domain selbst dran. */
  uid: string;
  /** Datum (lokal), Uhrzeit wird ignoriert. */
  date: Date;
  summary: string;
  description?: string;
};

const ICS_PROD_ID = "-//cookingbot//meal-plan//DE";
const LINE_LIMIT = 75; // RFC 5545 §3.1

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function toDateValue(date: Date): string {
  // VALUE=DATE → YYYYMMDD, lokale Zeit ohne TZID
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function toUtcStamp(date: Date): string {
  // DTSTAMP MUSS UTC sein → YYYYMMDDTHHMMSSZ
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

/** Escaped Text-Felder gemäß RFC 5545 §3.3.11. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

/**
 * Faltet eine Zeile so, dass keine länger als 75 Oktette ist.
 * Folding-Indikator: CRLF + Leerzeichen am Anfang der Folge-Zeile.
 */
export function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= LINE_LIMIT) return line;
  const chunks: string[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    const slice = bytes.subarray(offset, Math.min(offset + LINE_LIMIT, bytes.length));
    chunks.push(slice.toString("utf8"));
    offset += LINE_LIMIT;
  }
  return chunks.join("\r\n ");
}

/**
 * Erzeugt eine vollständige iCalendar-Datei aus einer Event-Liste.
 * @param hostname - wird als UID-Suffix benutzt, z.B. "cookingbot.example.com".
 */
export function buildIcs(events: IcsEvent[], hostname: string): string {
  const stamp = toUtcStamp(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${ICS_PROD_ID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const event of events) {
    const dtstart = toDateValue(event.date);
    // DTEND bei Ganztags = Folgetag, exklusiv (RFC 5545 §3.6.1)
    const next = new Date(event.date.getTime() + 24 * 60 * 60 * 1000);
    const dtend = toDateValue(next);
    lines.push("BEGIN:VEVENT");
    lines.push(foldLine(`UID:${event.uid}@${hostname}`));
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
    lines.push(`DTEND;VALUE=DATE:${dtend}`);
    lines.push(foldLine(`SUMMARY:${escapeIcsText(event.summary)}`));
    if (event.description) {
      lines.push(foldLine(`DESCRIPTION:${escapeIcsText(event.description)}`));
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
