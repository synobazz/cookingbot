/* Cookingbot Service Worker — minimal Offline-Strategie.
 *
 * Ziel: die Einkaufsliste muss im Supermarkt funktionieren, auch
 * wenn das Mobilfunknetz im Tiefkühlfach abreißt. Alle anderen
 * Seiten dürfen ruhig 'offline' anzeigen.
 *
 * Strategien:
 *   - Navigations-Requests (HTML): network-first, bei Fehler aus Cache.
 *     Wenn /shopping erfolgreich geladen wurde, behalten wir die
 *     Antwort als zuletzt-gesehene Liste.
 *   - Statische Assets (.svg/.css/.js/manifest): cache-first.
 *   - Mutationen (POST/PUT/DELETE): NIE cachen, NIE replayen.
 *     Wenn offline → soll der Fetch scheitern, der User sieht den
 *     Fehler in der UI statt eines stillen "Erfolgs".
 *
 * Bewusst keine Workbox: die Logik ist klein und transparent,
 * jede Zeile lässt sich im DevTools-Debugger nachvollziehen.
 */

const CACHE_VERSION = "v1";
const SHELL_CACHE = `cookingbot-shell-${CACHE_VERSION}`;
const PAGE_CACHE = `cookingbot-pages-${CACHE_VERSION}`;
const ASSET_CACHE = `cookingbot-assets-${CACHE_VERSION}`;

const SHELL_URLS = ["/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  // Alte Caches aus früheren Versionen aufräumen
  event.waitUntil(
    caches.keys().then((keys) => {
      const allowed = new Set([SHELL_CACHE, PAGE_CACHE, ASSET_CACHE]);
      return Promise.all(keys.filter((k) => !allowed.has(k)).map((k) => caches.delete(k)));
    }).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Nie offline cachen: alles, was den State ändern könnte.
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Cross-origin Requests (Fonts von Google, externe Bilder) bleiben unangerührt.
  if (url.origin !== self.location.origin) return;

  // API/Auth/Login: immer frisch — wir wollen kein 401 aus dem Cache servieren.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/login")) return;

  // Service-Worker-File selbst NICHT cachen.
  if (url.pathname === "/sw.js") return;

  if (req.mode === "navigate") {
    event.respondWith(handleNavigation(req));
    return;
  }

  // Assets (Fonts/SVG/CSS/JS): cache-first
  if (/\.(svg|css|js|woff2?|webmanifest|png|jpg|jpeg|webp)$/i.test(url.pathname)) {
    event.respondWith(handleAsset(req));
  }
});

async function handleNavigation(req) {
  const url = new URL(req.url);
  try {
    const fresh = await fetch(req);
    // Erfolgreiche /shopping-Antwort als read-only-Cache behalten,
    // damit man die Liste im Supermarkt offen lässt und sie auch beim
    // Reload noch da ist.
    if (fresh.ok && url.pathname.startsWith("/shopping")) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch {
    const cache = await caches.open(PAGE_CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;
    // Fallback: irgendwas aus dem Page-Cache, sonst leerer Hinweis.
    const anyCached = (await cache.keys())[0];
    if (anyCached) {
      const fallback = await cache.match(anyCached);
      if (fallback) return fallback;
    }
    return new Response(
      "<!doctype html><meta charset=utf-8><title>Offline</title><body style='font-family:sans-serif;padding:40px;color:#1a1612;background:#f6f1e7'><h1>Offline</h1><p>Cookingbot ist gerade nicht erreichbar. Wenn du die Einkaufsliste schon einmal geöffnet hattest, lass diese Seite offen — sie bleibt aus dem Cache verfügbar.</p>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}

async function handleAsset(req) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    return new Response("", { status: 504 });
  }
}
