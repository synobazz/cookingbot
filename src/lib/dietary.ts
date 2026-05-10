/**
 * Persistente Diät-/Allergie-Constraints für die LLM-Planung.
 *
 * Werte liegen als JSON in `AppSetting`-Key `dietaryConstraints`. Wir lesen
 * sie pro Plan-/Remix-Generierung und hängen sie an den LLM-Prompt an, damit
 * Nutzer:innen das nicht jedes Mal manuell ins notes-Feld tippen müssen.
 *
 * Die Liste der Diät-Tags ist absichtlich klein und stabil — sie wird im UI
 * als Checkboxen angezeigt. Allergene/Abneigungen kommen als Freitext, weil
 * sie sehr persönlich sind ("kein Sellerie", "wenig scharf").
 */
import { prisma } from "@/lib/db";

export const DIET_TAGS = [
  { value: "vegetarian", label: "Vegetarisch" },
  { value: "vegan", label: "Vegan" },
  { value: "pescetarian", label: "Pescetarisch" },
  { value: "lactose-free", label: "Laktosefrei" },
  { value: "gluten-free", label: "Glutenfrei" },
  { value: "low-carb", label: "Low-Carb" },
  { value: "no-pork", label: "Kein Schweinefleisch" },
] as const;

export type DietTag = (typeof DIET_TAGS)[number]["value"];

export type DietaryConstraints = {
  /** Aktive Diät-Tags. */
  tags: DietTag[];
  /** Freitext mit Allergien, Abneigungen oder Zusatzregeln. */
  notes: string;
};

const DEFAULT: DietaryConstraints = { tags: [], notes: "" };

const SETTING_KEY = "dietaryConstraints";

const VALID_TAGS = new Set<string>(DIET_TAGS.map((t) => t.value));

function sanitize(value: unknown): DietaryConstraints {
  if (!value || typeof value !== "object") return { ...DEFAULT };
  const candidate = value as { tags?: unknown; notes?: unknown };
  const tags = Array.isArray(candidate.tags)
    ? candidate.tags.filter((t): t is DietTag => typeof t === "string" && VALID_TAGS.has(t))
    : [];
  const notes = typeof candidate.notes === "string" ? candidate.notes.slice(0, 800) : "";
  return { tags: Array.from(new Set(tags)), notes };
}

/** Lädt die persistierten Constraints; liefert leeres Objekt, wenn nichts gesetzt. */
export async function getDietaryConstraints(): Promise<DietaryConstraints> {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
  if (!row) return { ...DEFAULT };
  try {
    return sanitize(JSON.parse(row.value));
  } catch {
    return { ...DEFAULT };
  }
}

/** Persistiert die Constraints (überschreibt). */
export async function setDietaryConstraints(input: DietaryConstraints): Promise<void> {
  const clean = sanitize(input);
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    update: { value: JSON.stringify(clean) },
    create: { key: SETTING_KEY, value: JSON.stringify(clean) },
  });
}

/**
 * Formatiert Constraints als Klartext-Block für LLM-Prompts. Leer wenn nichts
 * gesetzt — der aufrufende Prompt sollte den Block in dem Fall ganz weglassen.
 */
export function formatConstraintsForPrompt(c: DietaryConstraints): string {
  if (c.tags.length === 0 && !c.notes.trim()) return "";
  const lines: string[] = [];
  if (c.tags.length > 0) {
    const labels = c.tags.map((t) => DIET_TAGS.find((d) => d.value === t)?.label ?? t);
    lines.push(`Diät: ${labels.join(", ")}`);
  }
  if (c.notes.trim()) lines.push(`Persönliche Regeln/Allergien: ${c.notes.trim()}`);
  return lines.join("\n");
}
