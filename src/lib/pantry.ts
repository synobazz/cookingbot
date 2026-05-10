/**
 * Vorratskammer ("Pantry") — was schon zu Hause ist und nicht in die
 * Einkaufsliste gehört.
 *
 * Wichtig ist die Normalisierung: ein Eintrag "Olivenöl" muss "Öl" /
 * "Olivenoel" / "olivenÖl" matchen, sonst landet das Zeug doch wieder
 * auf der Einkaufsliste. Die Normalisierung ist bewusst konservativ
 * (lowercase, Diakritika weg, Plural-s/n weg, mehrfaches Whitespace
 * gequetscht) und teilt sich die Routine mit dem Smart-Shopping-Parser.
 */
import type { PantryItem } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Normalisiert einen Zutaten-/Pantry-Namen für Vergleiche.
 *
 * Beispiele:
 *   "Olivenöl"      -> "olivenoel"
 *   "Tomaten"       -> "tomate"
 *   "  Salz "       -> "salz"
 *   "Bio-Karotten"  -> "bio karotte"
 *
 * Sehr einfache Heuristik, kein Lemmatizer — reicht für den Anwendungsfall
 * (deutsche Küche, klein gehaltene Pantry-Liste). Wird auch von
 * `lib/ingredient-parser.ts` verwendet, damit Pantry-Match und Smart-
 * Aggregation immer den gleichen Schlüssel benutzen.
 */
export function normalizePantryKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Diakritika weg
    .replace(/ß/g, "ss")
    .replace(/ä/g, "a") // diese 3 Replacements treffen NUR die Composed-Form,
    .replace(/ö/g, "o") // sind nach NFD aber meist schon weg — schaden nicht.
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9\s-]/g, " ") // Sonderzeichen raus
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    // Plural-Endungen sehr grob entfernen (nur wenn das Wort >= 4 Zeichen hat,
    // sonst werden "Eier" -> "Ei" Edge-Cases riskanter)
    .split(" ")
    .map((token) => {
      if (token.length < 4) return token;
      // -en, -er, -e, -n, -s am Ende
      return token.replace(/(en|er|e|n|s)$/, "");
    })
    .join(" ");
}

export async function listPantryItems(): Promise<PantryItem[]> {
  return prisma.pantryItem.findMany({ orderBy: { name: "asc" } });
}

/**
 * Fügt einen Pantry-Eintrag hinzu oder aktualisiert ihn (idempotent über `key`).
 * Liefert das gespeicherte Item zurück.
 */
export async function upsertPantryItem(input: {
  name: string;
  quantity?: string;
  expiresOn?: Date | null;
}): Promise<PantryItem> {
  const name = input.name.trim();
  if (!name) throw new Error("Name darf nicht leer sein");
  const key = normalizePantryKey(name);
  if (!key) throw new Error("Name enthält keine sinnvollen Zeichen");

  return prisma.pantryItem.upsert({
    where: { key },
    update: {
      name,
      quantity: input.quantity?.trim() ?? "",
      expiresOn: input.expiresOn ?? null,
    },
    create: {
      key,
      name,
      quantity: input.quantity?.trim() ?? "",
      expiresOn: input.expiresOn ?? null,
    },
  });
}

export async function deletePantryItem(id: string): Promise<void> {
  await prisma.pantryItem.delete({ where: { id } }).catch(() => undefined);
}

/**
 * Liefert ein Set normalisierter Pantry-Schlüssel — bereit zum Lookup
 * gegen den parsing-output `parsed.key` aus `lib/ingredient-parser.ts`.
 */
export async function loadPantryKeySet(): Promise<Set<string>> {
  const items = await prisma.pantryItem.findMany({ select: { key: true } });
  return new Set(items.map((item) => item.key));
}
