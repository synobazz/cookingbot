/**
 * Strukturierte Tool-Result-Helfer für Cookingbot-MCP-Tools.
 *
 * Wir liefern alle Antworten als JSON-Text-Content (das MCP-SDK serialisiert
 * uns nicht selbst, aber sowohl Claude Desktop als auch Claude.ai parsen
 * Text-Content auf der Client-Seite). Strukturierte Fehler tragen einen
 * stabilen `errorCode`, damit der Aufrufer (LLM oder Test) verlässlich
 * reagieren kann, ohne auf deutschen Fehlertext zu pattern-matchen.
 */

export type McpToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  /**
   * MCP-2025-06-18 erlaubt strukturierte Inhalte parallel zum Text-Content;
   * wir füllen das, sodass Clients mit Schema-Awareness das JSON ohne erneutes
   * Parsen verarbeiten können.
   */
  structuredContent?: { [key: string]: unknown };
};

/** Erfolgs-Antwort mit beliebigem JSON-Payload. */
export function ok<T extends Record<string, unknown>>(payload: T): McpToolResult {
  const body = { ok: true as const, ...payload };
  return {
    content: [{ type: "text", text: JSON.stringify(body) }],
    structuredContent: body,
  };
}

/**
 * Stabile Fehlercodes. Werden niemals nach Veröffentlichung umbenannt, damit
 * downstream-Logik (z. B. zukünftige Tests oder LLM-Prompts) sich darauf
 * verlassen kann.
 */
export type McpErrorCode =
  | "INVALID_DATE"
  | "INVALID_INPUT"
  | "DATE_RANGE_REVERSED"
  | "MEAL_NOT_FOUND"
  | "PLAN_NOT_FOUND"
  | "RECIPE_NOT_FOUND"
  | "SHOPPING_LIST_NOT_FOUND"
  | "MULTIPLE_MATCHES"
  | "RECIPE_EXCLUDED"
  | "REPLAN_FAILED"
  | "RECIPE_CREATE_FAILED"
  | "LLM_FAILED"
  | "LLM_TIMEOUT"
  | "RECIPE_BLOCKED_UNSAFE"
  | "INTERNAL_ERROR";

/** Fehler-Antwort mit Code, Nachricht (deutsch) und optionalen Details. */
export function fail(
  errorCode: McpErrorCode,
  message: string,
  details?: Record<string, unknown>,
): McpToolResult {
  const body = { ok: false as const, errorCode, message, ...(details ? { details } : {}) };
  return {
    content: [{ type: "text", text: JSON.stringify(body) }],
    isError: true,
    structuredContent: body,
  };
}
