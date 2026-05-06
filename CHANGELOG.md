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
