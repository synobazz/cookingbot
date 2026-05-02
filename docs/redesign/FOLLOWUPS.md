# Frontend-Redesign · Folge-Arbeiten

Stand: Foundation + Dashboard sind migriert (Build/Lint/TS clean). Diese Datei
listet alles, was für ein vollständiges 1:1-Match zum Prototyp
(`docs/redesign/cookingbot-redesign.html`) noch zu erledigen ist.

## Verbindliche Regeln (gelten weiter)

- NICHT anfassen: `prisma/schema.prisma`, `src/lib/**`, `src/app/api/**`,
  Auth/Docker/ENV.
- Server Components als Default, Client nur für State.
- Plain CSS, kein Tailwind.
- Inline-SVGs aus `src/app/_components/icons.tsx`, kein Icon-Package.
- TypeScript strict, kein `any`.
- a11y: Modal mit Focus-Trap + ESC + body-overflow lock (bereits in
  `RecipeModal`), Tastatur-Navigation in Toggles, `aria-current="page"` für
  aktive Nav-Items.

## Page-Migrationen

### `/recipes` (`src/app/recipes/page.tsx`)

Prototyp-Sektion: `#screen-recipes` (Zeilen ~801–840 in
`docs/redesign/cookingbot-redesign.html`).

Aufgaben:
- `page-head` mit Eyebrow `"Paprika · lokaler Cache"`, Display-H1 `Rezepte<em>.</em>`,
  Subtitle `"{count} Rezepte · zuletzt synchronisiert vor …"`.
  Zeitangabe relativ (`date-fns/formatDistanceToNow` mit `de`-Locale) aus
  `MAX(recipe.lastSyncedAt)`.
- Actions: `Jetzt synchronisieren` (POST `/api/sync/paprika`), `Neue Woche planen`
  (Link `/planner`).
- Filter-Bar (`<RecipeFilters />`, Client-Component, neu in `_components/`):
  - Suchfeld (debounced, schreibt in URL `?q=`).
  - Tag-Chips: `Alle`, `Saisonal`, `Schnell`, `Vegetarisch`, `Familienliebling`,
    `Reis & Pasta`. Toggle über `?tag=…`.
  - Sort-Select: `Zuletzt synchronisiert`, `Bewertung`, `Name`. → `?sort=`.
- Grid `.rec-strip` mit `<RecipeCard />`.
- Pagination/Infinite-Scroll: erstmal Take=48 + Link „mehr laden“ (URL `?take=`).
- Datenquelle: Prisma-Query mit `where: { inTrash: false }` und Filter-Logik
  serverseitig.

Dateien:
- `src/app/recipes/page.tsx` (Server, liest `searchParams`).
- `src/app/_components/recipe-filters.tsx` (Client, schreibt URL via
  `useRouter`/`useSearchParams`).
- Entfernen: alte Card-Markups; vorher `git grep` nach Verwendung von
  `RecipeDetails` in dieser Datei.

### `/planner` (`src/app/planner/page.tsx`)

Prototyp-Sektion: `#screen-planner` (~Zeilen 847–910).

Aufgaben:
- `page-head` mit Eyebrow `"Wochenplaner · KW {n}"`, H1 `Plane diese <em>Woche.</em>`,
  Subtitle Saisonal-Hinweis.
- `.planner-grid` mit zwei Spalten:
  - Links: `<DayToggleGroup />` (7 Toggle-Buttons Mo–So), `<PeopleStepper />`
    (1.0–6.0 in 0.5-Schritten, default aus letztem Plan oder 2.5),
    Start-Date-Input (`<input type="date">`), Generate-Button
    (POST `/api/plan/generate`).
  - Rechts: `.planner-preview` mit aktuellen `MealItem`-Cards des letzten Plans;
    pro Card `<RecipeModal />` zum Öffnen, Buttons `Tauschen` (POST
    `/api/plan/item` mit `action: "swap"`) und `Entfernen`.
- Form-State client-seitig (`use client`), submit POST mit `fetch` + Reload via
  `router.refresh()`.

Dateien:
- `src/app/planner/page.tsx` (Server für Initial-Load).
- `src/app/planner/planner-form.tsx` (Client, kapselt Toggles+Stepper+Submit).
- `src/app/_components/day-toggle-group.tsx` (Client, Tastatur-Nav: Pfeile
  bewegen Fokus, Space toggelt; Klassen `.day-toggles` und `.day-toggle.on`
  laut Prototyp Zeilen 399–410).
- `src/app/_components/people-stepper.tsx` (Client, `−`/`+` Buttons + numerische
  Anzeige; Klassen `.people-stepper`).

### `/shopping` (`src/app/shopping/page.tsx`)

Prototyp-Sektion: `#screen-shopping` (~Zeilen 917–990).

Aufgaben:
- `page-head` mit H1 `Einkaufsliste<em>.</em>`, Subtitle „aus Plan {planTitle}“.
- Actions: `Microsoft To Do exportieren` (POST
  `/api/microsoft/export-shopping`), `Liste neu erzeugen`
  (POST `/api/shopping/generate`).
- Stats-Strip: `{open}` offen, `{checked}` erledigt, `{categories}` Kategorien.
- `.shop-cats` Grid: pro Kategorie eine `<ShoppingCategory />` mit Header
  (Name + Count) und Item-Liste.
- `<ShoppingItemRow />` als `<button>` mit optimistic Toggle:
  - on click: lokal `checked` togglen, `fetch("/api/shopping/toggle", …)`,
    bei Fehler revert + Toast (siehe `submit-feedback.tsx`).
- Drag-&-Drop kommt NICHT in dieser Iteration (Prototyp zeigt es nicht).

Dateien:
- `src/app/shopping/page.tsx` (Server, lädt aktuelle Liste).
- `src/app/shopping/shopping-board.tsx` (Client, hält optimistic State der
  Items).
- `src/app/_components/shopping-category.tsx` (Server-rendered Wrapper mit
  Header).
- `src/app/_components/shopping-item-row.tsx` (Client-Subkomponente; Klassen
  `.shop-item` mit `.checked`-Toggle, Checkbox-Icon links via
  `<CheckIcon />`).
- `src/lib/shopping-categories.ts` (NEU, **darf** trotz `lib/`-Sperre angelegt
  werden, weil neue Datei und reine UI-Mapping-Logik):
  - Export `categorize(name: string): string` mit Keyword-Tabelle:
    Obst & Gemüse, Backwaren, Milchprodukte, Fleisch & Fisch, Vorrat, Gewürze,
    Tiefkühl, Getränke, Sonstiges.
  - Reihenfolge der Kategorien definieren (Export `CATEGORY_ORDER`).
  - Bestehende `ShoppingListItem.category` (DB) hat Vorrang; nur fallbacken,
    wenn leer.

## Komponenten-Inventar (zu erstellen)

| Datei | Typ | Status |
|---|---|---|
| `src/app/_components/recipe-filters.tsx` | Client | offen |
| `src/app/_components/day-toggle-group.tsx` | Client | offen |
| `src/app/_components/people-stepper.tsx` | Client | offen |
| `src/app/_components/shopping-category.tsx` | Server | offen |
| `src/app/_components/shopping-item-row.tsx` | Client | offen |
| `src/lib/shopping-categories.ts` | Pure | offen |

## Aufräumarbeiten (am Ende der Folge-Session)

1. `src/app/recipe-details.tsx` löschen, sobald keine Page mehr importiert
   (`grep -r "from \"./recipe-details\"" src/app`).
2. `src/app/recipe-image.tsx` evaluieren: wenn nirgends mehr referenziert,
   löschen; sonst durch `<RecipeColorTile />` in den letzten Aufrufstellen
   ersetzen.
3. Alte CSS-Klassen prüfen (`.button`, `.card.tight`, `.meal`, `.hero` etc.):
   wenn nicht mehr verwendet, aus `globals.css` entfernen.
   `grep -r "className=\"button"` etc. zur Verifikation.
4. `submit-feedback.tsx` an neuen Toast-Style angleichen (Prototyp hat keinen
   Toast — minimal halten).

## Akzeptanzkriterien Folge-Session

- Alle vier Pages (Recipes/Planner/Shopping/Login) visuell ≥95% Match zum
  Prototyp bei Desktop ≥1280px.
- Mobile-Tests bei 375px: Sidebar versteckt, MobileTabbar sichtbar, page-head
  bricht sauber um, week-grid horizontal scrollbar, Modal nutzt fast volle
  Höhe.
- `prefers-reduced-motion: reduce` deaktiviert alle `transform`-Hover und
  `transition`-Animationen (CSS-Block bereits in `globals.css`).
- Dark-Mode: Tokens umgeschaltet, alle Cards lesbar, Stat-Card-Icons mit
  ausreichend Kontrast.
- `npm run lint`, `npx tsc --noEmit`, `npm run build` grün.
- Keine Konsolenfehler beim Navigieren durch alle Pages und beim Öffnen des
  Modals.

## Bekannte offene Entscheidungen

- **Sidebar-Counts „142“ Demo vs. echt:** aktuell echte Werte aus Prisma,
  Badges nur bei `> 0` sichtbar. Behalten.
- **Saison-Filter im Recipes-Tab:** Prototyp zeigt einen `Saisonal`-Tag.
  Heuristik festlegen — vermutlich Match auf `categoriesJson`
  (`spring`/`summer`/`autumn`/`winter` oder DE-Synonyme). Vor Implementierung
  kurz mit User klären, falls keine Tags vorhanden sind.
- **Tonight-Reasoning-Zeile:** Prototyp zeigt `5 von 5` Sterne; aktuell
  ausgelassen, weil Plan-Items kein eigenes Rating haben. Falls
  `tonight.recipe.rating > 0`, Sterne ergänzen.
- **Greeting-Zeile:** uhrzeitabhängig. Aktuell hartkodiert deutsch. OK.
