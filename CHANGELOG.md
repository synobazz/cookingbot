# Changelog

Alle nennenswerten Änderungen an Cookingbot werden hier dokumentiert.
Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung an [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

### Added
- **MCP-Server unter `/mcp`** — Cookingbot exponiert acht Tools (`getMealForDay`, `getMealPlan`, `searchRecipes`, `getShoppingList`, `findRecipeByCraving`, `setMealForDay`, `replaceMealForDay`, `createRecipeFromIngredients`) plus `undoLastMealChange` für externe LLM-Clients wie Claude Desktop. Authentifizierung per statischem Bearer-Token (`MCP_BEARER_TOKEN`); ohne gesetztes Token antwortet der Endpoint mit HTTP 503. Schreibtools speichern vor jeder Änderung ein einstufiges Undo-Backup im `AppSetting`-Store.
- **Recipe-Origin** (`origin`-Feld auf `Recipe`) zur Unterscheidung von Paprika-Sync, lokalen LLM-Generaten und manuell angelegten Rezepten. `paprikaUid` ist jetzt nullable, wodurch der Paprika-Sync lokale Rezepte nicht mehr überschreibt.
- **Service-Layer** (`src/lib/planner.ts`, `src/lib/remix.ts`, `src/lib/meal-plan.ts`, `src/lib/shopping.ts`) extrahiert die Domänen-Logik aus den API-Routen, sodass MCP-Tools, Routes und potentielle Tests dieselben Funktionen verwenden.

### Security
- `DATABASE_URL` wird auf der Einstellungsseite maskiert (Schema, User, Host, DB-Name sichtbar – Passwort entfernt), sodass Screenshots oder Screen-Sharing keine Zugangsdaten preisgeben.

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
