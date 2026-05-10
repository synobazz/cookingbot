import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { appUrl } from "@/lib/redirect";
import { deletePantryItem } from "@/lib/pantry";

/** Löscht einen Pantry-Eintrag (Form-Field `id`). */
export async function POST(req: NextRequest) {
  if (!(await requireAuth())) return NextResponse.redirect(appUrl(req, "/login"), 303);
  const form = await req.formData();
  const id = String(form.get("id") || "");
  if (id) await deletePantryItem(id);
  return NextResponse.redirect(appUrl(req, "/pantry?deleted=1"), 303);
}
