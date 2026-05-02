import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getMicrosoftConnection, listMicrosoftTodoLists } from "@/lib/microsoft";

export default async function ShoppingPage({ searchParams }: { searchParams: Promise<{ error?: string; exported?: string; microsoft?: string }> }) {
  if (!(await requireAuth())) redirect("/login");
  const params = await searchParams;
  const [lists, microsoftConnection] = await Promise.all([
    prisma.shoppingList.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { items: { orderBy: { order: "asc" } }, mealPlan: true } }),
    getMicrosoftConnection(),
  ]);

  let todoLists: { id: string; displayName: string }[] = [];
  let microsoftError = "";
  if (microsoftConnection) {
    try {
      todoLists = await listMicrosoftTodoLists();
    } catch (error) {
      microsoftError = error instanceof Error ? error.message : "Microsoft To Do Listen konnten nicht geladen werden";
    }
  }

  return (
    <div className="grid">
      <section className="card">
        <div className="eyebrow">Einkauf · V2</div>
        <h1>Einkaufslisten</h1>
        <p>Interne Liste mit direktem Export einzelner Einkaufspunkte als Aufgaben nach Microsoft To Do.</p>
        {params.exported ? <p style={{ color: "#15803d" }}>{params.exported} Einträge nach Microsoft To Do exportiert.</p> : null}
        {params.microsoft === "connected" ? <p style={{ color: "#15803d" }}>Microsoft To Do verbunden.</p> : null}
        {params.microsoft === "disconnected" ? <p className="muted">Microsoft To Do getrennt.</p> : null}
        {params.error ? <p style={{ color: "#b91c1c" }}>{decodeURIComponent(params.error)}</p> : null}
        {microsoftError ? <p style={{ color: "#b91c1c" }}>{microsoftError}</p> : null}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {microsoftConnection ? (
            <>
              <span className="badge">Verbunden: {microsoftConnection.accountEmail || microsoftConnection.accountName || "Microsoft"}</span>
              <form action="/api/microsoft/disconnect" method="post"><button className="button secondary" type="submit">Microsoft trennen</button></form>
            </>
          ) : (
            <form action="/api/microsoft/connect" method="post"><button className="button" type="submit">Microsoft To Do verbinden</button></form>
          )}
        </div>
      </section>
      {lists.map((list) => {
        const pendingCount = list.items.filter((item) => !item.checked).length;
        const exportedCount = list.items.filter((item) => item.microsoftTaskId).length;
        return (
          <section className="card" key={list.id}>
            <span className="badge">{list.mealPlan.title}</span>
            <h2>{list.title}</h2>
            <p className="muted">{pendingCount} offen · {exportedCount} bereits in Microsoft To Do</p>

            {microsoftConnection ? (
              <form className="form" action="/api/microsoft/export-shopping" method="post" style={{ marginBottom: 18 }}>
                <input type="hidden" name="shoppingListId" value={list.id} />
                <div className="grid cols-2">
                  <label>
                    <div className="label">Microsoft To Do Liste</div>
                    <select className="select" name="microsoftListId" defaultValue={list.microsoftListId || todoLists.find((todo) => todo.displayName.toLowerCase().includes("einkauf"))?.id || todoLists[0]?.id || ""} required>
                      <option value="" disabled>Liste auswählen…</option>
                      {todoLists.map((todo) => <option key={todo.id} value={todo.id}>{todo.displayName}</option>)}
                    </select>
                  </label>
                  <label>
                    <div className="label">Listenname für Verlauf</div>
                    <input className="input" name="microsoftListName" defaultValue={list.microsoftListName || "Microsoft To Do"} />
                  </label>
                </div>
                <label className="badge"><input type="checkbox" name="includeChecked" /> erledigte Einträge ebenfalls exportieren</label>
                <button className="button" type="submit">Neue Einträge nach Microsoft To Do senden</button>
                <p className="loading-note"><span className="spinner" /> Export läuft…</p>
              </form>
            ) : null}

            <div className="grid cols-2">
              {list.items.map((item) => (
                <div className="list-item" key={item.id}>
                  <form action="/api/shopping/toggle" method="post">
                    <input type="hidden" name="itemId" value={item.id} />
                    <button className="button secondary" type="submit" style={{ padding: "7px 10px", borderRadius: 10 }} aria-label={item.checked ? "Als offen markieren" : "Als erledigt markieren"}>{item.checked ? "✓" : "○"}</button>
                  </form>
                  <div>
                    <strong style={{ textDecoration: item.checked ? "line-through" : "none" }}>{item.name}</strong>{item.quantity ? <span className="muted"> · {item.quantity}</span> : null}<br />
                    <span className="muted">{item.source}</span>
                    {item.microsoftTaskId ? <><br /><span className="badge">in Microsoft To Do</span></> : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
