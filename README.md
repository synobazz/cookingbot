# cookingbot

Private Kochhilfe für Wochenplanung mit Paprika-3-Rezepten, LLM-Vorschlägen, Remix-Ideen und Einkaufsliste.

## Screenshots

Die Screenshots nutzen Demo-Daten, damit die UI im Repository schnell einschätzbar ist.

![Login](docs/screenshots/01-login.png)

![Dashboard](docs/screenshots/02-dashboard.png)

![Rezepte](docs/screenshots/03-recipes.png)

![Wochenplan](docs/screenshots/04-planner.png)

![Einkaufsliste](docs/screenshots/05-shopping.png)

## Aktueller Funktionsumfang

- Login-geschützte private Website
- Paprika Cloud Sync über die inoffizielle/experimentelle API
- Lokaler Rezeptcache in SQLite inklusive Paprika-Bildfeldern
- Server-seitiger Rezeptbild-Proxy mit Placeholder für Rezepte ohne Bild
- Rezeptübersicht im Cookbook-Design mit Modal/Lightbox zum Kochen
- Manuelles Ausschließen einzelner Rezepte von der Abendplanung
- Wochenplanung für Abendessen: standardmäßig 7 Tage, aber frei auswählbare Tage
- Haushalt: 2 Erwachsene + 1 Kind (2,5 Personen)
- Harte Filter gegen ungeeignete Abendessen, z.B. alkoholische Getränke/Cocktails
- Saisonale Vorschläge und Rezept-Remixe durch ein OpenAI-kompatibles LLM
- Getrennte LLM-Modelle für Planung und kreative Remixe
- Pro Gericht im Wochenplan:
  - Rezept öffnen
  - Neu planen
  - Remixen
  - Remix nach Paprika exportieren
- Interne Einkaufsliste aus Rezeptzutaten
- Optionaler Microsoft-To-Do-Export für Einkaufspunkte
- Docker-Deployment für NAS/Portainer

## Roadmap / Ideen

- feinere Microsoft-To-Do-Sync-Optionen, z.B. bidirektionaler Statusabgleich
- bessere Zutaten-Normalisierung und Mengenaggregation
- Undo für Replan/Remix
- Suche/Filter auf der Rezeptseite
- optional weitere OpenAI-kompatible Provider

## Voraussetzungen

- Docker + Docker Compose oder Portainer
- Paprika-Cloud-Zugangsdaten
- OpenAI-kompatibler API-Key (`OPENAI_API_KEY`)
- für Microsoft To Do: Microsoft-Entra-App mit Redirect URI `${APP_BASE_URL}/api/microsoft/callback`
- ein eigenes starkes Login-Passwort für cookingbot
- ein langes zufälliges Session-Secret, z.B.:

```bash
openssl rand -base64 32
```

> Wichtig: Paprika hat keine offiziell stabile Public API. cookingbot nutzt experimentelle/inoffizielle Sync-Endpunkte. Lesen funktioniert bereits produktiv; der Paprika-Export für Remixe nutzt ebenfalls diese inoffizielle API und kann bei API-Änderungen Anpassungen brauchen.

## Setup lokal

```bash
cp .env.example .env
# .env ausfüllen
# lokal DATABASE_URL=file:./dev.db setzen
npm install
npm run db:push
npm run dev
```

Dann: <http://localhost:3000>

## Docker Compose

```bash
cp .env.example .env
# .env ausfüllen, DATABASE_URL=file:/data/cookingbot.db lassen
docker compose up -d --build
```

Die SQLite-Datenbank liegt im Docker-Volume `cookingbot-data` unter `/data/cookingbot.db`.

## Portainer auf NAS

### Variante A: Stack direkt aus GitHub

1. In Portainer: **Stacks → Add stack**.
2. Name: `cookingbot`.
3. **Repository** wählen.
4. Repository URL: `https://github.com/synobazz/cookingbot.git`.
5. Compose path: `docker-compose.yml`.
6. Environment Variables setzen:

```env
APP_BASE_URL=http://NAS-IP:3000
APP_SESSION_SECRET=<openssl-rand-base64-32>
APP_ADMIN_PASSWORD=<langes-login-passwort>
DATABASE_URL=file:/data/cookingbot.db

OPENAI_API_KEY=<dein-openai-api-key>
OPENAI_MODEL=
OPENAI_PLANNER_MODEL=gpt-5.4-mini
OPENAI_REMIX_MODEL=gpt-5.5
OPENAI_BASE_URL=

PAPRIKA_EMAIL=<paprika-email>
PAPRIKA_PASSWORD=<paprika-passwort>
PAPRIKA_API_BASE=https://www.paprikaapp.com/api

MICROSOFT_CLIENT_ID=<client-id>
MICROSOFT_CLIENT_SECRET=<client-secret>
MICROSOFT_TENANT_ID=consumers
```

7. Stack deployen.
8. App öffnen: `http://NAS-IP:3000` oder über deinen Reverse Proxy.

### Variante B: Web editor

Der reine Portainer-Web-Editor braucht ein bereits veröffentlichtes Container-Image. Aktuell ist noch kein `ghcr.io`-Image eingerichtet; bitte **Variante A** über das GitHub-Repo nutzen, damit Portainer direkt aus dem Repository baut.

### Reverse Proxy / HTTPS

Wenn cookingbot außerhalb des Heimnetzes erreichbar ist, bitte nur über HTTPS veröffentlichen, z.B. via Synology Reverse Proxy, Nginx Proxy Manager, Traefik oder Cloudflare Tunnel.

Empfehlung:

- extern: `https://cookingbot.example.com`
- intern im Container: `http://cookingbot:3000` oder `http://NAS-IP:3000`
- `APP_BASE_URL` auf die externe HTTPS-URL setzen
- Wenn du nur intern per `http://NAS-IP:3000` testest, `APP_BASE_URL` ebenfalls auf diese HTTP-Adresse setzen; bei HTTPS setzt cookingbot automatisch Secure-Cookies.

## Wichtige ENV-Werte

```env
APP_BASE_URL=http://localhost:3000
APP_SESSION_SECRET=ein-langer-zufallswert-mindestens-32-zeichen
APP_ADMIN_PASSWORD=dein-langes-login-passwort
DATABASE_URL=file:/data/cookingbot.db

OPENAI_API_KEY=...
OPENAI_MODEL=
OPENAI_PLANNER_MODEL=gpt-5.4-mini
OPENAI_REMIX_MODEL=gpt-5.5
OPENAI_BASE_URL=

PAPRIKA_EMAIL=...
PAPRIKA_PASSWORD=...
PAPRIKA_API_BASE=https://www.paprikaapp.com/api

MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_TENANT_ID=consumers
```

### LLM-Modellwahl

cookingbot nutzt getrennte Modelle:

- `OPENAI_PLANNER_MODEL` für Wochenplanung und normale Auswahlentscheidungen
- `OPENAI_REMIX_MODEL` für kreative Remix-Rezepte
- `OPENAI_MODEL` ist nur noch ein optionaler Fallback, falls die beiden spezifischen Variablen nicht gesetzt sind

Aktuelle Empfehlung:

```env
OPENAI_PLANNER_MODEL=gpt-5.4-mini
OPENAI_REMIX_MODEL=gpt-5.5
```

So bleibt die Planung günstiger/schneller, während kreative Remixe mit dem stärkeren Modell laufen.

> Hinweis: Modellnamen ändern sich bei OpenAI. Wenn ein Modell nicht verfügbar ist, die Werte in Portainer entsprechend auf ein verfügbares OpenAI-kompatibles Modell ändern.

In Production startet cookingbot nicht mit den Default-Werten `change-me` oder zu kurzen Secrets/Passwörtern.

## Nach dem ersten Login

1. Zu **Rezepte** gehen.
2. **Jetzt synchronisieren** klicken.
3. Danach in **Wochenplan** Startdatum, Personen und gewünschte Tage auswählen.
4. Plan erzeugen lassen.
5. Optional einzelne Tage **Neu planen** oder **Remixen**.
6. Aus dem Plan eine Einkaufsliste erstellen.

Der erste Paprika-Sync und die erste KI-Planung können je nach Rezeptmenge etwas dauern.

## Rezepte manuell von der Planung ausschließen

Auf der Rezeptseite gibt es pro Rezept einen Toggle:

- **Ausschließen**: Rezept wird nicht mehr für Abendessen verwendet
- **Einplanen erlauben**: Rezept darf wieder verwendet werden

Ausgeschlossene Rezepte werden ignoriert bei:

- Wochenplan generieren
- **Neu planen**
- **Was essen wir heute?**

Sie bleiben aber weiterhin im lokalen Rezeptcache sichtbar.

## Remixe nach Paprika exportieren

Wenn ein Gericht im Wochenplan geremixt wurde und Zutaten + Zubereitung vorhanden sind, erscheint der Button:

```text
Nach Paprika exportieren
```

Der Export:

1. legt ein neues Rezept in Paprika an,
2. speichert das Rezept auch lokal im cookingbot-Cache,
3. verknüpft das Wochenplan-Gericht danach mit dem neuen Rezept.

Der Export nutzt die inoffizielle Paprika-API. Wenn Paprika den Endpoint ändert, kann dieser Schritt fehlschlagen, ohne dass der lokale Remix verloren geht.

## Microsoft To Do Export

cookingbot kann Einkaufspunkte direkt als Aufgaben in eine Microsoft-To-Do-Liste schreiben. Dafür wird Microsoft Graph mit delegierter Berechtigung genutzt.

### Microsoft App registrieren

1. Im Microsoft Entra Admin Center oder Azure Portal eine neue App Registration erstellen.
2. Supported account types: für private Microsoft-Konten `Personal Microsoft accounts only` oder alternativ `Accounts in any organizational directory and personal Microsoft accounts`.
3. Redirect URI als Web Redirect setzen:

```text
https://deine-cookingbot-domain.example/api/microsoft/callback
```

Für lokale Tests entsprechend:

```text
http://localhost:3000/api/microsoft/callback
```

4. Client Secret erstellen.
5. API permissions hinzufügen: Microsoft Graph → Delegated permissions → `Tasks.ReadWrite` und `User.Read`.
6. ENV-Werte in Portainer setzen:

```env
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_TENANT_ID=consumers
```

Danach in cookingbot unter **Einkauf** auf **Microsoft To Do verbinden** klicken, einloggen und pro Einkaufsliste die gewünschte To-Do-Liste auswählen. Bereits exportierte Einkaufspunkte werden nicht erneut gesendet.

## Paprika API Notizen

Paprika ist nicht offiziell dokumentiert. cookingbot nutzt deshalb einen Adapter mit:

- Login: `POST /api/v1/account/login/` mit Basic Auth + Form Data
- Rezeptliste: `GET /api/v2/sync/recipes/` liefert nur `{ uid, hash }`
- Rezeptdetails: `GET /api/v2/sync/recipe/{uid}/`
- Remix-Export: `POST /api/v2/sync/recipe/{uid}/` mit gzip-komprimierter Rezeptdefinition

Bilder werden nicht direkt im Browser aus Paprika geladen, sondern über den serverseitigen Endpoint:

```text
/api/recipe-image/[recipeId]
```

Rezepte ohne Bild bekommen automatisch einen Placeholder.

## Backup

Die wichtigsten Daten liegen in der SQLite-Datei:

```text
/data/cookingbot.db
```

Bei Portainer/Docker ist das im Volume `cookingbot-data`. Dieses Volume bzw. die DB-Datei regelmäßig mit dem NAS-Backup sichern. Ohne Backup gehen lokale Pläne, Ausschluss-Toggles, Einkaufsliste und Rezeptcache verloren; Paprika-Rezepte können zwar neu synchronisiert werden, lokale Pläne aber nicht.

## Updates

Bei Git-Stack in Portainer:

1. Stack öffnen.
2. **Pull and redeploy** / **Update the stack** ausführen.
3. Logs prüfen.
4. App öffnen und Login testen.

Beim Containerstart läuft:

```text
prisma db push --skip-generate
```

Dadurch werden neue SQLite-Felder beim Redeploy automatisch ergänzt.

## Troubleshooting

- **Login funktioniert nicht in Docker:** `APP_ADMIN_PASSWORD` prüfen. In Production darf es nicht `change-me` sein und muss mindestens 12 Zeichen haben.
- **Redirect springt auf Container-ID:** `APP_BASE_URL` muss exakt auf die verwendete URL zeigen, z.B. `http://192.168.1.2:3000` oder deine HTTPS-Domain.
- **Container startet nicht:** Logs in Portainer prüfen. Häufig fehlen `APP_SESSION_SECRET`, `APP_ADMIN_PASSWORD` oder `DATABASE_URL`.
- **Paprika-Sync schlägt fehl:** Paprika-Zugangsdaten prüfen; die API ist inoffiziell und kann sich ändern.
- **Rezeptbilder fehlen:** Nicht jedes Paprika-Rezept hat ein Bild. Nach Updates mit neuen Bildfeldern einmal neu synchronisieren.
- **Paprika-Export schlägt fehl:** Der Remix bleibt lokal erhalten. Logs prüfen; der Export nutzt einen inoffiziellen Paprika-Schreibendpoint.
- **KI-Planung schlägt fehl:** `OPENAI_API_KEY`, `OPENAI_PLANNER_MODEL`, `OPENAI_REMIX_MODEL` und ggf. `OPENAI_BASE_URL` prüfen.
- **Microsoft-Verbindung schlägt fehl:** Redirect URI in der Microsoft App muss exakt `${APP_BASE_URL}/api/microsoft/callback` entsprechen; `MICROSOFT_CLIENT_ID` und `MICROSOFT_CLIENT_SECRET` prüfen.
- **Daten weg nach Redeploy:** Volume `cookingbot-data` prüfen; ohne persistentes Volume wird die SQLite-DB gelöscht.
