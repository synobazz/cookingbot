/**
 * Centralised, typed access to environment configuration.
 *
 * Validates eagerly when imported in production-only code paths, and
 * lazily (per getter) so unit tests and dev mode don't crash on startup
 * when only some integrations are configured.
 */

const DEFAULT_SESSION_SECRET_PLACEHOLDERS = new Set([
  "change-me-to-a-long-random-string",
  "dev-only-insecure-session-secret",
]);

const DEFAULT_PASSWORD_PLACEHOLDERS = new Set(["change-me"]);

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

function readString(name: string) {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

/** Trusted base URL used for absolute redirects + Microsoft redirect_uri. */
export function appBaseUrl(): string | undefined {
  return readString("APP_BASE_URL");
}

export function requireAppBaseUrl(): string {
  const value = appBaseUrl();
  if (!value) throw new Error("APP_BASE_URL must be configured");
  return value;
}

/** Returns the configured session secret, validating strength in production. */
export function sessionSecret(opts: { allowDev?: boolean } = {}): string {
  const value = readString("APP_SESSION_SECRET");
  const isPlaceholder = !value || DEFAULT_SESSION_SECRET_PLACEHOLDERS.has(value) || value.length < 32;
  if (isPlaceholder) {
    if (isProduction()) {
      throw new Error("APP_SESSION_SECRET must be set to a unique value with at least 32 characters in production");
    }
    if (!opts.allowDev) return "dev-only-insecure-session-secret";
  }
  return value || "dev-only-insecure-session-secret";
}

export function adminPassword(): string {
  const value = readString("APP_ADMIN_PASSWORD");
  const isPlaceholder = !value || DEFAULT_PASSWORD_PLACEHOLDERS.has(value) || value.length < 12;
  if (isPlaceholder) {
    if (isProduction()) {
      throw new Error("APP_ADMIN_PASSWORD must be set to a unique value with at least 12 characters in production");
    }
    return value || "change-me";
  }
  return value;
}

/* ── OpenAI ───────────────────────────────────────────────────────── */

/**
 * Sensible default that actually exists at OpenAI today. Users can override
 * via OPENAI_PLANNER_MODEL / OPENAI_REMIX_MODEL / OPENAI_MODEL.
 */
export const DEFAULT_PLANNER_MODEL = "gpt-5.4-mini";
export const DEFAULT_REMIX_MODEL = "gpt-5.5";

export function plannerModel(): string {
  return readString("OPENAI_PLANNER_MODEL") || readString("OPENAI_MODEL") || DEFAULT_PLANNER_MODEL;
}

export function remixModel(): string {
  return readString("OPENAI_REMIX_MODEL") || readString("OPENAI_MODEL") || DEFAULT_REMIX_MODEL;
}

export function openAIBaseUrl(): string | undefined {
  return readString("OPENAI_BASE_URL");
}

export function requireOpenAIKey(): string {
  const value = readString("OPENAI_API_KEY");
  if (!value) throw new Error("OPENAI_API_KEY is not configured");
  return value;
}

/* ── Paprika ──────────────────────────────────────────────────────── */

export function paprikaApiBase(): string {
  return readString("PAPRIKA_API_BASE") || "https://www.paprikaapp.com/api";
}

export function paprikaCredentials(): { email: string; password: string } {
  const email = readString("PAPRIKA_EMAIL");
  const password = readString("PAPRIKA_PASSWORD");
  if (!email || !password) throw new Error("PAPRIKA_EMAIL and PAPRIKA_PASSWORD must be configured");
  return { email, password };
}

/* ── Microsoft ────────────────────────────────────────────────────── */

export function microsoftConfig(): {
  clientId: string;
  clientSecret: string;
  tenant: string;
  redirectUri: string;
} {
  const clientId = readString("MICROSOFT_CLIENT_ID");
  const clientSecret = readString("MICROSOFT_CLIENT_SECRET");
  const baseUrl = appBaseUrl();
  if (!clientId || !clientSecret || !baseUrl) {
    throw new Error("MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET and APP_BASE_URL must be configured");
  }
  return {
    clientId,
    clientSecret,
    tenant: readString("MICROSOFT_TENANT_ID") || "consumers",
    redirectUri: `${baseUrl.replace(/\/$/, "")}/api/microsoft/callback`,
  };
}

/* ── MCP ──────────────────────────────────────────────────────────── */

/**
 * Bearer-Token, das der MCP-Server zwingend für jeden Request verlangt.
 * Setze einen langen Zufallswert (mind. 32 Zeichen) in `MCP_BEARER_TOKEN`.
 * Ist der Wert nicht gesetzt, ist der MCP-Endpunkt deaktiviert (return 503).
 */
export function mcpBearerToken(): string | undefined {
  const value = readString("MCP_BEARER_TOKEN");
  if (!value) return undefined;
  if (value.length < 32) {
    if (isProduction()) {
      throw new Error("MCP_BEARER_TOKEN must be at least 32 characters long");
    }
  }
  return value;
}
