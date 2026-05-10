import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { appUrl } from "@/lib/redirect";
import { upsertPantryItem } from "@/lib/pantry";

/**
 * Fügt einen Vorratseintrag hinzu (oder aktualisiert ihn anhand des
 * normalisierten Schlüssels).
 * Form-Felder: name, quantity (optional), expiresOn (optional, ISO).
 */
export async function POST(req: NextRequest) {
  if (!(await requireAuth())) return NextResponse.redirect(appUrl(req, "/login"), 303);
  const form = await req.formData();
  const name = String(form.get("name") || "").trim();
  if (!name) {
    return NextResponse.redirect(appUrl(req, "/pantry?error=name-fehlt"), 303);
  }
  const quantity = String(form.get("quantity") || "").trim();
  const expiresRaw = String(form.get("expiresOn") || "").trim();
  let expiresOn: Date | null = null;
  if (expiresRaw) {
    const candidate = new Date(`${expiresRaw}T00:00:00`);
    if (!Number.isNaN(candidate.getTime())) expiresOn = candidate;
  }
  try {
    await upsertPantryItem({ name, quantity, expiresOn });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Eintrag konnte nicht gespeichert werden";
    return NextResponse.redirect(appUrl(req, `/pantry?error=${encodeURIComponent(message)}`), 303);
  }
  return NextResponse.redirect(appUrl(req, "/pantry?saved=1"), 303);
}
