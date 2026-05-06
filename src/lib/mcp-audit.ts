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
    const json = JSON.stringify(args);
    if (json.length <= MAX_ARGS_LENGTH) return json;
    return `${json.slice(0, MAX_ARGS_LENGTH).trimEnd()}…`;
  } catch {
    return undefined;
  }
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
    console.warn("[mcp-audit] failed to persist entry", error);
  }
}

export { summarizeArgs as _summarizeArgs };

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
