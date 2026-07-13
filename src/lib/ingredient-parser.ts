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
  "essig",
  "balsamico",
  // Standard-Saucen
  "sojasauce",
  "honig",
  "senf",
  // gängige Trockengewürze
  "kumin",
  "zimt",
  "muskat",
  "thymian",
  "rosmarin",
  "oregano",
  "majoran",
  "chili",
  "kurkuma",
]);

/**
 * Wortstämme, die per Präfix matchen dürfen, weil jede Fortsetzung des
 * Stamms noch dieselbe Vorratszutat meint ("oliveno" → Olivenöl/Olivenoel,
 * "paprikapulv" → Paprikapulver). Kurze Alltagswörter wie "salz" gehören
 * NICHT hierher — sonst würden Salzkartoffeln, Zuckerschoten oder
 * Mehlspeisen fälschlich als Vorrat aussortiert.
 */
export const STAPLE_STEMS: readonly string[] = [
  "oliveno",
  "sonnenblumeno",
  "rapso",
  "paprikapulv",
  "currypulv",
  "chilipulv",
  "chiliflock",
  "kreuzkumm",
  "koriand",
  "lorbe",
  "cayenn",
  "muskatnuss",
  "pfefferkorn",
];

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
  teel: "TL",
  teelöffel: "TL",
  teeloffel: "TL",
  stk: "Stk",
  stück: "Stk",
  stueck: "Stk",
  zehe: "Zehe",
  zehen: "Zehe",
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

/** Mengenwörter, die in Rezepten häufig statt Ziffern auftauchen. */
const NUMBER_WORDS: Record<string, number> = {
  ein: 1,
  eine: 1,
  einen: 1,
  einem: 1,
  einer: 1,
  eines: 1,
  eins: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  funf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
};

const APPROX_PREFIXES = new Set(["ca", "ca.", "circa", "etwa", "ungefähr", "ungefahr"]);

const LEADING_DESCRIPTORS = new Set([
  "klein",
  "kleine",
  "kleinen",
  "kleiner",
  "kleines",
  "mittelgroß",
  "mittelgross",
  "mittelgroße",
  "mittelgrosse",
  "mittelgroßen",
  "mittelgrossen",
  "groß",
  "gross",
  "große",
  "grosse",
  "großen",
  "grossen",
  "frisch",
  "frische",
  "frischen",
  "reif",
  "reife",
  "reifen",
  "rote",
  "roten",
  "süß",
  "suss",
  "suess",
  "süße",
  "susse",
  "suesse",
  "süßes",
  "susses",
  "suesses",
  "süßen",
  "sussen",
  "suessen",
  "gelbe",
  "gelben",
  "grune",
  "grüne",
  "grunen",
  "grünen",
  "weisse",
  "weiße",
  "weissen",
  "weißen",
]);

const CANONICAL_NAME_ALIASES: Record<string, string> = {
  paprikaschot: "Paprika",
  paprikaschote: "Paprika",
  salatgurk: "Gurke",
  salatgurke: "Gurke",
};

function normalizeToken(token: string): string {
  return token.toLowerCase().replace(/\.$/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss");
}

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

function parseQuantityToken(token: string): number | null {
  const numeric = parseNumber(token);
  if (numeric !== null) return numeric;
  return NUMBER_WORDS[normalizeToken(token)] ?? null;
}

function stripLeadingDescriptors(tokens: string[]): string[] {
  let cursor = 0;
  while (cursor < tokens.length && LEADING_DESCRIPTORS.has(normalizeToken(tokens[cursor]))) {
    cursor += 1;
  }
  return tokens.slice(cursor);
}

function stripNameNoise(value: string): string {
  return value
    .replace(/\((?:n|s|en)\)/gi, "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s+\boptional\b.*$/i, "")
    .replace(/\s+\bzum\s+servieren\b.*$/i, "")
    .replace(/\s+\bnach\s+geschmack\b.*$/i, "")
    .replace(/\s+\bin\s+(?:streifen|w[üu]rfeln|scheiben|st[üu]cke?n?)\b.*$/i, "")
    .replace(/\s+\bf[üu]r\s+(?:einen?|eine|den|die|das)?\s*(?:einfachen?\s+)?(?:beilagen)?salat\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalizeName(nameRaw: string): { name: string; key: string } {
  const cleaned = stripNameNoise(nameRaw);
  const key = normalizePantryKey(cleaned);
  const alias = CANONICAL_NAME_ALIASES[key];
  if (!alias) {
    return {
      name: cleaned.charAt(0).toUpperCase() + cleaned.slice(1),
      key,
    };
  }
  return { name: alias, key: normalizePantryKey(alias) };
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

  while (cursor < tokens.length && APPROX_PREFIXES.has(normalizeToken(tokens[cursor]))) {
    cursor += 1;
  }

  if (cursor < tokens.length) {
    const q = parseQuantityToken(tokens[cursor]);
    if (q !== null) {
      quantity = q;
      cursor += 1;
      // 2-Token-Bruch: "1 1/2"
      if (tokens.length > cursor && /^\d+\/\d+$/.test(tokens[cursor])) {
        const second = parseNumber(tokens[cursor]);
        if (second !== null) {
          quantity += second;
          cursor += 1;
        }
      }
    }
  }

  if (cursor < tokens.length) {
    const candidate = tokens[cursor].toLowerCase().replace(/\.$/, "");
    const aliasKey = normalizeToken(tokens[cursor]);
    if (UNIT_ALIASES[candidate]) {
      unit = UNIT_ALIASES[candidate];
      cursor += 1;
    } else if (UNIT_ALIASES[aliasKey]) {
      unit = UNIT_ALIASES[aliasKey];
      cursor += 1;
    }
  }

  const nameTokens = stripLeadingDescriptors(tokens.slice(cursor));
  const fallbackName = stripNameNoise(head);
  const nameRaw = nameTokens.join(" ").trim() || tokens.slice(cursor).join(" ").trim() || fallbackName;
  const { name, key } = canonicalizeName(nameRaw);

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

function canonicalQuantity(quantity: number, unit: string): { quantity: number; unit: string } {
  if (unit === "kg") return { quantity: quantity * 1000, unit: "g" };
  if (unit === "l") return { quantity: quantity * 1000, unit: "ml" };
  return { quantity, unit };
}

function formatNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
}

function formatQuantity(sum: number, unit: string): string {
  if (unit === "g" && sum >= 1000) return `${formatNumber(sum / 1000)} kg`;
  if (unit === "ml" && sum >= 1000) return `${formatNumber(sum / 1000)} l`;
  if (!unit) return `${formatNumber(sum)} Stk`;
  return `${formatNumber(sum)} ${unit}`;
}

function formatBucket(bucket: AggregatorBucket): AggregatedItem {
  const parts: string[] = [];
  for (const [unit, sum] of bucket.unitSums) {
    parts.push(formatQuantity(sum, unit));
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
      const canonical = canonicalQuantity(parsed.quantity, parsed.unit);
      const prev = bucket.unitSums.get(canonical.unit) ?? 0;
      bucket.unitSums.set(canonical.unit, prev + canonical.quantity);
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
 *
 * STAPLE_KEYS matchen nur exakt bzw. an Wortgrenzen ("grobes salz"),
 * damit Komposita wie Salzkartoffeln oder Zuckerschoten Einkaufsware
 * bleiben. STAPLE_STEMS matchen per Präfix am Wortanfang ("olivenol").
 */
export function isStapleKey(key: string): boolean {
  if (!key) return false;
  if (STAPLE_KEYS.has(key)) return true;
  const words = key.split(/\s+/);
  for (const word of words) {
    if (STAPLE_KEYS.has(word)) return true;
    for (const stem of STAPLE_STEMS) {
      if (word.startsWith(stem)) return true;
    }
  }
  return false;
}
