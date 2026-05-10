/**
 * Smart-Shopping-Parser.
 *
 * Aufgabe: aus Rohzeilen wie
 *   "200 g Tomaten"
 *   "2 EL Olivenöl"
 *   "1 Zwiebel, in Würfeln"
 * deterministisch ein strukturiertes Objekt machen, damit identische
 * Zutaten über mehrere Rezepte hinweg zu einer Einkaufsposition
 * zusammengefasst werden können (gleiche Einheit → Mengen addieren).
 *
 * Bewusst keine LLM-Abhängigkeit — Aggregation muss schnell, gratis
 * und reproduzierbar sein. Synonyme + Plural-Formen werden über
 * `normalizePantryKey` (geteilt mit der Pantry) auf einen gemeinsamen
 * Schlüssel reduziert.
 *
 * Vorratszutaten (Salz, Pfeffer, Öl, …) werden NICHT mit Mengen
 * aggregiert, sondern in einem separaten "Hast du noch?"-Topf
 * eingesammelt — die kauft man eh nicht jede Woche neu.
 */
import { normalizePantryKey } from "@/lib/pantry";

export type ParsedIngredient = {
  /** Normalisierter Lookup-Key (gleicher Algorithmus wie Pantry). */
  key: string;
  /** Anzeigenname, capitalized. */
  name: string;
  /** Numerische Menge oder null wenn nicht parsebar ("etwas", "ein paar"). */
  quantity: number | null;
  /** Normierte Einheit (g, kg, ml, l, EL, TL, Stk, Prise, Bund, Dose, …) oder "". */
  unit: string;
  /** Ursprünglicher Roh-String, für Debug / Fallback. */
  original: string;
};

/**
 * Vorratszutaten-Set. Keys sind die Ausgabe von `normalizePantryKey()`,
 * d.h. lowercase, ohne Diakritika, Plural-grob entstrippt.
 *
 * Bewusst klein gehalten: nur was *wirklich* immer im Schrank steht.
 * Butter ist Grenzfall (verderblich) — bewusst NICHT drin.
 */
export const STAPLE_KEYS: ReadonlySet<string> = new Set([
  // grundlegende Würzbasis
  "salz",
  "pfeffer",
  "zucker",
  "mehl",
  // Öle / Essige
  "ol",
  "oliveno",
  "sonnenblumeno",
  "rapso",
  "essig",
  "balsamico",
  // Standard-Saucen
  "sojasauce",
  "honig",
  "senf",
  // gängige Trockengewürze
  "paprikapulv",
  "currypulv",
  "kreuzkumm",
  "kumin",
  "koriand",
  "zimt",
  "muskat",
  "lorbe",
  "thymian",
  "rosmarin",
  "oregano",
  "majoran",
  "chili",
  "cayenn",
  "kurkuma",
]);

/** Einheiten-Synonyme → kanonische Form. */
const UNIT_ALIASES: Record<string, string> = {
  g: "g",
  gr: "g",
  gramm: "g",
  kg: "kg",
  kilo: "kg",
  kilogramm: "kg",
  ml: "ml",
  l: "l",
  liter: "l",
  el: "EL",
  essl: "EL",
  esslöffel: "EL",
  essloffel: "EL",
  tl: "TL",
  tee: "TL",
  teelöffel: "TL",
  teeloffel: "TL",
  stk: "Stk",
  stück: "Stk",
  stueck: "Stk",
  prise: "Prise",
  prisen: "Prise",
  bund: "Bund",
  dose: "Dose",
  dosen: "Dose",
  packung: "Packung",
  pkg: "Packung",
  pck: "Packung",
  becher: "Becher",
  glas: "Glas",
};

/** Konvertiert "1/2", "1,5", "2.5" → number. */
function parseNumber(token: string): number | null {
  const t = token.replace(",", ".");
  // Bruch wie "1/2" oder "1 1/2"
  const fracMatch = t.match(/^(\d+)?\s*(\d+)\/(\d+)$/);
  if (fracMatch) {
    const whole = fracMatch[1] ? Number(fracMatch[1]) : 0;
    const num = Number(fracMatch[2]);
    const den = Number(fracMatch[3]);
    if (den === 0) return null;
    return whole + num / den;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Zerlegt eine Rohzeile in {quantity, unit, name}.
 * Algorithmus: erstes Token = Zahl? → quantity. Zweites Token = Einheit? → unit.
 * Rest = Name (Komma-Suffix wie "in Würfeln" wird abgeschnitten).
 */
export function parseIngredient(line: string): ParsedIngredient {
  const original = line.trim();
  // Komma-Suffix (Vorbereitungshinweise) abschneiden — aber NICHT, wenn das
  // Komma zwischen Ziffern steht (deutsche Dezimalschreibweise wie "1,5 kg").
  const headSep = original.search(/,(?!\d)/);
  const head = (headSep >= 0 ? original.slice(0, headSep) : original).trim();
  const tokens = head.split(/\s+/).filter(Boolean);

  let cursor = 0;
  let quantity: number | null = null;
  let unit = "";

  if (tokens.length > 0) {
    const q = parseNumber(tokens[0]);
    if (q !== null) {
      quantity = q;
      cursor = 1;
      // 2-Token-Bruch: "1 1/2"
      if (tokens.length > 1 && /^\d+\/\d+$/.test(tokens[1])) {
        const second = parseNumber(tokens[1]);
        if (second !== null) {
          quantity += second;
          cursor = 2;
        }
      }
    }
  }

  if (cursor < tokens.length) {
    const candidate = tokens[cursor].toLowerCase().replace(/\.$/, "");
    const aliasKey = candidate.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (UNIT_ALIASES[candidate]) {
      unit = UNIT_ALIASES[candidate];
      cursor += 1;
    } else if (UNIT_ALIASES[aliasKey]) {
      unit = UNIT_ALIASES[aliasKey];
      cursor += 1;
    }
  }

  const nameRaw = tokens.slice(cursor).join(" ").trim() || head;
  const name = nameRaw.charAt(0).toUpperCase() + nameRaw.slice(1);
  const key = normalizePantryKey(nameRaw);

  return { key, name, quantity, unit, original };
}

export type AggregatedItem = {
  /** Anzeigename. */
  name: string;
  /** Formatierte Mengenangabe (z.B. "350 g", "2 Stk", "" wenn unklar). */
  quantity: string;
  /** Quellen-Rezepte (für die UI: "Quelle: Pasta + Salat"). */
  sources: string[];
  /** Lookup-Key, intern. */
  key: string;
};

export type AggregateResult = {
  /** Zu kaufende Items, dedupliziert + Mengen summiert. */
  items: AggregatedItem[];
  /** Vorratszutaten zum Check ("Hast du noch?"). */
  staples: AggregatedItem[];
};

type AggregatorBucket = {
  name: string;
  key: string;
  /** Summen pro Einheit, "" = ohne Einheit. */
  unitSums: Map<string, number>;
  /** Zeilen ohne parsebare Menge. */
  unparsedQuantities: string[];
  sources: Set<string>;
};

function formatBucket(bucket: AggregatorBucket): AggregatedItem {
  const parts: string[] = [];
  for (const [unit, sum] of bucket.unitSums) {
    const rounded = Math.round(sum * 100) / 100;
    parts.push(unit ? `${rounded} ${unit}` : String(rounded));
  }
  if (bucket.unparsedQuantities.length > 0) {
    parts.push(...bucket.unparsedQuantities);
  }
  return {
    name: bucket.name,
    key: bucket.key,
    quantity: parts.join(" + "),
    sources: Array.from(bucket.sources),
  };
}

/**
 * Aggregiert Rohzeilen zu Einkaufspositionen.
 *
 * @param entries - Zeilen mit zugehörigem Quell-Rezept.
 * @param pantryKeys - Pantry-Schlüssel; matchende Items werden komplett ausgefiltert.
 * @returns Items + Staples (separate "Hast du noch?"-Liste).
 */
export function aggregateIngredients(
  entries: Array<{ line: string; source: string }>,
  pantryKeys: ReadonlySet<string> = new Set(),
): AggregateResult {
  const itemBuckets = new Map<string, AggregatorBucket>();
  const stapleBuckets = new Map<string, AggregatorBucket>();

  for (const entry of entries) {
    const parsed = parseIngredient(entry.line);
    if (!parsed.key) continue;
    if (pantryKeys.has(parsed.key)) continue; // schon im Vorrat → raus

    const isStaple = isStapleKey(parsed.key);
    const target = isStaple ? stapleBuckets : itemBuckets;
    const bucket = target.get(parsed.key) ?? {
      name: parsed.name,
      key: parsed.key,
      unitSums: new Map<string, number>(),
      unparsedQuantities: [],
      sources: new Set<string>(),
    };
    if (parsed.quantity !== null) {
      const prev = bucket.unitSums.get(parsed.unit) ?? 0;
      bucket.unitSums.set(parsed.unit, prev + parsed.quantity);
    } else {
      // Zeile ohne erkannte Menge → Original als Hinweis bewahren
      // (z.B. "Salz nach Geschmack", "etwas Olivenöl").
      const tail = parsed.original.trim();
      if (tail && !bucket.unparsedQuantities.includes(tail)) {
        bucket.unparsedQuantities.push(tail);
      }
    }
    bucket.sources.add(entry.source);
    target.set(parsed.key, bucket);
  }

  return {
    items: Array.from(itemBuckets.values()).map(formatBucket),
    staples: Array.from(stapleBuckets.values()).map(formatBucket),
  };
}

/**
 * Prüft, ob ein normalisierter Key zu einer Vorratszutat zählt.
 * Nutzt Prefix-Match, damit "olivenol" via Stamm "oliveno" trifft.
 */
export function isStapleKey(key: string): boolean {
  if (!key) return false;
  if (STAPLE_KEYS.has(key)) return true;
  for (const staple of STAPLE_KEYS) {
    if (key.startsWith(staple) || staple.startsWith(key)) return true;
  }
  return false;
}
