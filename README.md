# cookingbot

Private Kochhilfe für Wochenplanung mit Paprika-3-Rezepten, LLM-Vorschlägen und Einkaufsliste.

## V1-Ziel

- Paprika Cloud Sync über die inoffizielle/experimentelle API
- Rezeptcache in SQLite
- Login-geschützte Website
- Wochenplanung für Abendessen: standardmäßig 7 Tage, aber frei auswählbare Tage
- Haushalt: 2 Erwachsene + 1 Kind (2,5 Personen)
- Saisonale Vorschläge und Rezept-Remixe durch ein OpenAI-kompatibles LLM
- Interne Einkaufsliste aus Rezeptzutaten
- Docker-Deployment für NAS/Portainer

## V2-Ideen

- Export/Sync der Einkaufsliste nach Microsoft Todo
- Remix-Rezepte direkt zu Paprika hinzufügen
- feinere Familien-/Zykluslogik
- bessere Zutaten-Normalisierung und Mengenaggregation
- optional OpenAI OAuth/Bring-your-own-provider

## Voraussetzungen

- Docker + Docker Compose oder Portainer
- Paprika-Cloud-Zugangsdaten
- OpenAI-kompatibler API-Key (`OPENAI_API_KEY`)
- ein eigenes starkes Login-Passwort für cookingbot
- ein langes zufälliges Session-Secret, z.B.:

```bash
openssl rand -base64 32
```

> Wichtig: Paprika hat keine offiziell stabile Public API. cookingbot nutzt den experimentellen/inoffiziellen Sync-Endpunkt. V1 liest aus Paprika, schreibt aber keine Rezepte zurück.

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
APP_BASE_URL=https://deine-cookingbot-domain.example
APP_SESSION_SECRET=<openssl-rand-base64-32>
APP_ADMIN_PASSWORD=<langes-login-passwort>
DATABASE_URL=file:/data/cookingbot.db
OPENAI_API_KEY=<dein-openai-api-key>
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=
PAPRIKA_EMAIL=<paprika-email>
PAPRIKA_PASSWORD=<paprika-passwort>
PAPRIKA_API_BASE=https://www.paprikaapp.com/api
```

7. Stack deployen.
8. App öffnen: `http://NAS-IP:3000` oder über deinen Reverse Proxy.

### Variante B: Web editor

Der reine Portainer-Web-Editor braucht ein bereits veröffentlichtes Container-Image. Aktuell ist noch kein `ghcr.io`-Image eingerichtet; für V1 bitte **Variante A** über das GitHub-Repo nutzen, damit Portainer direkt aus dem Repository baut. Ein fertiges Image kann später über GitHub Actions ergänzt werden.

### Reverse Proxy / HTTPS

Wenn cookingbot außerhalb des Heimnetzes erreichbar ist, bitte nur über HTTPS veröffentlichen, z.B. via Synology Reverse Proxy, Nginx Proxy Manager, Traefik oder Cloudflare Tunnel.

Empfehlung:

- extern: `https://cookingbot.example.com`
- intern im Container: `http://cookingbot:3000` oder `http://NAS-IP:3000`
- `APP_BASE_URL` auf die externe HTTPS-URL setzen
- Wenn du nur intern per `http://NAS-IP:3000` testest, `APP_BASE_URL` ebenfalls auf diese HTTP-Adresse setzen; bei HTTPS setzt cookingbot automatisch Secure-Cookies.

### Backup

Die wichtigsten Daten liegen in der SQLite-Datei:

```text
/data/cookingbot.db
```

Bei Portainer/Docker ist das im Volume `cookingbot-data`. Dieses Volume bzw. die DB-Datei regelmäßig mit dem NAS-Backup sichern. Ohne Backup gehen lokale Pläne, Einkaufsliste und Rezeptcache verloren; Paprika-Rezepte können zwar neu synchronisiert werden, lokale Pläne aber nicht.

### Updates

Bei Git-Stack in Portainer:

1. Stack öffnen.
2. **Pull and redeploy** / **Update the stack** ausführen.
3. Logs prüfen.
4. App öffnen und Login testen.

## Wichtige ENV-Werte

```env
APP_SESSION_SECRET=ein-langer-zufallswert-mindestens-32-zeichen
APP_ADMIN_PASSWORD=dein-langes-login-passwort
DATABASE_URL=file:/data/cookingbot.db
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
PAPRIKA_EMAIL=...
PAPRIKA_PASSWORD=...
```

In Production startet cookingbot nicht mit den Default-Werten `change-me` oder zu kurzen Secrets/Passwörtern.

## Nach dem ersten Login

1. Zu **Rezepte** gehen.
2. **Jetzt synchronisieren** klicken.
3. Danach in **Wochenplan** Startdatum, Personen und gewünschte Tage auswählen.
4. Plan erzeugen lassen.
5. Aus dem Plan eine Einkaufsliste erstellen.

Der erste Paprika-Sync und die erste KI-Planung können je nach Rezeptmenge etwas dauern.

## Paprika API Notizen

Paprika ist nicht offiziell dokumentiert. V1 nutzt deshalb einen Adapter mit:

- Login: `POST /api/v1/account/login/` mit Basic Auth + Form Data
- Rezeptliste: `GET /api/v2/sync/recipes/` liefert nur `{ uid, hash }`
- Rezeptdetails: `GET /api/v2/sync/recipe/{uid}/`

Schreibzugriffe zu Paprika bleiben für V1 bewusst aus. Remixe werden erst lokal geplant; Paprika-Export kommt später kontrolliert dazu.

## Troubleshooting

- **Login funktioniert nicht in Docker:** `APP_ADMIN_PASSWORD` prüfen. In Production darf es nicht `change-me` sein und muss mindestens 12 Zeichen haben.
- **Container startet nicht:** Logs in Portainer prüfen. Häufig fehlen `APP_SESSION_SECRET`, `APP_ADMIN_PASSWORD` oder `DATABASE_URL`.
- **Paprika-Sync schlägt fehl:** Paprika-Zugangsdaten prüfen; die API ist inoffiziell und kann sich ändern.
- **KI-Planung schlägt fehl:** `OPENAI_API_KEY`, Modellname und ggf. `OPENAI_BASE_URL` prüfen.
- **Daten weg nach Redeploy:** Volume `cookingbot-data` prüfen; ohne persistentes Volume wird die SQLite-DB gelöscht.
