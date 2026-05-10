/**
 * In-Memory Rate-Limiter mit Sliding-Window pro Schlüssel (typischerweise IP).
 *
 * Zweck: Schutz gegen Brute-Force auf Auth-Endpoints. Es ist bewusst
 * absichtlich simpel — Single-Container-Deployment auf einem NAS, ein
 * `Map<string, …>` reicht aus. Bei einem Multi-Pod-Deployment würde man
 * diesen Store gegen Redis o. ä. tauschen.
 *
 * Eigenschaften:
 * - **Sliding window**: jede Verletzung verlängert das Window. So kann
 *   ein Angreifer das Window nicht durch geduldetes Warten "abreiten".
 * - **Trust-Proxy-aware**: `clientKey()` liest `X-Forwarded-For` nur,
 *   wenn `TRUST_PROXY=true` gesetzt ist. Ohne dieses Gate könnte ein
 *   Angreifer per gefälschtem Header pro Request eine neue IP
 *   vortäuschen und das Limit umgehen.
 * - **Memory-bounded**: alte Einträge werden lazy beim nächsten Zugriff
 *   verworfen. Bei moderater Last hält die Map sich von selbst klein;
 *   ein dedizierter Cleanup-Job ist nicht nötig.
 *
 * Anwendungsbeispiel:
 *
 *   const limiter = createRateLimiter({ windowMs: 15 * 60_000, max: 8 });
 *   const key = clientKey(req);
 *   if (limiter.isLimited(key)) return tooManyRequests();
 *   …
 *   if (failed) limiter.recordFailure(key);
 *   else limiter.reset(key);
 */
import type { NextRequest } from "next/server";

export type RateLimiter = {
  isLimited: (key: string) => boolean;
  recordFailure: (key: string) => void;
  reset: (key: string) => void;
  /** Anzahl aktuell beobachteter Schlüssel — nur für Tests/Diagnose. */
  size: () => number;
};

export function createRateLimiter(opts: { windowMs: number; max: number }): RateLimiter {
  const { windowMs, max } = opts;
  const attempts = new Map<string, { count: number; resetAt: number }>();

  function purgeIfExpired(key: string, now: number) {
    const entry = attempts.get(key);
    if (entry && entry.resetAt < now) attempts.delete(key);
  }

  return {
    isLimited(key) {
      const now = Date.now();
      purgeIfExpired(key, now);
      const entry = attempts.get(key);
      return entry !== undefined && entry.count >= max;
    },
    recordFailure(key) {
      const now = Date.now();
      purgeIfExpired(key, now);
      const entry = attempts.get(key);
      if (!entry) {
        attempts.set(key, { count: 1, resetAt: now + windowMs });
        return;
      }
      entry.count += 1;
      // Sliding window: jede Verletzung schiebt das Window nach hinten.
      entry.resetAt = now + windowMs;
    },
    reset(key) {
      attempts.delete(key);
    },
    size() {
      return attempts.size;
    },
  };
}

/**
 * Liest die Client-IP aus dem Request — aber nur, wenn der Reverse Proxy
 * explizit als vertrauenswürdig markiert ist (`TRUST_PROXY=true`).
 *
 * Ohne dieses Gate könnte ein Angreifer per gefälschtem `X-Forwarded-For`
 * pro Request eine neue Identität annehmen und damit Rate-Limits aushebeln.
 *
 * Fallback `"local"` ist bewusst ein einziger gemeinsamer Bucket — bei
 * direkter Anbindung ohne Proxy zählen alle Requests gegen denselben
 * Counter. Das ist das sichere, restriktivere Verhalten.
 */
export function clientKey(req: NextRequest): string {
  if (process.env.TRUST_PROXY === "true") {
    const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
    const real = req.headers.get("x-real-ip");
    if (real) return real;
  }
  return "local";
}
