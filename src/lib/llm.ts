import OpenAI from "openai";
import {
  openAIBaseUrl,
  plannerModel as plannerModelEnv,
  remixModel as remixModelEnv,
  requireOpenAIKey,
} from "@/lib/env";

/**
 * Cache des OpenAI-Clients pro (apiKey, baseURL)-Kombination.
 *
 * Vorher wurde bei jedem Aufruf eine neue OpenAI-Instanz angelegt — was
 * sowohl pro Request einen frischen HTTP-Pool öffnete als auch das
 * Token-/Base-URL-Lookup wiederholte. Mit Cache bleibt der Pool
 * wiederverwendbar (relevant bei mehreren MCP-Tool-Aufrufen pro Sitzung),
 * und Tests/Env-Änderungen werden weiter respektiert: ändert sich der
 * Key oder die Base-URL zwischen Calls, wird ein neuer Client erzeugt.
 */
let cached: { apiKey: string; baseURL: string | null; client: OpenAI } | null = null;

export function getOpenAIClient(): OpenAI {
  const apiKey = requireOpenAIKey();
  const baseURL = openAIBaseUrl() ?? null;
  if (cached && cached.apiKey === apiKey && cached.baseURL === baseURL) {
    return cached.client;
  }
  const client = new OpenAI({ apiKey, baseURL: baseURL ?? undefined });
  cached = { apiKey, baseURL, client };
  return client;
}

/** Nur für Tests: Cache leeren. */
export function _resetOpenAIClientCache(): void {
  cached = null;
}

/**
 * Resolve the model id at call time so env changes (and tests) take effect.
 * Defaults live in `lib/env.ts` and point at real, available OpenAI models.
 */
export function plannerModel(): string {
  return plannerModelEnv();
}

export function remixModel(): string {
  return remixModelEnv();
}
