import { redirect } from "next/navigation";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getMicrosoftConnection, listMicrosoftTodoLists } from "@/lib/microsoft";
import { ShoppingBoard, type ShoppingListData } from "./shopping-board";

type SearchParams = {
  error?: string;
  exported?: string;
  microsoft?: string;
  list?: string;
};

export default async function ShoppingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (!(await requireAuth())) redirect("/login");
  const params = await searchParams;

  const [lists, microsoftConnection] = await Promise.all([
    prisma.shoppingList.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { items: { orderBy: { order: "asc" } }, mealPlan: true },
    }),
    getMicrosoftConnection(),
  ]);

  let todoLists: { id: string; displayName: string }[] = [];
  let microsoftError = "";
  if (microsoftConnection) {
    try {
      todoLists = await listMicrosoftTodoLists();
    } catch (error) {
      microsoftError =
        error instanceof Error ? error.message : "Microsoft To Do Listen konnten nicht geladen werden";
    }
  }

  const requestedListId = params.list;
  const activeList =
    (requestedListId && lists.find((l) => l.id === requestedListId)) || lists[0] || null;

  const boardData: ShoppingListData | null = activeList
    ? {
        id: activeList.id,
        title: activeList.title,
        planTitle: activeList.mealPlan.title,
        microsoftListName: activeList.microsoftListName,
        items: activeList.items.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          category: i.category,
          source: i.source,
          checked: i.checked,
          microsoftTaskId: i.microsoftTaskId,
        })),
      }
    : null;

  const weekLabel = activeList ? format(activeList.mealPlan.startsOn, "II", { locale: de }) : null;

  return (
    <>
      <div className="page-head">
        <div className="left">
          <span className="eyebrow">{weekLabel ? `Einkauf · KW${"\u00a0"}${weekLabel}` : "Einkauf"}</span>
          <h1 className="display">
            Was muss <em>noch in den Korb?</em>
          </h1>
          <span className="sub">Auto-generiert aus deinem Wochenplan, gruppiert nach Abteilung.</span>
        </div>
        <div className="actions">
          {lists.length > 1 ? (
            <form method="get" style={{ display: "flex", gap: 8 }}>
              <select className="select" name="list" defaultValue={activeList?.id ?? ""} aria-label="Liste wählen">
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.mealPlan.title}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn ghost sm">
                Wechseln
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {params.error ? (
        <p role="alert" style={{ color: "var(--warn)", marginBottom: 18 }}>
          {decodeURIComponent(params.error)}
        </p>
      ) : null}
      {params.exported ? (
        <p role="status" style={{ color: "var(--forest)", marginBottom: 18 }}>
          {params.exported} Einträge nach Microsoft To Do exportiert.
        </p>
      ) : null}
      {params.microsoft === "connected" ? (
        <p role="status" style={{ color: "var(--forest)", marginBottom: 18 }}>
          Microsoft To Do verbunden.
        </p>
      ) : null}
      {microsoftError ? (
        <p role="alert" style={{ color: "var(--warn)", marginBottom: 18 }}>
          {microsoftError}
        </p>
      ) : null}

      <ShoppingBoard list={boardData} microsoftConnected={Boolean(microsoftConnection)} />

      {microsoftConnection && activeList ? (
        <form
          className="card card-pad"
          action="/api/microsoft/export-shopping"
          method="post"
          style={{ marginTop: 24 }}
        >
          <h3 style={{ margin: "0 0 14px", fontFamily: "var(--font-fraunces)", fontWeight: 500 }}>
            Nach Microsoft To Do exportieren
          </h3>
          <input type="hidden" name="shoppingListId" value={activeList.id} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label className="label" htmlFor="ms-list">
                Microsoft To Do Liste
              </label>
              <select
                id="ms-list"
                className="select"
                name="microsoftListId"
                defaultValue={
                  activeList.microsoftListId ||
                  todoLists.find((t) => t.displayName.toLowerCase().includes("einkauf"))?.id ||
                  todoLists[0]?.id ||
                  ""
                }
                required
              >
                <option value="" disabled>
                  Liste auswählen…
                </option>
                {todoLists.map((todo) => (
                  <option key={todo.id} value={todo.id}>
                    {todo.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ms-list-name">
                Listenname für Verlauf
              </label>
              <input
                id="ms-list-name"
                className="input"
                name="microsoftListName"
                defaultValue={activeList.microsoftListName || "Microsoft To Do"}
              />
            </div>
          </div>
          <label
            className="muted"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: ".88rem" }}
          >
            <input type="checkbox" name="includeChecked" /> Erledigte ebenfalls exportieren
          </label>
          <div style={{ marginTop: 14 }}>
            <button className="btn" type="submit">
              Neue Einträge senden
            </button>
          </div>
        </form>
      ) : null}

      {microsoftConnection ? (
        <div className="muted" style={{ marginTop: 18, fontSize: ".82rem", display: "flex", alignItems: "center", gap: 6 }}>
          <span>
            Verbunden als {microsoftConnection.accountEmail || microsoftConnection.accountName || "Microsoft"}
          </span>
          <span aria-hidden>·</span>
          <form action="/api/microsoft/disconnect" method="post">
            <button
              className="muted"
              type="submit"
              style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textDecoration: "underline", font: "inherit", color: "inherit" }}
            >
              trennen
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
