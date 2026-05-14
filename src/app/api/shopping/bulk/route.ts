import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { appUrl } from "@/lib/redirect";
import { guardSameOrigin } from "@/lib/same-origin";

const BACKUP_KEY = "lastDeletedShoppingList";

const InputSchema = z.object({
  action: z.enum(["complete", "delete", "restore"]),
  shoppingListId: z.string().optional().default(""),
});

type ShoppingListBackup = {
  deletedAt: string;
  list: {
    mealPlanId: string;
    title: string;
    microsoftListId?: string | null;
    microsoftListName?: string | null;
    lastMicrosoftSyncAt?: string | null;
    items: {
      name: string;
      quantity?: string | null;
      category?: string | null;
      checked: boolean;
      source?: string | null;
      order: number;
      microsoftTaskId?: string | null;
      microsoftTaskUrl?: string | null;
      microsoftSyncedAt?: string | null;
    }[];
  };
};

function redirectShopping(req: NextRequest, params: Record<string, string>) {
  const search = new URLSearchParams(params);
  return NextResponse.redirect(appUrl(req, `/shopping?${search.toString()}`), 303);
}

export async function POST(req: NextRequest) {
  const csrf = guardSameOrigin(req);
  if (csrf) return csrf;
  if (!(await requireAuth())) return NextResponse.redirect(appUrl(req, "/login"), 303);

  const form = await req.formData();
  const parsed = InputSchema.safeParse({
    action: String(form.get("action") || ""),
    shoppingListId: String(form.get("shoppingListId") || ""),
  });
  if (!parsed.success) return redirectShopping(req, { error: "Ungültige Eingabe" });

  const { action, shoppingListId } = parsed.data;

  if (action === "complete") {
    if (!shoppingListId) return redirectShopping(req, { error: "Keine Einkaufsliste gewählt" });
    await prisma.shoppingListItem.updateMany({ where: { shoppingListId }, data: { checked: true } });
    return redirectShopping(req, { list: shoppingListId, completed: "all" });
  }

  if (action === "delete") {
    if (!shoppingListId) return redirectShopping(req, { error: "Keine Einkaufsliste gewählt" });
    const list = await prisma.shoppingList.findUnique({
      where: { id: shoppingListId },
      include: { items: { orderBy: { order: "asc" } } },
    });
    if (!list) return redirectShopping(req, { error: "Einkaufsliste nicht gefunden" });

    const backup: ShoppingListBackup = {
      deletedAt: new Date().toISOString(),
      list: {
        mealPlanId: list.mealPlanId,
        title: list.title,
        microsoftListId: list.microsoftListId,
        microsoftListName: list.microsoftListName,
        lastMicrosoftSyncAt: list.lastMicrosoftSyncAt?.toISOString() ?? null,
        items: list.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          category: item.category,
          checked: item.checked,
          source: item.source,
          order: item.order,
          microsoftTaskId: item.microsoftTaskId,
          microsoftTaskUrl: item.microsoftTaskUrl,
          microsoftSyncedAt: item.microsoftSyncedAt?.toISOString() ?? null,
        })),
      },
    };

    await prisma.$transaction([
      prisma.appSetting.upsert({
        where: { key: BACKUP_KEY },
        create: { key: BACKUP_KEY, value: JSON.stringify(backup) },
        update: { value: JSON.stringify(backup) },
      }),
      prisma.shoppingList.delete({ where: { id: shoppingListId } }),
    ]);
    return redirectShopping(req, { deleted: "shopping-list" });
  }

  const setting = await prisma.appSetting.findUnique({ where: { key: BACKUP_KEY } });
  if (!setting) return redirectShopping(req, { error: "Keine gelöschte Liste zum Wiederherstellen gefunden" });

  let backup: ShoppingListBackup;
  try {
    backup = JSON.parse(setting.value) as ShoppingListBackup;
  } catch {
    return redirectShopping(req, { error: "Backup der Einkaufsliste ist beschädigt" });
  }

  const existing = await prisma.shoppingList.findUnique({ where: { mealPlanId: backup.list.mealPlanId } });
  if (existing) return redirectShopping(req, { list: existing.id, error: "Für diesen Plan existiert bereits eine Einkaufsliste" });

  const restored = await prisma.$transaction(async (tx) => {
    const created = await tx.shoppingList.create({
      data: {
        mealPlanId: backup.list.mealPlanId,
        title: backup.list.title,
        microsoftListId: backup.list.microsoftListId || "",
        microsoftListName: backup.list.microsoftListName || "",
        lastMicrosoftSyncAt: backup.list.lastMicrosoftSyncAt ? new Date(backup.list.lastMicrosoftSyncAt) : undefined,
        items: {
          create: backup.list.items.map((item) => ({
            name: item.name,
            quantity: item.quantity || "",
            category: item.category || "",
            checked: item.checked,
            source: item.source || "",
            order: item.order,
            microsoftTaskId: item.microsoftTaskId || "",
            microsoftTaskUrl: item.microsoftTaskUrl || "",
            microsoftSyncedAt: item.microsoftSyncedAt ? new Date(item.microsoftSyncedAt) : undefined,
          })),
        },
      },
    });
    // Backup nach erfolgreichem Restore entfernen, damit Folge-Restores nicht duplizieren.
    await tx.appSetting.delete({ where: { key: BACKUP_KEY } });
    return created;
  });
  return redirectShopping(req, { list: restored.id, restored: "shopping-list" });
}
