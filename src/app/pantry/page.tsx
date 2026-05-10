import { redirect } from "next/navigation";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { requireAuth } from "@/lib/auth";
import { listPantryItems } from "@/lib/pantry";
import { PendingForm, PendingButton } from "../_components/pending-form";
import { PlusIcon, TrashIcon } from "../_components/icons";

type SearchParams = {
  saved?: string;
  deleted?: string;
  error?: string;
};

export default async function PantryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (!(await requireAuth())) redirect("/login");
  const params = await searchParams;
  const items = await listPantryItems();

  return (
    <>
      <div className="page-head">
        <div className="left">
          <span className="eyebrow">Vorratskammer</span>
          <h1 className="display">
            Was hast <em>du noch?</em>
          </h1>
          <span className="sub">
            Einträge in der Vorratskammer werden bei der Einkaufsliste übersprungen — du kaufst nichts doppelt.
          </span>
        </div>
      </div>

      {params.saved ? (
        <p role="status" style={{ color: "var(--forest)", marginBottom: 18 }}>
          Eintrag gespeichert.
        </p>
      ) : null}
      {params.deleted ? (
        <p role="status" style={{ color: "var(--forest)", marginBottom: 18 }}>
          Eintrag entfernt.
        </p>
      ) : null}
      {params.error ? (
        <p role="alert" style={{ color: "var(--warn)", marginBottom: 18 }}>
          {decodeURIComponent(params.error)}
        </p>
      ) : null}

      <div className="pantry-grid">
        <section className="card card-pad">
          <h3 style={{ marginTop: 0, fontFamily: "var(--font-fraunces)", fontWeight: 500 }}>
            Eintrag hinzufügen
          </h3>
          <PendingForm
            action="/api/pantry"
            method="post"
            pendingMessage="Vorratseintrag wird gespeichert…"
          >
            <div className="form-grid">
              <div>
                <label className="label" htmlFor="pantry-name">
                  Zutat
                </label>
                <input
                  id="pantry-name"
                  className="input"
                  type="text"
                  name="name"
                  required
                  maxLength={120}
                  autoComplete="off"
                  placeholder="z. B. Olivenöl"
                />
              </div>
              <div>
                <label className="label" htmlFor="pantry-qty">
                  Menge (optional)
                </label>
                <input
                  id="pantry-qty"
                  className="input"
                  type="text"
                  name="quantity"
                  maxLength={60}
                  autoComplete="off"
                  placeholder="z. B. 1 Flasche, 500 g"
                />
              </div>
              <div>
                <label className="label" htmlFor="pantry-exp">
                  Mindestens haltbar bis (optional)
                </label>
                <input
                  id="pantry-exp"
                  className="input"
                  type="date"
                  name="expiresOn"
                />
              </div>
              <PendingButton className="btn block" type="submit">
                <PlusIcon /> Hinzufügen
              </PendingButton>
            </div>
          </PendingForm>
        </section>

        <section className="card card-pad">
          <h3 style={{ marginTop: 0, fontFamily: "var(--font-fraunces)", fontWeight: 500 }}>
            Aktuell vorrätig ({items.length})
          </h3>
          {items.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              Noch nichts eingetragen. Tipp: lege Standards wie Salz, Öl, Mehl, Zucker hier rein, dann musst du sie nie wieder von der Einkaufsliste streichen.
            </p>
          ) : (
            <ul className="pantry-list">
              {items.map((item) => {
                const expired = item.expiresOn && item.expiresOn.getTime() < Date.now();
                return (
                  <li key={item.id} className={`pantry-item${expired ? " expired" : ""}`}>
                    <div className="pantry-item-text">
                      <b>{item.name}</b>
                      <span className="muted">
                        {item.quantity ? item.quantity : ""}
                        {item.quantity && item.expiresOn ? " · " : ""}
                        {item.expiresOn
                          ? `${expired ? "abgelaufen am " : "haltbar bis "}${format(item.expiresOn, "d. MMM yyyy", { locale: de })}`
                          : ""}
                      </span>
                    </div>
                    <PendingForm
                      action="/api/pantry/delete"
                      method="post"
                      pendingMessage="Eintrag wird entfernt…"
                    >
                      <input type="hidden" name="id" value={item.id} />
                      <PendingButton
                        className="btn ghost sm"
                        type="submit"
                        aria-label={`„${item.name}" entfernen`}
                      >
                        <TrashIcon />
                      </PendingButton>
                    </PendingForm>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
