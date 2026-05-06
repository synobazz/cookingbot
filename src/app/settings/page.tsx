import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { appBaseUrl, openAIBaseUrl, plannerModel, remixModel } from "@/lib/env";
import { RefreshIcon } from "../_components/icons";

function statusChip(ok: boolean, label: string) {
  return <span className={`chip ${ok ? "forest" : "warn"}`}>{label}</span>;
}

function masked(value?: string | null) {
  if (!value) return "Nicht gesetzt";
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

/** Entfernt Credentials aus DB-URLs und zeigt nur Schema/Host/Datenbank. */
function maskedDatabaseUrl(value?: string | null) {
  const raw = (value || "").trim();
  if (!raw) return "Nicht gesetzt";
  try {
    const url = new URL(raw);
    const host = url.host || "";
    const dbPath = url.pathname && url.pathname !== "/" ? url.pathname : "";
    const proto = url.protocol.replace(":", "");
    const userPart = url.username ? `${url.username}:••••@` : "";
    if (!host && !dbPath) return "••••";
    return `${proto}://${userPart}${host}${dbPath}`;
  } catch {
    // Nicht-URL (z. B. file:./dev.db oder SQLite-Pfad): nur Schema oder Dateinamen zeigen.
    if (raw.startsWith("file:")) return raw;
    return "••••";
  }
}

export default async function SettingsPage() {
  if (!(await requireAuth())) redirect("/login");

  const [recipes, plans, openShoppingItems, microsoftConnection, lastSync] = await Promise.all([
    prisma.recipe.count({ where: { inTrash: false } }),
    prisma.mealPlan.count(),
    prisma.shoppingListItem.count({ where: { checked: false } }),
    prisma.microsoftConnection.findUnique({ where: { id: "default" } }),
    prisma.appSetting.findUnique({ where: { key: "lastPaprikaSync" } }),
  ]);

  const paprikaConfigured = Boolean(process.env.PAPRIKA_EMAIL && process.env.PAPRIKA_PASSWORD);
  const openAIConfigured = Boolean(process.env.OPENAI_API_KEY);
  const microsoftConfigured = Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET && appBaseUrl());

  return (
    <>
      <div className="page-head">
        <div className="left">
          <span className="eyebrow">Setup · cookingbot</span>
          <h1 className="display">
            Einstellungen<em>.</em>
          </h1>
          <span className="sub">Status, Integrationen und schnelle Verwaltungsaktionen.</span>
        </div>
        <div className="actions">
          <form action="/api/sync/paprika" method="post">
            <button className="btn ghost" type="submit">
              <RefreshIcon /> Paprika syncen
            </button>
          </form>
        </div>
      </div>

      <div className="settings-grid">
        <section className="card card-pad settings-card">
          <span className="eyebrow">System</span>
          <h2 className="section">Deployment</h2>
          <dl className="settings-list">
            <div><dt>APP_BASE_URL</dt><dd>{appBaseUrl() || "Nicht gesetzt"}</dd></div>
            <div><dt>Database</dt><dd>{maskedDatabaseUrl(process.env.DATABASE_URL)}</dd></div>
            <div><dt>Proxy vertrauen</dt><dd>{process.env.TRUST_PROXY === "true" ? "Ja" : "Nein"}</dd></div>
            <div><dt>DB Push beim Start</dt><dd>{process.env.PRISMA_DB_PUSH_ON_START === "false" ? "Aus" : "Ein"}</dd></div>
          </dl>
        </section>

        <section className="card card-pad settings-card">
          <span className="eyebrow">Daten</span>
          <h2 className="section">Aktueller Stand</h2>
          <div className="settings-stats">
            <div><b>{recipes}</b><span>Rezepte</span></div>
            <div><b>{plans}</b><span>Pläne</span></div>
            <div><b>{openShoppingItems}</b><span>offene Einkäufe</span></div>
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            Letzter Paprika-Sync: {lastSync?.value ? new Date(lastSync.value).toLocaleString("de-AT") : "noch keiner"}
          </p>
        </section>

        <section className="card card-pad settings-card">
          <span className="eyebrow">Integrationen</span>
          <h2 className="section">Verbindungen</h2>
          <div className="integration-list">
            <div>
              <div><strong>Paprika</strong><p className="muted">Rezepte synchronisieren und Remix exportieren.</p></div>
              {statusChip(paprikaConfigured, paprikaConfigured ? "Konfiguriert" : "Fehlt")}
            </div>
            <div>
              <div><strong>OpenAI-kompatibles LLM</strong><p className="muted">Planung und kreative Remixe.</p></div>
              {statusChip(openAIConfigured, openAIConfigured ? "Konfiguriert" : "Fehlt")}
            </div>
            <div>
              <div><strong>Microsoft To Do</strong><p className="muted">{microsoftConnection ? `Verbunden mit ${microsoftConnection.accountEmail || microsoftConnection.accountName || "Microsoft"}` : "Einkaufslisten exportieren."}</p></div>
              {statusChip(Boolean(microsoftConnection), microsoftConnection ? "Verbunden" : microsoftConfigured ? "Bereit" : "Fehlt")}
            </div>
          </div>
        </section>

        <section className="card card-pad settings-card">
          <span className="eyebrow">KI</span>
          <h2 className="section">Modelle</h2>
          <dl className="settings-list">
            <div><dt>Planner</dt><dd>{plannerModel()}</dd></div>
            <div><dt>Remix</dt><dd>{remixModel()}</dd></div>
            <div><dt>Base URL</dt><dd>{openAIBaseUrl() || "OpenAI Standard"}</dd></div>
            <div><dt>API Key</dt><dd>{masked(process.env.OPENAI_API_KEY)}</dd></div>
          </dl>
        </section>
      </div>
    </>
  );
}
