import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createMicrosoftTodoTask } from "@/lib/microsoft";

export async function POST(req: NextRequest) {
  if (!(await requireAuth())) return NextResponse.redirect(new URL("/login", req.url), 303);
  const form = await req.formData();
  const shoppingListId = String(form.get("shoppingListId") || "");
  const microsoftListId = String(form.get("microsoftListId") || "");
  const microsoftListName = String(form.get("microsoftListName") || "Microsoft To Do");
  const includeChecked = form.get("includeChecked") === "on";
  if (!shoppingListId || !microsoftListId) {
    return NextResponse.redirect(new URL("/shopping?error=Bitte%20To%20Do-Liste%20ausw%C3%A4hlen", req.url), 303);
  }

  try {
    const list = await prisma.shoppingList.findUnique({
      where: { id: shoppingListId },
      include: { items: { orderBy: { order: "asc" } } },
    });
    if (!list) return NextResponse.redirect(new URL("/shopping?error=Einkaufsliste%20nicht%20gefunden", req.url), 303);

    const items = list.items.filter((item) => !item.microsoftTaskId && (includeChecked || !item.checked));
    let exported = 0;
    for (const item of items) {
      const task = await createMicrosoftTodoTask(microsoftListId, item);
      await prisma.shoppingListItem.update({
        where: { id: item.id },
        data: {
          microsoftTaskId: task.id,
          microsoftTaskUrl: task.webUrl || "",
          microsoftSyncedAt: new Date(),
        },
      });
      exported += 1;
    }

    await prisma.shoppingList.update({
      where: { id: list.id },
      data: { microsoftListId, microsoftListName, lastMicrosoftSyncAt: new Date() },
    });

    return NextResponse.redirect(new URL(`/shopping?exported=${exported}`, req.url), 303);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Microsoft To Do Export fehlgeschlagen";
    return NextResponse.redirect(new URL(`/shopping?error=${encodeURIComponent(message)}`, req.url), 303);
  }
}
