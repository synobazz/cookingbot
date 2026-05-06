import type { ShoppingList, ShoppingListItem } from "@prisma/client";
import { prisma } from "@/lib/db";
import { categorize, sortCategoryKey } from "@/lib/shopping-categories";

export type ShoppingListWithItems = ShoppingList & { items: ShoppingListItem[] };

/**
 * Lädt eine Einkaufsliste anhand ihrer ID inklusive Items, sortiert nach Order.
 */
export async function getShoppingListById(id: string): Promise<ShoppingListWithItems | null> {
  return prisma.shoppingList.findUnique({
    where: { id },
    include: { items: { orderBy: { order: "asc" } } },
  });
}

/**
 * Lädt die Einkaufsliste, die zu einem MealPlan gehört (1:1-Relation).
 */
export async function getShoppingListByMealPlan(
  mealPlanId: string,
): Promise<ShoppingListWithItems | null> {
  return prisma.shoppingList.findUnique({
    where: { mealPlanId },
    include: { items: { orderBy: { order: "asc" } } },
  });
}

/** Liefert die zuletzt aktualisierten Einkaufslisten (default: 6). */
export async function listShoppingLists(limit = 6): Promise<ShoppingListWithItems[]> {
  return prisma.shoppingList.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { items: { orderBy: { order: "asc" } } },
  });
}

export type ShoppingItemGroup = {
  category: string;
  label: string;
  items: ShoppingListItem[];
};

/**
 * Gruppiert Items nach Kategorie. Wenn ein Item keine `category` hat, wird sie aus dem Namen
 * abgeleitet. Reihenfolge der Gruppen folgt {@link CATEGORY_ORDER}.
 */
export function groupShoppingItems(items: ShoppingListItem[]): ShoppingItemGroup[] {
  const buckets = new Map<string, ShoppingListItem[]>();
  for (const item of items) {
    const key = (item.category && item.category.trim()) || categorize(item.name);
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => sortCategoryKey(a[0]) - sortCategoryKey(b[0]))
    .map(([category, list]) => ({
      category,
      label: category,
      items: list,
    }));
}
