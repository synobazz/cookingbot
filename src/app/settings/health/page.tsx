import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { runHealthChecks, type CheckStatus } from "@/lib/health";
import { HeartPulseIcon } from "../../_components/icons";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<CheckStatus, string> = {
  ok: "OK",
  warn: "Warnung",
  error: "Fehler",
};

const STATUS_CHIP_CLASS: Record<CheckStatus, string> = {
  ok: "chip forest",
  warn: "chip gold",
  error: "chip warn",
};

export default async function HealthPage() {
  if (!(await requireAuth())) redirect("/login");
  const report = await runHealthChecks();

  return (
    <>
      <div className="page-head">
        <div className="left">
          <span className="eyebrow">Diagnose</span>
          <h1 className="display">
            Wie geht&apos;s <em>der App?</em>
          </h1>
          <span className="sub">
            Schnell-Check über DB, Rezeptbestand, Paprika-Sync und Schlüssel-Variablen. Wird auch von
            <code style={{ margin: "0 4px" }}>/api/health</code> für externes Monitoring genutzt
            (200 ↔ alles ok, 503 ↔ mindestens eine Warnung oder ein Fehler).
          </span>
        </div>
        <div className="actions">
          <Link className="btn ghost" href="/settings">
            Zurück zu Einstellungen
          </Link>
        </div>
      </div>

      <section className="card card-pad" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span aria-hidden style={{ color: "var(--forest)", display: "inline-flex" }}>
            <HeartPulseIcon />
          </span>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontFamily: "var(--font-fraunces)", fontWeight: 500 }}>
              Gesamtstatus
            </h3>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: ".88rem" }}>
              Geprüft am {new Date(report.generatedAt).toLocaleString("de-DE")}
            </p>
          </div>
          <span className={STATUS_CHIP_CLASS[report.status]}>
            {STATUS_LABEL[report.status]}
          </span>
        </div>
      </section>

      <ul className="health-list">
        {report.checks.map((check) => (
          <li key={check.id} className="health-item">
            <div className="health-item-text">
              <b>{check.label}</b>
              <span className="muted">{check.detail}</span>
            </div>
            <span className={STATUS_CHIP_CLASS[check.status]}>{STATUS_LABEL[check.status]}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
