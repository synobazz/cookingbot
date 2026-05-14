"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CartIcon, ChevronDownIcon, DownloadIcon, TrashIcon } from "../_components/icons";
import { categorize, sortCategoryKey, STAPLE_CHECK_CATEGORY } from "@/lib/shopping-categories";
import { useToast } from "../_components/toast";
import { PendingForm, PendingButton } from "../_components/pending-form";

export type ShoppingItem = {
  id: string;
  name: string;
  quantity: string | null;
  category: string | null;
  source: string | null;
  checked: boolean;
  microsoftTaskId: string | null;
};

export type ShoppingListData = {
  id: string;
  title: string;
  planTitle: string;
  microsoftListName: string | null;
  items: ShoppingItem[];
};

type Props = {
  list: ShoppingListData | null;
  microsoftConnected: boolean;
  restoreAvailable: boolean;
};

function groupItems(items: ShoppingItem[]) {
  const map = new Map<string, ShoppingItem[]>();
  for (const item of items) {
    const cat = item.category && item.category.trim() ? item.category.trim() : categorize(item.name);
    const existing = map.get(cat);
    if (existing) existing.push(item);
    else map.set(cat, [item]);
  }
  return Array.from(map.entries()).sort((a, b) => sortCategoryKey(a[0]) - sortCategoryKey(b[0]));
}

export function ShoppingBoard({ list, microsoftConnected, restoreAvailable }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [items, setItems] = useState<ShoppingItem[]>(list?.items ?? []);
  const [hideDone, setHideDone] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => groupItems(items), [items]);
  const total = items.length;
  const doneCount = items.filter((i) => i.checked).length;
  const exportedCount = items.filter((i) => i.microsoftTaskId).length;
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  function toggleCollapsed(cat: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  async function toggleItem(item: ShoppingItem) {
    const previous = item.checked;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, checked: !previous } : i)));
    try {
      const res = await fetch("/api/shopping/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ itemId: item.id, ajax: "1" }),
      });
      if (!res.ok) throw new Error("toggle failed");
      startTransition(() => router.refresh());
    } catch {
      // revert
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, checked: previous } : i)));
      toast.error(`„${item.name}“ konnte nicht aktualisiert werden`);
    }
  }

  if (!list) {
    return (
      <div className="card" style={{ padding: 32, textAlign: "center" }}>
        <p className="muted" style={{ margin: 0 }}>
          Noch keine Einkaufsliste vorhanden. Erstelle einen Plan und generiere daraus eine Liste.
        </p>
        {restoreAvailable ? (
          <PendingForm action="/api/shopping/bulk" method="post" style={{ marginTop: 18 }} pendingMessage="Liste wird wiederhergestellt…">
            <input type="hidden" name="action" value="restore" />
            <PendingButton className="btn ghost" type="submit">
              Liste wiederherstellen
            </PendingButton>
          </PendingForm>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="shop-progress" style={{ ["--p" as string]: pct } as React.CSSProperties}>
        <div className="shop-ring" style={{ ["--p" as string]: pct } as React.CSSProperties}>
          <span>{pct}%</span>
        </div>
        <div className="meta">
          <h3>
            {doneCount} von {total} erledigt
          </h3>
          <p>
            {list.planTitle} · {total - doneCount} offen · {exportedCount} in Microsoft To Do
          </p>
        </div>
        <div className="acts">
          <button
            type="button"
            className="btn ghost"
            onClick={() => setHideDone((v) => !v)}
            aria-pressed={hideDone}
          >
            <TrashIcon /> {hideDone ? "Alle anzeigen" : "Erledigte ausblenden"}
          </button>
          <button type="button" className="btn" onClick={() => window.print()}>
            <DownloadIcon /> Drucken
          </button>
        </div>
      </div>

      <div className="shop-bulk-actions">
        <PendingForm action="/api/shopping/bulk" method="post" pendingMessage="Markiere alle als erledigt…">
          <input type="hidden" name="shoppingListId" value={list.id} />
          <input type="hidden" name="action" value="complete" />
          <PendingButton className="btn ghost" type="submit" disabled={total === 0 || doneCount === total}>
            Alle als erledigt markieren
          </PendingButton>
        </PendingForm>
        <PendingForm action="/api/shopping/bulk" method="post" pendingMessage="Liste wird gelöscht…">
          <input type="hidden" name="shoppingListId" value={list.id} />
          <input type="hidden" name="action" value="delete" />
          <PendingButton className="btn ghost" type="submit" disabled={total === 0}>
            Liste löschen
          </PendingButton>
        </PendingForm>
        <PendingForm action="/api/shopping/bulk" method="post" pendingMessage="Liste wird wiederhergestellt…">
          <input type="hidden" name="action" value="restore" />
          <PendingButton className="btn ghost" type="submit" disabled={!restoreAvailable}>
            Liste wiederherstellen
          </PendingButton>
        </PendingForm>
      </div>

      {!microsoftConnected ? (
        <div className="ms-banner">
          <div className="ms-icon" aria-hidden>
            <CartIcon />
          </div>
          <div className="ms-text">
            <h4>Microsoft To Do verbinden</h4>
            <p>Schick offene Einkaufspunkte direkt als Aufgaben in deine „Einkauf"-Liste.</p>
          </div>
          <form action="/api/microsoft/connect" method="post">
            <button className="btn" type="submit">
              Verbinden
            </button>
          </form>
        </div>
      ) : null}

      {grouped.map(([category, catItems]) => {
        const visible = hideDone ? catItems.filter((i) => !i.checked) : catItems;
        if (visible.length === 0) return null;
        const isCollapsed = collapsed.has(category);
        const doneInCat = catItems.filter((i) => i.checked).length;
        const isStapleBlock = category === STAPLE_CHECK_CATEGORY;
        return (
          <div
            key={category}
            className={`shop-cat${isCollapsed ? " collapsed" : ""}${isStapleBlock ? " shop-staples" : ""}`}
          >
            <button
              type="button"
              className="shop-cat-head"
              onClick={() => toggleCollapsed(category)}
              aria-expanded={!isCollapsed}
              style={{ background: "transparent", border: 0, width: "100%", padding: 0, textAlign: "left" }}
            >
              <h4>{category}</h4>
              <span className="count">
                {isStapleBlock
                  ? `${catItems.length} Vorrat-Check · abhaken, was du noch hast`
                  : `${catItems.length} Artikel · ${doneInCat} erledigt`}
              </span>
              <ChevronDownIcon className="ico chev" />
            </button>
            <div className="shop-list">
              {visible.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`shop-item${item.checked ? " done" : ""}`}
                  onClick={() => toggleItem(item)}
                  aria-pressed={item.checked}
                >
                  <span className="shop-check" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  </span>
                  <span className="ttl">
                    <b>{item.name}</b>
                    {item.source ? <span>{item.source}</span> : null}
                  </span>
                  {item.quantity ? <span className="qty">{item.quantity}</span> : null}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
