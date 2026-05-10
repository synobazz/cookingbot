/**
 * Audit-Log für MCP-Tool-Aufrufe.
 *
 * Implementiert als FIFO-Ringbuffer in `AppSetting["mcpAuditLog"]` mit
 * den letzten N Einträgen. Kein Schema-Change nötig, kein eigener
 * Wartungsjob — einfach genug für den Single-User-Hausgebrauch.
 *
 * Pro Tool-Call wird festgehalten:
 *  - Tool-Name, Zeitstempel, Dauer
 *  - der erste Args-Snapshot (gekürzt, sodass keine LLM-Mega-Prompts in der DB landen)
 *  - ok / errorCode bei Misserfolg
 *
 * Auslesbar über das MCP-Tool `showRecentMcpActivity`.
 */
import { prisma } from "@/lib/db";

const KEY = "mcpAuditLog";
const MAX_ENTRIES = 50;
const MAX_ARGS_LENGTH = 600; // Zeichen pro Args-Snapshot

export type McpAuditEntry = {
  ts: string; // ISO-Timestamp
  tool: string;
  durationMs: number;
  ok: boolean;
  errorCode?: string;
  args?: string;
};

async function readAll(): Promise<McpAuditEntry[]> {
  const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? (parsed as McpAuditEntry[]) : [];
  } catch {
    return [];
  }
}

/** Liefert die letzten Audit-Einträge in chronologischer Reihenfolge (neueste zuletzt). */
export async function listAuditEntries(limit = MAX_ENTRIES): Promise<McpAuditEntry[]> {
  const all = await readAll();
  return all.slice(-limit);
}

function summarizeArgs(args: unknown): string | undefined {
  if (args === undefined || args === null) return undefined;
  try {
    const redacted = redactSensitive(args);
    const json = JSON.stringify(redacted);
    if (json.length <= MAX_ARGS_LENGTH) return json;
    return `${json.slice(0, MAX_ARGS_LENGTH).trimEnd()}…`;
  } catch {
    return undefined;
  }
}

/**
 * Liste von Schlüssel-Substrings, deren Werte aus dem Audit-Log
 * herausgefiltert werden, bevor sie persistiert werden. Aktuell hat
 * keines unserer Tools so einen Parameter — die Liste existiert
 * vorausschauend, damit ein versehentlich neu hinzugefügtes Tool mit
 * z. B. einem `password`-Feld nicht plötzlich plaintext im Audit-Log
 * landet.
 *
 * Die Prüfung ist case-insensitive Substring-Match: ein Schlüssel
 * `apiKey` matcht `key`, `userPassword` matcht `password`.
 */
const SENSITIVE_KEY_SUBSTRINGS = [
  "password",
  "passwd",
  "secret",
  "token",
  "bearer",
  "apikey",
  "api_key",
  "authorization",
  "credential",
  "privatekey",
  "private_key",
  "cookie",
];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_SUBSTRINGS.some((needle) => lower.includes(needle));
}

/**
 * Rekursive Redaction für nested Objekte/Arrays. Werte unter sensitiven
 * Schlüsseln werden durch `[REDACTED]` ersetzt; Strings bleiben
 * ansonsten unverändert. Zyklische Referenzen werden über ein WeakSet
 * abgefangen und zu `[CIRCULAR]` reduziert.
 *
 * Maximale Rekursionstiefe ist 5 — tiefere Strukturen tauchen in Tool-
 * Args praktisch nicht auf, und wir wollen nicht versehentlich an einem
 * exotisch tiefen Objekt CPU verbrennen.
 */
function redactSensitive(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
  if (depth > 5) return "[TRUNCATED_DEPTH]";
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value as object)) return "[CIRCULAR]";
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, seen, depth + 1));
  }

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      out[key] = "[REDACTED]";
    } else {
      out[key] = redactSensitive(val, seen, depth + 1);
    }
  }
  return out;
}

/**
 * Trägt einen Audit-Eintrag in den Ringbuffer ein. Nicht-blockierend für die
 * Tool-Antwort: Fehler werden geschluckt und nur geloggt, damit ein Audit-DB-
 * Hänger niemals den eigentlichen Tool-Call zum Scheitern bringt.
 */
export async function recordAuditEntry(entry: McpAuditEntry): Promise<void> {
  try {
    const existing = await readAll();
    const next = [...existing, entry].slice(-MAX_ENTRIES);
    await prisma.appSetting.upsert({
      where: { key: KEY },
      update: { value: JSON.stringify(next) },
      create: { key: KEY, value: JSON.stringify(next) },
    });
  } catch (error) {
    // Persistenz-Fehler im Audit-Log dürfen nie den eigentlichen Tool-
    // Call abbrechen. Strukturierter Log-Eintrag, damit man im
    // Container-Log per Tag filtern kann (`grep mcp.audit_persist_failed`).
    console.warn(
      JSON.stringify({
        tag: "mcp.audit_persist_failed",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

export { summarizeArgs as _summarizeArgs, redactSensitive as _redactSensitive };

/**
 * Wrappt einen Tool-Callback so, dass jeder Aufruf gemessen und ins Audit-Log
 * geschrieben wird. Ergebnis bleibt unverändert; ein `isError`-Flag oder ein
 * `errorCode` im strukturierten Payload werden als Fehler erkannt.
 */
export function withAudit<Args, R extends { isError?: boolean; structuredContent?: { [k: string]: unknown } }>(
  tool: string,
  cb: (args: Args) => Promise<R>,
): (args: Args) => Promise<R> {
  return async (args: Args) => {
    const startedAt = Date.now();
    let result: R | undefined;
    let thrown: unknown;
    try {
      result = await cb(args);
      return result;
    } catch (error) {
      thrown = error;
      throw error;
    } finally {
      const durationMs = Date.now() - startedAt;
      const ok =
        thrown === undefined &&
        result !== undefined &&
        result.isError !== true &&
        (result.structuredContent?.ok ?? true) !== false;
      const errorCode =
        result?.structuredContent && typeof result.structuredContent.errorCode === "string"
          ? (result.structuredContent.errorCode as string)
          : thrown instanceof Error
            ? "THROWN"
            : undefined;
      // Fire-and-forget; nicht awaiten, damit die Tool-Antwort nicht hängt.
      void recordAuditEntry({
        ts: new Date().toISOString(),
        tool,
        durationMs,
        ok,
        errorCode,
        args: summarizeArgs(args),
      });
    }
  };
}
