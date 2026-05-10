import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { appUrl } from "@/lib/redirect";
import { DIET_TAGS, type DietTag, setDietaryConstraints } from "@/lib/dietary";

const VALID = new Set<string>(DIET_TAGS.map((t) => t.value));

/**
 * Speichert die persistenten Diät- und Allergie-Constraints.
 * Erwartet ein klassisches FormPost mit Feldern:
 *   - tag: jeweils ein Wert pro aktivem Tag (Checkbox `name="tag"` value=tag-key)
 *   - notes: Freitext mit Allergien/Abneigungen
 */
export async function POST(req: NextRequest) {
  if (!(await requireAuth())) return NextResponse.redirect(appUrl(req, "/login"), 303);
  const form = await req.formData();
  const rawTags = form.getAll("tag").map((value) => String(value));
  const tags = rawTags.filter((value): value is DietTag => VALID.has(value));
  const notes = String(form.get("notes") || "").slice(0, 800);
  await setDietaryConstraints({ tags, notes });
  return NextResponse.redirect(appUrl(req, "/settings?saved=dietary"), 303);
}
