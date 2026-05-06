# Cookingbot Installation auf Synology NAS

Diese Anleitung beschreibt eine vollständige Cookingbot-Installation auf einem Synology NAS mit Portainer und der Anbindung des MCP-Servers an Claude Desktop.

Sie ist bewusst ausführlich gehalten und richtet sich an die Erstinstallation auf einem NAS, das noch keinen Portainer-Stack betreibt. Wer Portainer und Reverse-Proxy schon nutzt, kann direkt zu [3. Stack ausrollen](#3-stack-ausrollen) springen.

---

## Inhalt

1. [Voraussetzungen](#1-voraussetzungen)
2. [Vorbereitung](#2-vorbereitung)
3. [Stack ausrollen](#3-stack-ausrollen)
4. [Reverse Proxy mit HTTPS](#4-reverse-proxy-mit-https)
5. [Datenbank-Migration prüfen](#5-datenbank-migration-prüfen)
6. [Erstkonfiguration im Browser](#6-erstkonfiguration-im-browser)
7. [Paprika-Sync aktivieren](#7-paprika-sync-aktivieren)
8. [MCP-Server an Claude Desktop anbinden](#8-mcp-server-an-claude-desktop-anbinden)
9. [Backups und Updates](#9-backups-und-updates)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Voraussetzungen

### Hardware/Software

- Synology NAS mit DSM 7.x und Container Manager (oder Docker-Paket).
- Mindestens 1 GB freier RAM für den Container; SQLite-Datei wächst typischerweise mit 100–500 KB pro 100 Rezepte.
- Portainer CE 2.x als Web-UI vor dem Container Manager. Alternativ funktioniert auch der DSM-eigene Container Manager mit Stacks; alle Beispiele unten sind Portainer-spezifisch.

### Externe Konten

- **OpenAI API Key** mit Zugriff auf ein Reasoning-Modell (Default: `gpt-5.4-mini` für Planung, `gpt-5.5` für Remix). Beide Modellnamen sind über ENV-Variablen austauschbar.
- **Paprika 3** Account (optional, aber empfohlen). Cookingbot zieht daraus die Rezepte.
- **Microsoft 365 / To-Do** App-Registrierung (optional) für den Einkaufslisten-Export. Siehe README, Sektion *Microsoft / To Do*.
- **Claude Desktop** oder **Claude.ai** mit aktiviertem MCP-Connector, falls die Bot-Steuerung über Claude gewünscht ist.

### Netzwerk

- Eine Domain oder Subdomain (z. B. `cookingbot.example.de`), die per Reverse Proxy auf den Container zeigt. Lokaler Betrieb ohne HTTPS ist möglich, dann muss `APP_BASE_URL` auf `http://NAS-IP:3000` zeigen.
- TLS-Zertifikat. Synology DSM kann Let's-Encrypt-Zertifikate selbst verwalten und an den Reverse Proxy weiterreichen.

---

## 2. Vorbereitung

### 2.1 Secrets erzeugen

Bevor der Stack deployed wird, einmal lokal alle Geheimnisse erzeugen. Auf macOS/Linux:

```bash
# Session-Secret (Cookies)
openssl rand -base64 48

# Admin-Passwort (zum ersten Login)
openssl rand -base64 24

# MCP-Bearer-Token (Claude → Cookingbot)
openssl rand -base64 48
```

Werte sicher ablegen, z. B. in einem Passwort-Manager. Sie werden gleich in den Portainer-Stack eingetragen.

### 2.2 Portainer auf dem NAS einrichten (falls nicht vorhanden)

1. Container Manager öffnen → Registry → `portainer/portainer-ce` herunterladen.
2. Container starten mit Volume `/var/run/docker.sock:/var/run/docker.sock` und `portainer_data:/data`.
3. Web-UI auf Port 9000/9443 öffnen, Admin-Account anlegen, lokale Docker-Umgebung verbinden.

---

## 3. Stack ausrollen

Es gibt zwei Varianten: **Repository-Stack** (Portainer baut das Image direkt aus dem Git-Repo) und **Compose-Editor** (manuelles Hochladen einer Compose-Datei). Repository-Stack ist robuster und wird empfohlen.

### 3.1 Variante A: Repository-Stack (Recommended)

1. In Portainer → Stacks → **Add stack**.
2. Name: `cookingbot`.
3. Build method: **Repository**.
4. Repository-URL eintragen, z. B. `https://github.com/<user>/cookingbot.git`.
5. Compose path: `docker-compose.yml`.
6. Reference: `refs/heads/main` (oder den gewünschten Branch).
7. **Environment variables** ausfüllen (ein Paar pro Zeile):

   ```env
   APP_BASE_URL=https://cookingbot.example.de
   APP_SESSION_SECRET=<aus 2.1>
   APP_ADMIN_PASSWORD=<aus 2.1>
   OPENAI_API_KEY=sk-...
   OPENAI_PLANNER_MODEL=gpt-5.4-mini
   OPENAI_REMIX_MODEL=gpt-5.5
   PAPRIKA_EMAIL=mail@example.de
   PAPRIKA_PASSWORD=...
   MICROSOFT_CLIENT_ID=...
   MICROSOFT_CLIENT_SECRET=...
   MICROSOFT_TENANT_ID=consumers
   TRUST_PROXY=true
   PRISMA_DB_PUSH_ON_START=true
   MCP_BEARER_TOKEN=<aus 2.1>
   ```

   Hinweis zu `TRUST_PROXY`: Nur `true`, wenn ein vertrauenswürdiger Reverse Proxy davor steht, der `X-Forwarded-For` korrekt setzt. Sonst leer lassen.

8. **Deploy the stack** klicken. Portainer klont das Repo, baut das Image und startet den Container. Beim ersten Mal dauert das mehrere Minuten.

### 3.2 Variante B: Compose-Editor

Funktioniert nur, wenn ein gebautes Container-Image öffentlich auf einer Registry liegt. Wer kein Image veröffentlicht, sollte Variante A nutzen.

---

## 4. Reverse Proxy mit HTTPS

Cookingbot lauscht im Container auf Port 3000. Für den Außenzugriff (vor allem für Claude.ai, das den MCP-Endpoint per HTTPS abruft) braucht es einen Reverse Proxy mit gültigem TLS-Zertifikat.

### Option A: Synology Reverse Proxy (DSM)

1. DSM → Login Portal → **Erweitert** → **Reverse Proxy** → Erstellen.
2. Quelle: `https://cookingbot.example.de`, Port `443`, HSTS aktivieren.
3. Ziel: `http://localhost:3000` (oder `http://NAS-IP:3000`).
4. Custom Header → WebSocket: `Upgrade` und `Connection` weiterleiten (für zukünftige SSE-Erweiterungen sinnvoll).
5. Custom Header → Pass-through: `X-Forwarded-For`, `X-Real-IP`, `X-Forwarded-Proto`.

### Option B: Nginx Proxy Manager / Traefik

Standard-Proxy-Konfiguration mit `proxy_pass http://cookingbot:3000`. WebSocket-Upgrade erlauben, Forwarded-Header weiterreichen.

### TLS-Zertifikat

DSM verwaltet Let's-Encrypt-Zertifikate selbst. Im Reverse-Proxy-Eintrag das passende Zertifikat zuweisen (Steuerungszentrum → Sicherheit → Zertifikate).

---

## 5. Datenbank-Migration prüfen

Beim ersten Start setzt das Entrypoint-Skript die SQLite-Datenbank automatisch auf, weil `PRISMA_DB_PUSH_ON_START=true` gesetzt ist. Das Volume `cookingbot-data` (gemountet als `/data`) hält die SQLite-Datei dauerhaft.

Logs prüfen:

```text
prisma db push completed
✓ Ready in <ms> ms
```

Erscheint stattdessen ein Fehler über fehlende Spalten, hilft ein erneuter Stack-Start (Portainer → Stack → Update). Das `db push` ist idempotent.

> **Achtung Update von Cookingbot < 0.3.0**: Mit Version 0.3.0 ist das Recipe-Schema erweitert worden (`paprikaUid` ist jetzt optional, `origin` neu). `PRISMA_DB_PUSH_ON_START=true` rollt das beim Container-Start automatisch aus. Wer manuelle Migrationen fährt, muss `npx prisma db push` einmal manuell ausführen.

---

## 6. Erstkonfiguration im Browser

1. Im Browser `https://cookingbot.example.de` öffnen.
2. Mit dem Admin-Passwort einloggen, das in `APP_ADMIN_PASSWORD` gesetzt wurde.
3. Settings → Profil prüfen.
4. Settings → Microsoft (optional) → Login & To-Do-Liste auswählen, falls ein Einkaufslisten-Export gewünscht ist.

---

## 7. Paprika-Sync aktivieren

1. Settings → Paprika.
2. Sync starten. Cookingbot lädt alle Rezepte (kann beim ersten Mal mehrere Minuten dauern).
3. Status: Sync-Datum + Anzahl der Rezepte werden angezeigt.

Der Sync-Job läuft fortan im Hintergrund (täglich), zieht Änderungen aus Paprika und respektiert lokal erzeugte Rezepte (`origin: local-llm`), die durch das MCP-Tool `createRecipeFromIngredients` entstehen.

---

## 8. MCP-Server an Claude Desktop anbinden

### 8.1 Endpoint testen

Mit dem Bearer-Token aus 2.1 einmal manuell prüfen, ob der MCP-Server antwortet:

```bash
curl -i -X POST https://cookingbot.example.de/mcp \
  -H "Authorization: Bearer <DEIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Erwartete Antwort: HTTP 200 + JSON mit allen Tools (`ping`, `getMealForDay`, `getMealPlan`, `searchRecipes`, …).

Mögliche Fehler:

| Status | Bedeutung |
| --- | --- |
| `503` | `MCP_BEARER_TOKEN` ist im Container nicht gesetzt. Stack-ENV prüfen, neu deployen. |
| `401` | Token falsch oder Header fehlt. |
| `405` | Methode nicht erlaubt. Nur `POST` / `GET` / `DELETE` werden akzeptiert. |
| Timeout | Reverse Proxy blockiert WebSocket/Upgrade-Header oder leitet die Route nicht weiter. |

### 8.2 Claude Desktop konfigurieren

Claude Desktop liest seine MCP-Server-Konfiguration aus

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Eintrag für Cookingbot ergänzen (existierende `mcpServers`-Sektion erweitern, nicht ersetzen):

```json
{
  "mcpServers": {
    "cookingbot": {
      "transport": "http",
      "url": "https://cookingbot.example.de/mcp",
      "headers": {
        "Authorization": "Bearer <DEIN_TOKEN>"
      }
    }
  }
}
```

Claude Desktop komplett neu starten (Cmd+Q / Quit, nicht nur Fenster schließen). In einem neuen Chat sollte unten in der Tool-Anzeige ein Cookingbot-Eintrag erscheinen mit allen Tools.

### 8.3 Erste Tool-Aufrufe

In einem Claude-Chat folgendes ausprobieren:

- *„Was kochen wir heute?“* → ruft `getMealForDay` mit `date: "heute"` auf.
- *„Tausche das Gericht für Donnerstag aus.“* → ruft `replaceMealForDay` auf, fragt vorher nach Bestätigung (destructive).
- *„Welche letzten Tool-Aktionen gab es?“* → `showRecentMcpActivity` liefert die letzten 20 Calls.

Wegen der `annotations.destructiveHint`-Markierungen fragt Claude bei schreibenden Tools (`setMealForDay`, `replaceMealForDay`, `createRecipeFromIngredients`, `undoLastMealChange`) per Default vor jedem Aufruf nach Bestätigung. Lese-Tools laufen ohne Rückfrage.

### 8.4 Claude.ai (Web-Client)

Cookingbot exponiert keine CORS-Header — Claude Desktop ruft den Endpoint serverseitig auf, ohne Browser-Origin. Wer Claude.ai (Web) statt Claude Desktop nutzen möchte, muss einen MCP-Connector über die Claude.ai-Settings einrichten; auch dieser Connector ruft den Endpoint serverseitig auf, also ist keine CORS-Erweiterung nötig.

---

## 9. Backups und Updates

### Backup

Das Volume `cookingbot-data` (Mount-Punkt `/data` im Container) enthält:

- `cookingbot.db` — die komplette SQLite-Datenbank: Rezepte, Pläne, Einkaufslisten, MCP-Audit-Log.

Das Volume in Hyper Backup einbinden oder per `rsync` auf ein zweites Ziel sichern. Die App muss dafür nicht angehalten werden — SQLite mit Default-Journal-Modus erlaubt konkurrierende Reads.

### Updates

Bei Repository-Stack:

1. Portainer → Stacks → cookingbot → **Pull and redeploy**.
2. Portainer baut das Image neu, startet den Container, der Entrypoint führt `prisma db push --skip-generate` aus.

Major-Updates (z. B. 0.2.x → 0.3.x) erst lokal/in einem Staging testen, falls man auf Nummer sicher gehen will.

---

## 10. Troubleshooting

### Container startet nicht

- Logs in Portainer prüfen: Stacks → cookingbot → Container → Logs.
- Häufigste Ursache: Eine Pflicht-Umgebungsvariable (`APP_BASE_URL`, `APP_SESSION_SECRET`, `APP_ADMIN_PASSWORD`, `OPENAI_API_KEY`) ist leer. Compose-Direktive `${VAR:?…}` macht den Fehlertext eindeutig.

### MCP gibt 503 zurück

- Token nicht gesetzt. `MCP_BEARER_TOKEN` in den Stack-Variablen ergänzen, neu deployen.

### MCP gibt 401 zurück

- Header-Prefix prüfen: `Authorization: Bearer <token>` (Großschreibung egal, aber das Wort `Bearer` muss vorne stehen).
- Token in Claude Desktop und Container-ENV vergleichen — am besten kopieren, nicht abtippen.

### Claude sagt „Tool hängt“

- `showRecentMcpActivity` aufrufen, schauen ob ein vorheriger Call mit `errorCode: LLM_TIMEOUT` endete. Falls ja: OpenAI-Provider hat lange gebraucht. Default-Timeout für `createRecipeFromIngredients` liegt bei 45 s.
- Reverse-Proxy-Timeout prüfen. Synology Reverse Proxy hat einen Default-Read-Timeout von 60 s — sollte für Cookingbot reichen, kann aber bei sehr langen Planungs-Requests knapp werden.

### Paprika-Sync überschreibt lokale Rezepte nicht mehr

Erwünschtes Verhalten ab 0.3.0: Lokal erzeugte Rezepte (`origin: local-llm`) haben kein `paprikaUid`. Der Sync filtert sie deshalb aus dem Update-Pfad raus. Wer ein lokales Rezept löschen will, macht das in der Cookingbot-UI (Trash).

### Logs zu MCP-Calls aktivieren

Die letzten 50 Tool-Aufrufe stehen im Audit-Ringbuffer (`AppSetting["mcpAuditLog"]`). Über das Tool `showRecentMcpActivity` abrufbar. Mehr braucht's normalerweise nicht; wer wirklich Stack-Traces braucht, dreht in Portainer den Container-Log-Level hoch (Compose-Variable `NODE_ENV=development`, neu deployen, danach unbedingt zurückstellen).

---

## Anhang A: Vollständige `.env`-Übersicht

Eine kurze Referenz aller relevanten Variablen für den Synology-Stack:

| Variable | Pflicht | Default | Bedeutung |
| --- | --- | --- | --- |
| `APP_BASE_URL` | ja | — | Externe Basis-URL inkl. Schema, z. B. `https://cookingbot.example.de`. |
| `APP_SESSION_SECRET` | ja | — | Session-Cookie-Signing-Key. Mindestens 32 Zeichen zufällig. |
| `APP_ADMIN_PASSWORD` | ja | — | Erst-Login-Passwort. Nach erstem Login in Settings ändern. |
| `DATABASE_URL` | nein | `file:/data/cookingbot.db` | Compose setzt das automatisch. |
| `OPENAI_API_KEY` | ja | — | OpenAI-Token mit Zugriff auf das gewählte Modell. |
| `OPENAI_PLANNER_MODEL` | nein | `gpt-5.4-mini` | Modell für Wochenplan-Generierung. |
| `OPENAI_REMIX_MODEL` | nein | `gpt-5.5` | Modell für Tagesgericht-Tausch und Rezept-Generierung. |
| `PAPRIKA_EMAIL` / `PAPRIKA_PASSWORD` | nein | — | Wenn gesetzt, wird der Sync aktiv. |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT_ID` | nein | — | Für Microsoft-To-Do-Export. |
| `TRUST_PROXY` | nein | leer | `true` nur hinter vertrauenswürdigem Reverse Proxy. |
| `PRISMA_DB_PUSH_ON_START` | nein | `true` | Beim Container-Start `prisma db push` ausführen. |
| `MCP_BEARER_TOKEN` | nein | leer | Wenn gesetzt, ist `/mcp` aktiv. Sonst HTTP 503. |

Vollständige Doku zu allen Variablen und allen MCP-Tools im [README](./README.md).
