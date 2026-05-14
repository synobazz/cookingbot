# Changelog

Alle nennenswerten Änderungen an Cookingbot werden hier dokumentiert.
Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung an [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

### Added
- **MCP-Server unter `/mcp`** — Cookingbot exponiert zehn Tools (`getMealForDay`, `getMealPlan`, `searchRecipes`, `getShoppingList`, `findRecipeByCraving`, `setMealForDay`, `replaceMealForDay`, `createRecipeFromIngredients`, `undoLastMealChange`, `showRecentMcpActivity`) plus `ping` für externe LLM-Clients wie Claude Desktop. Authentifizierung per statischem Bearer-Token (`MCP_BEARER_TOKEN`); ohne gesetztes Token antwortet der Endpoint mit HTTP 503. Alle Tools liefern strukturierte Ergebnisse mit stabilen Error-Codes (`MULTIPLE_MATCHES`, `LLM_TIMEOUT`, `RECIPE_EXCLUDED`, …) und führen MCP-Annotations (`readOnlyHint`/`destructiveHint`/`idempotentHint`/`openWorldHint`), sodass Claude bei schreibenden Tools standardmäßig vor jeder Aktion nachfragt.
- **Audit-Ringbuffer für MCP-Tool-Aufrufe** — die letzten 50 Calls werden in `AppSetting["mcpAuditLog"]` gespeichert und über das neue Tool `showRecentMcpActivity` abrufbar (Tool-Name, Dauer, ok-Flag, Error-Code, gekürzte Args).
- **Recipe-Origin** (`origin`-Feld auf `Recipe`) zur Unterscheidung von Paprika-Sync, lokalen LLM-Generaten (`origin: local-llm`) und manuell angelegten Rezepten. `paprikaUid` ist jetzt nullable; der Paprika-Sync filtert null-paprikaUid-Rezepte aus dem Update-Pfad und überschreibt damit lokale Rezepte nicht mehr.
- **Service-Layer** (`src/lib/planner.ts`, `src/lib/remix.ts`, `src/lib/meal-plan.ts`, `src/lib/shopping.ts`, `src/lib/recipe-create.ts`) extrahiert die Domänen-Logik aus den API-Routen, sodass MCP-Tools, Routes und Tests dieselben Funktionen verwenden.
- **INSTALLATION.md** — schritt-für-schritt-Anleitung für Synology-NAS-Setup inklusive Reverse-Proxy-Konfiguration und Claude-Desktop-Anbindung.

### Changed
- `getOpenAIClient()` cached die OpenAI-Instanz pro `(apiKey, baseURL)`-Kombination, damit über mehrere Tool-Aufrufe der gleiche HTTP-Pool wiederverwendet wird.
- Schreibtools mit kurzer DB-Zeit (`setMealForDay`, `createRecipeFromIngredients` mit `planForDate`) laufen jetzt zusammen mit ihrem Undo-Backup in einer Prisma-Transaktion. Schreibtools mit LLM-Latenz (`replaceMealForDay`) verwerfen das Backup bei einem Fehler explizit.
- `parseGermanDate` versteht zusätzliche Formen: `'in N Tagen'`, `'vor N Tagen'`, `'nächste Woche'`, Kurzformen (Mo/Di/Mon/Tue), `'diesen X'`/`'am X'` für aktuelle Woche, `'nächsten X'`/`'kommenden X'` für nächste Woche. Bare Wochentag am gleichen Wochentag rollt auf die kommende Woche statt auf heute.
- `searchRecipes` filtert standardmäßig Rezepte mit `excludeFromPlanning=true` heraus; ein optionales `includeExcluded`-Flag erlaubt das Abrufen aller Rezepte.
- `setMealForDay` mit mehrdeutigem `recipeQuery` führt keine stille Auswahl mehr durch, sondern liefert `MULTIPLE_MATCHES` mit Kandidatenliste zur Disambiguierung.
- `createRecipeFromIngredients` bricht hängende LLM-Aufrufe nach 45 s per `AbortController` ab, normalisiert/dedupliziert die Zutatenliste und schreibt `paprikaUid: null` explizit.
- `/mcp` exportiert explizite 405-Handler für `PUT`/`PATCH`/`HEAD` mit `Allow: GET, POST, DELETE`-Header zur klareren Diagnose von Fehlkonfigurationen.

### Security
- **CSRF defense in depth**: jede state-changing POST-Route (Login, Logout, Planner, Shopping, Pantry, Settings, Sync, Paprika-Export, Microsoft-Connect/Disconnect/Export) prüft jetzt zusätzlich zu `SameSite=Lax` den `Origin`-Header (Fallback `Referer`) gegen `APP_BASE_URL`. Cross-Origin-POSTs landen auf `/login?error=csrf`, statt Daten zu mutieren. Neues Helper-Modul `src/lib/same-origin.ts` mit `isSameOrigin`/`guardSameOrigin` plus sechs Vitest-Cases.
- **`__Host-cookingbot_session`**: das Session-Cookie nutzt auf HTTPS jetzt den `__Host-`-Prefix (kein `Domain`-Attribut zulässig, erzwingt `Secure`+`Path=/`). Im HTTP-Dev fällt der Name auf `cookingbot_session` zurück; `requireAuth` akzeptiert während der Umstellung beide Varianten, `clearSessionCookie` löscht beide.
- **Konstantzeit-Passwortvergleich**: `verifyPassword` hasht beide Seiten zuerst per SHA-256 und ruft dann `timingSafeEqual` auf. Damit verschwindet der Length-Short-Circuit, der zuvor die Passwortlänge über die Antwortzeit leakte.
- **Microsoft-OAuth-Start nur per POST**: der `GET`-Export auf `/api/microsoft/connect` wurde entfernt. Das Shopping-Board nutzt jetzt `<form method="post">` statt `<a href>`, sodass externe Seiten den OAuth-State-Cookie nicht mehr per `<img src>` setzen können.
- **Healthcheck-Detailgrad nach Auth gestaffelt**: anonyme Aufrufe (z. B. Docker `HEALTHCHECK`) bekommen weiterhin `{status, generatedAt}` mit 200/503, vollständiger Report mit Check-Aufschlüsselung erfordert eine authentifizierte Session, `HEALTH_PUBLIC_TOKEN` (Bearer oder `?token=`) oder `HEALTH_DETAILS_PUBLIC=true`.
- **SSRF-Hardening am Recipe-Image-Proxy**: DNS-Auflösung mit Block für RFC1918, CGNAT (100.64/10), Loopback, Link-Local (169.254), Multicast, sowie IPv6-Loopback/ULA. Timeout 10 s, Body-Limit 10 MiB; `https`-only nach Normalisierung.
- **`APP_BASE_URL` als Single-Source-of-Truth für Redirects** (`appUrl()`): in Production wird der Host-Header nicht mehr für Redirect-Targets verwendet, das verhindert Host-Header-Injection und Open-Redirects.
- **`TRUST_PROXY`-Schalter**: XFF-/`X-Real-IP`-Parsing im Login-Rate-Limiter ist nur noch aktiv, wenn der Reverse Proxy explizit als vertrauenswürdig markiert wurde. Ohne den Schalter spooft kein Angreifer mehr seine Quell-IP über Header.
- **Error-Logs entkernt**: `planner/generate`, `plan/item`, `paprika/export-remix` und der Paprika-Sync loggen nur noch `error.message` statt das ganze Error-Objekt, damit OpenAI-/Paprika-SDK-Requestbodies nicht ins Container-Log lecken können.
- **`MCP_BEARER_TOKEN` mit Mindestlänge**: weniger als 32 Zeichen verweigern in Production den Start.
- `DATABASE_URL` wird auf der Einstellungsseite maskiert (Schema, User, Host, DB-Name sichtbar – Passwort entfernt), sodass Screenshots oder Screen-Sharing keine Zugangsdaten preisgeben.
- MCP-Bearer-Token-Vergleich nutzt `crypto.timingSafeEqual` (konstantzeit) gegen Timing-Side-Channels.

### Fixed
- **Einkaufslisten-Restore** läuft jetzt in einer Prisma-Transaktion und entfernt das `lastDeletedShoppingList`-Backup nach erfolgreicher Wiederherstellung. Damit lassen sich gelöschte Listen nicht versehentlich mehrfach wiederherstellen, und ein Folgefehler hinterlässt keinen halb erstellten Datensatz.
- **Rezept-Foto** im Tile zeigt nach einem Fehlschlag wieder das Glyph-Fallback. Wechselt die `recipeId` (z. B. Kachelwechsel oder Modal-Navigation), versucht der Wrapper das Bild erneut zu laden statt im `failed`-Zustand zu verbleiben.
- **Rezept-Modal** behält den Body-Scroll-Lock korrekt, wenn mehrere Modals nacheinander geöffnet/geschlossen werden, und stellt den Fokus nur dann auf den Trigger-Button zurück, wenn dieser noch im DOM existiert.

## [0.2.0] – 2026-05-06

### Added
- **Settings-Seite** (`/settings`) mit Status der Integrationen (Paprika, OpenAI, Microsoft To Do), Datenübersicht und maskierten Konfigurationswerten.
- **Bulk-Aktionen für Einkaufslisten**: alle Items als erledigt markieren, gesamte Liste löschen, zuletzt gelöschte Liste wiederherstellen (`/api/shopping/bulk`).
- **Remix-Export nach Paprika** direkt aus dem Rezept-Modal (`/api/paprika/export-remix`).
- **Microsoft To Do – Direkt-OAuth**: `/api/microsoft/connect` startet den Login-Flow direkt, ohne Zwischenseite.
- **Container-Healthcheck**: `/api/health` liefert kompakten DB- und App-Status für Docker/Portainer; das Image nutzt den Container-Hostname.
- **Rezept-Foto-Wrapper** (`RecipeImageTile`) mit Paprika-Bildern, automatischem Fallback auf Glyph-Kachel und gemeinsamer Variante zwischen Card und Modal.
- **Erweiterter Planner-Date-Picker** mit deutschsprachiger Wochenübersicht und Mobile-tauglicher Eingabe.

### Changed
- Frontend vollständig auf Paprika-Cache-Redesign umgestellt: Fraunces + DM Sans, Tokens (`--paper`, `--ink`, `--forest`, `--terra`, `--gold`), Server-Components-First, plain CSS in `globals.css`.
- Recipe-Image-Proxy akzeptiert auch Paprika-`http://`-URLs, validiert Hosts gegen Private-IP/Localhost-Allowlist und folgt Redirects mit Limit.
- Modal-Close-Button bleibt über dem Foto-Hero positioniert; Mobile-Layout der Wochenübersicht und des Modals optimiert.
- Plan-Erzeugung trennt Planner- und Remix-Modell, `.env` dokumentiert beide getrennt.
- Microsoft-Sync-Backfill und Robustheit verbessert; LLM-Aufrufe mit Tests abgesichert.

### Infrastructure
- Env-Loader vereinheitlicht (`@/lib/env`), `APP_BASE_URL` zentral genutzt für Redirects, Login und Microsoft-OAuth.
- Trust-Proxy- und `PRISMA_DB_PUSH_ON_START`-Schalter explizit dokumentiert.
- Portainer-/Docker-Compose-Setup gehärtet, README mit Setup-, Settings- und Bulk-Action-Dokumentation aktualisiert.

## [0.1.0] – 2026-05-02

### Added
- Erstes öffentliches Cookingbot-Setup: App-Scaffold, Login, Paprika-Sync, Mealplaner, Einkaufslisten, Microsoft-To-Do-Export, LLM-gestützte Planung.

[Unreleased]: https://github.com/synobazz/cookingbot/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/synobazz/cookingbot/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/synobazz/cookingbot/releases/tag/v0.1.0
