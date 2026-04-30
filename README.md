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
- Docker-Deployment für NAS

## V2-Ideen

- Export/Sync der Einkaufsliste nach Microsoft Todo
- Remix-Rezepte direkt zu Paprika hinzufügen
- feinere Familien-/Zykluslogik
- bessere Zutaten-Normalisierung und Mengenaggregation
- optional OpenAI OAuth/Bring-your-own-provider

## Setup lokal

```bash
cp .env.example .env
# .env ausfüllen
npm install
npm run db:push
npm run dev
```

Dann: <http://localhost:3000>

## Docker

```bash
cp .env.example .env
# .env ausfüllen
docker compose up -d --build
```

## Wichtige ENV-Werte

```env
APP_SESSION_SECRET=ein-langer-zufallswert
APP_ADMIN_PASSWORD=dein-login-passwort
DATABASE_URL=file:/data/cookingbot.db
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
PAPRIKA_EMAIL=...
PAPRIKA_PASSWORD=...
```

## Paprika API Notizen

Paprika ist nicht offiziell dokumentiert. V1 nutzt deshalb einen Adapter mit:

- Login: `POST /api/v1/account/login/` mit Basic Auth + Form Data
- Rezeptliste: `GET /api/v2/sync/recipes/` liefert nur `{ uid, hash }`
- Rezeptdetails: `GET /api/v2/sync/recipe/{uid}/`

Schreibzugriffe zu Paprika bleiben für V1 bewusst aus. Remixe werden erst lokal geplant; Paprika-Export kommt später kontrolliert dazu.
