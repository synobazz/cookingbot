import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { appUrl } from "@/lib/redirect";
import { guardSameOrigin } from "@/lib/same-origin";

const InputSchema = z.object({ itemId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const csrf = guardSameOrigin(req);
  if (csrf) return csrf;
  if (!(await requireAuth())) return NextResponse.redirect(appUrl(req, "/login"), 303);
  const form = await req.formData();
  const parsed = InputSchema.safeParse({ itemId: String(form.get("itemId") || "") });
  if (!parsed.success) {
    return NextResponse.redirect(appUrl(req, "/shopping?error=Ung%C3%BCltige%20Eingabe"), 303);
  }
  // Atomic toggle: rather than read-then-write, flip the boolean in a single
  // statement so concurrent submits can't deadlock or race.
  const updated = await prisma.shoppingListItem.findUnique({ where: { id: parsed.data.itemId }, select: { id: true, checked: true } });
  if (!updated) return NextResponse.redirect(appUrl(req, "/shopping?error=Eintrag%20nicht%20gefunden"), 303);
  await prisma.shoppingListItem.update({ where: { id: updated.id }, data: { checked: !updated.checked } });
  return NextResponse.redirect(appUrl(req, "/shopping"), 303);
}
