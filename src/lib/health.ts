/**
 * Self-Check für die App. Liefert eine knappe Übersicht über die Dinge,
 * die im Betrieb gerne mal kaputtgehen oder vergessen werden:
 *   - Datenbank erreichbar?
 *   - Wie viele Rezepte sind verfügbar?
 *   - Wann wurde Paprika zuletzt synchronisiert?
 *   - Sind Schlüsselvariablen gesetzt (OpenAI, MCP, Microsoft)?
 *
 * Bewusst tolerant: jede Probe darf scheitern und liefert dann
 * `status: "warn"` / `"error"` mit einer kurzen Message — wir wollen
 * den Endpoint NIE selbst zum Absturz bringen, der wäre sonst ja
 * nicht mehr nützlich für Healthchecks.
 */
import { prisma } from "@/lib/db";

export type CheckStatus = "ok" | "warn" | "error";

export type HealthCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
};

export type HealthReport = {
  status: CheckStatus;
  generatedAt: string;
  checks: HealthCheck[];
};

function envFlag(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

async function checkDatabase(): Promise<HealthCheck> {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return { id: "db", label: "Datenbank", status: "ok", detail: "Verbunden" };
  } catch (error) {
    return {
      id: "db",
      label: "Datenbank",
      status: "error",
      detail: error instanceof Error ? error.message : "Unbekannter Fehler",
    };
  }
}

async function checkRecipes(): Promise<HealthCheck> {
  try {
    const total = await prisma.recipe.count({ where: { inTrash: false } });
    if (total === 0) {
      return { id: "recipes", label: "Rezepte", status: "warn", detail: "Keine Rezepte im Cache — Paprika synchronisieren." };
    }
    const planEligible = await prisma.recipe.count({
      where: { inTrash: false, excludeFromPlanning: false },
    });
    if (planEligible < 14) {
      return {
        id: "recipes",
        label: "Rezepte",
        status: "warn",
        detail: `${total} insgesamt · ${planEligible} planbar (empfohlen ≥ 14)`,
      };
    }
    return {
      id: "recipes",
      label: "Rezepte",
      status: "ok",
      detail: `${total} insgesamt · ${planEligible} planbar`,
    };
  } catch (error) {
    return {
      id: "recipes",
      label: "Rezepte",
      status: "error",
      detail: error instanceof Error ? error.message : "Konnte Rezepte nicht zählen",
    };
  }
}

async function checkLastPaprikaSync(): Promise<HealthCheck> {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: "lastPaprikaSync" } });
    if (!setting) {
      return {
        id: "paprika-sync",
        label: "Paprika-Sync",
        status: "warn",
        detail: "Noch nie synchronisiert.",
      };
    }
    const ts = new Date(setting.value);
    if (Number.isNaN(ts.getTime())) {
      return { id: "paprika-sync", label: "Paprika-Sync", status: "warn", detail: "Zeitstempel unlesbar." };
    }
    const ageDays = Math.floor((Date.now() - ts.getTime()) / (24 * 60 * 60 * 1000));
    const detail = `Letzter Lauf: ${ts.toISOString().slice(0, 16).replace("T", " ")} UTC (vor ${ageDays} Tag${ageDays === 1 ? "" : "en"})`;
    return {
      id: "paprika-sync",
      label: "Paprika-Sync",
      status: ageDays > 30 ? "warn" : "ok",
      detail,
    };
  } catch (error) {
    return {
      id: "paprika-sync",
      label: "Paprika-Sync",
      status: "warn",
      detail: error instanceof Error ? error.message : "Konnte Setting nicht lesen",
    };
  }
}

function checkEnv(): HealthCheck[] {
  const items: Array<{ id: string; label: string; required: boolean; var: string }> = [
    { id: "env-openai", label: "OpenAI-Key", required: true, var: "OPENAI_API_KEY" },
    { id: "env-paprika", label: "Paprika-Zugang", required: false, var: "PAPRIKA_EMAIL" },
    { id: "env-mcp", label: "MCP-Bearer-Token", required: false, var: "MCP_BEARER_TOKEN" },
    { id: "env-microsoft", label: "Microsoft-Client", required: false, var: "MICROSOFT_CLIENT_ID" },
  ];
  return items.map((item) => {
    const set = envFlag(item.var);
    if (set) return { id: item.id, label: item.label, status: "ok" as const, detail: "konfiguriert" };
    return {
      id: item.id,
      label: item.label,
      status: item.required ? "error" : "warn",
      detail: `${item.var} nicht gesetzt`,
    };
  });
}

/** Aggregiert alle Checks. Status der Gesamtübersicht ist der schlimmste Einzelstatus. */
export async function runHealthChecks(): Promise<HealthReport> {
  const [db, recipes, sync] = await Promise.all([
    checkDatabase(),
    checkRecipes(),
    checkLastPaprikaSync(),
  ]);
  const checks: HealthCheck[] = [db, recipes, sync, ...checkEnv()];
  const order: Record<CheckStatus, number> = { ok: 0, warn: 1, error: 2 };
  const overall = checks.reduce<CheckStatus>(
    (acc, c) => (order[c.status] > order[acc] ? c.status : acc),
    "ok",
  );
  return {
    status: overall,
    generatedAt: new Date().toISOString(),
    checks,
  };
}
