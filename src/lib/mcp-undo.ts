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
 *
 * Race-Condition-Schutz: `withMealItemBackup` wickelt Backup + Mutation
 * in einer einzigen `prisma.$transaction` ab. Damit ist garantiert, dass
 * paralleler Tool-Calls entweder beide ihren Snapshot atomar wegschreiben
 * oder einen Konflikt sehen — niemals "Backup von A, Update von B" ohne
 * passendes Backup. SQLite serialisiert Writes ohnehin, aber wir verlassen
 * uns nicht auf das Engine-Detail.
 */
import type { MealItem, Prisma } from "@prisma/client";
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

type TxClient = Prisma.TransactionClient;

function snapshotFromItem(item: MealItem, action: string): MealItemSnapshot {
  return {
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
}

/**
 * Atomare "Backup + Mutation"-Klammer. Ruft den `mutate`-Callback innerhalb
 * einer Prisma-Transaktion auf, nachdem das Backup geschrieben wurde. Wenn
 * `mutate` wirft, wird die ganze Transaktion zurückgerollt — auch das Backup,
 * sodass ein gescheiterter Aufruf keine "scheinbar rückgängig-machbaren"
 * Zustände hinterlässt.
 *
 * Der Aufrufer bekommt den Tx-Client als Parameter und MUSS ihn für seine
 * eigenen DB-Operationen nutzen, damit alles in derselben Transaktion bleibt.
 */
export async function withMealItemBackup<T>(args: {
  item: MealItem;
  action: string;
  mutate: (tx: TxClient) => Promise<T>;
}): Promise<T> {
  const snapshot = snapshotFromItem(args.item, args.action);
  return prisma.$transaction(async (tx) => {
    await tx.appSetting.upsert({
      where: { key: KEY },
      update: { value: JSON.stringify(snapshot) },
      create: { key: KEY, value: JSON.stringify(snapshot) },
    });
    return args.mutate(tx);
  });
}

/**
 * Schreibt nur das Backup, ohne Mutation. Wird aktuell von Tools genutzt, die
 * ihre Mutation außerhalb einer Transaktion ausführen müssen (z. B. der
 * Replan-Pfad ruft das LLM auf — das soll nicht innerhalb einer DB-Tx passieren,
 * sonst hält die Tx unnötig lange).
 *
 * Aufrufer sind dafür verantwortlich, das Backup nach einem fehlgeschlagenen
 * Mutationsversuch wieder zu verwerfen (`clearMealItemBackup`), damit der
 * Undo-Slot nicht "vergiftet" zurückbleibt.
 */
export async function captureMealItemBackup(item: MealItem, action: string): Promise<void> {
  const snapshot = snapshotFromItem(item, action);
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
