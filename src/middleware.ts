/**
 * Globale Security-Header für alle Cookingbot-Routen.
 *
 * Setzt eine kleine, konservative Liste an Browser-Security-Headers,
 * die jede Antwort begleitet. Der Reverse Proxy (Synology, Nginx etc.)
 * kann diese Header bei Bedarf überschreiben oder ergänzen — wir
 * setzen sie auch ohne Proxy, damit die App im Standalone-Betrieb
 * (z. B. lokale Entwicklung über HTTPS-Tunnel) ohne weitere
 * Konfiguration sicher ist.
 *
 * Bewusst NICHT gesetzt:
 *   - `Strict-Transport-Security`: gehört auf den Reverse Proxy, der
 *     entscheidet, ob HTTPS terminiert ist und welcher max-age sinnvoll
 *     ist. Hier blind zu setzen würde HSTS-pinning auch in lokalen
 *     HTTP-Setups erzwingen.
 *
 * CSP-Erläuterung:
 *   - `script-src` und `style-src` enthalten `'unsafe-inline'`, weil
 *     Next.js Server Components Inline-Hydration-Snippets generieren.
 *     Eine Nonce-basierte CSP wäre sauberer, ist aber für eine private
 *     Single-User-App Overhead. Die CSP schützt damit primär gegen
 *     Inhalte aus fremden Origins, nicht gegen Inline-XSS.
 *   - `img-src 'self' data: https:` erlaubt Same-Origin (Recipe-Image-
 *     Proxy), Inline-data-URIs (Glyph-Fallback) und beliebige HTTPS-
 *     Bilder, weil der Proxy beliebige öffentliche Recipe-Photos
 *     weiterreicht.
 *   - `connect-src 'self'` lässt die App XHR/fetch nur auf den eigenen
 *     Origin machen.
 *   - `frame-ancestors 'none'` ergänzt `X-Frame-Options DENY` für
 *     Browser, die letzteres ignorieren.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  // PWA: Manifest und Service Worker liegen beide unter eigenem Origin.
  "manifest-src 'self'",
  "worker-src 'self'",
].join("; ");

export function middleware(_req: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", CSP);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Permissions-Policy minimal: keine Berechtigungen anfragen, die wir
  // nicht brauchen — verhindert, dass injizierter Drittinhalt z. B. die
  // Geolocation-API anstößt.
  response.headers.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=(), usb=()",
  );
  return response;
}

/**
 * Matcher: alle Routen außer Next-Internals und statische Assets.
 * Spezifisch ausgeschlossen sind `/api/*`-Routen NICHT — auch
 * JSON-Antworten profitieren von `X-Content-Type-Options: nosniff`
 * und `Referrer-Policy`.
 *
 * `/_next/*`, `/favicon.ico` und `/_next/static/*` werden ausgespart,
 * weil sie hochfrequent abgerufen werden und keinen Sicherheits-
 * mehrwert aus den Headern ziehen.
 */
export const config = {
  matcher: ["/((?!_next/|favicon.ico).*)"],
};
