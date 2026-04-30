import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export default async function ShoppingPage() {
  if (!(await requireAuth())) redirect("/login");
  const lists = await prisma.shoppingList.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { items: { orderBy: { order: "asc" } }, mealPlan: true } });
  return (
    <div className="grid">
      <section className="card">
        <div className="eyebrow">Einkauf</div>
        <h1>Einkaufslisten</h1>
        <p>V1 hält die Liste intern. Microsoft Todo kommt später als Export/Sync.</p>
      </section>
      {lists.map((list) => (
        <section className="card" key={list.id}>
          <span className="badge">{list.mealPlan.title}</span>
          <h2>{list.title}</h2>
          <div className="grid cols-2">
            {list.items.map((item) => (
              <div className="list-item" key={item.id}>
                <input type="checkbox" defaultChecked={item.checked} readOnly />
                <div><strong>{item.name}</strong>{item.quantity ? <span className="muted"> · {item.quantity}</span> : null}<br /><span className="muted">{item.source}</span></div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
