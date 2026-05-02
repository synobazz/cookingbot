import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { appUrl } from "@/lib/redirect";

export async function POST(req: NextRequest) {
  if (!(await requireAuth())) return NextResponse.redirect(appUrl(req, "/login"), 303);
  const form = await req.formData();
  const itemId = String(form.get("itemId") || "");
  const item = await prisma.shoppingListItem.findUnique({ where: { id: itemId } });
  if (!item) return NextResponse.redirect(appUrl(req, "/shopping?error=Eintrag%20nicht%20gefunden"), 303);
  await prisma.shoppingListItem.update({ where: { id: item.id }, data: { checked: !item.checked } });
  return NextResponse.redirect(appUrl(req, "/shopping"), 303);
}
