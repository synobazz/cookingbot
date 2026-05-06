/**
 * Undo-Backup für MCP-Write-Operationen auf MealItems.
 *
 * Vor jedem destruktiven Tool-Aufruf (z. B. `replaceMealForDay`,
 * `setMealForDay`) speichern wir einen JSON-Snapshot des betroffenen
 * MealItem in `AppSetting["lastMealItemChange"]`. Das Tool
 * `undoLastMealChange` liest diesen Snapshot zurück und stellt das
 * MealItem wieder her.
 *
 * Bewusst nur eine Ebene Undo — kein Stack. Mehr braucht's für den
 * "ich hab Mist gebaut, mach das letzte rückgängig"-Use-Case nicht
 * und der User behält die Übersicht.
 */
import type { MealItem } from "@prisma/client";
import { prisma } from "@/lib/db";

const KEY = "lastMealItemChange";

export type MealItemSnapshot = {
  capturedAt: string;
  action: string;
  item: {
    id: string;
    mealPlanId: string;
    date: string; // ISO
    dayName: string;
    title: string;
    recipeId: string | null;
    isRemix: boolean;
    remixSource: string | null;
    reasoning: string | null;
    ingredients: string;
    instructions: string;
  };
};

/** Speichert einen Snapshot des MealItem als zuletzt rückgängig-machbare Änderung. */
export async function captureMealItemBackup(item: MealItem, action: string): Promise<void> {
  const snapshot: MealItemSnapshot = {
    capturedAt: new Date().toISOString(),
    action,
    item: {
      id: item.id,
      mealPlanId: item.mealPlanId,
      date: item.date.toISOString(),
      dayName: item.dayName,
      title: item.title,
      recipeId: item.recipeId,
      isRemix: item.isRemix,
      remixSource: item.remixSource,
      reasoning: item.reasoning,
      ingredients: item.ingredients,
      instructions: item.instructions,
    },
  };
  await prisma.appSetting.upsert({
    where: { key: KEY },
    update: { value: JSON.stringify(snapshot) },
    create: { key: KEY, value: JSON.stringify(snapshot) },
  });
}

/** Liest den letzten Backup-Snapshot oder `null`, wenn keiner existiert oder er korrupt ist. */
export async function readMealItemBackup(): Promise<MealItemSnapshot | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
  if (!row) return null;
  try {
    return JSON.parse(row.value) as MealItemSnapshot;
  } catch {
    return null;
  }
}

/** Entfernt den Backup-Eintrag, z. B. nach erfolgreichem Undo. */
export async function clearMealItemBackup(): Promise<void> {
  await prisma.appSetting.deleteMany({ where: { key: KEY } });
}
