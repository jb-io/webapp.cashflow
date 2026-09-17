# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Projektsprache ist Deutsch: Bezeichner, Kommentare, UI-Texte und Dokumentation.

## Befehle

```bash
npm start                                   # Static-Server auf http://localhost:3000
npm test                                    # node:test, findet test/*.test.js selbst
node --test test/view.test.js               # eine Datei
node --test --test-name-pattern="Zyklen"    # einzelne Tests über den Namen
```

Es gibt keinen Build-Schritt, keinen Bundler, keinen Linter. `node --check <datei>`
ist die schnellste Syntaxprüfung für eine einzelne Datei.

## Pflicht: Architecture.md

`Architecture.md` hält alle Architekturentscheidungen als nummerierte Liste
(A1, A2, …) mit Begründung und Konsequenz fest und **muss bei jeder
Architekturänderung im selben Schritt aktualisiert werden**. Vor größeren
Änderungen zuerst dort nachsehen — mehrere Stellen im Code verweisen auf
einzelne Entscheidungen ("siehe Architecture.md, A16").

## Aufbau

```
server.js      Express, serviert nur public/ und src/ — keine API, kein Server-State
src/core/      pure Rechenlogik: läuft unverändert im Browser und unter node:test
public/        UI (Vanilla-ES-Module, kein Framework)
public/data/   dummy-data.json — Beispieldaten im Import/Export-Format
test/          node:test, deckt ausschließlich src/core ab
```

Der Browser importiert `/src/core/*.js` direkt per `<script type="module">` —
dieselben Dateien, die die Tests laden. **`src/core` darf deshalb keine DOM-,
Node- oder Framework-Abhängigkeit bekommen** (A3); es soll den geplanten
Umstieg auf Vite + React unverändert überleben. Abhängigkeitsrichtung:
`public/*` → `src/core/*`, nie umgekehrt.

Innerhalb von `core`: `dateUtils` ← `recurrence`/`amounts` ← `forecast` ←
`stats`; `categories` steht daneben und wird von `model` (Validierung) und der
UI genutzt.

## Datenmodell

Ein einziges Dokument ist gleichzeitig Zustand, localStorage-Inhalt und
Exportformat (`{ version, account, settings, categories, entries }`).

- **`normalizeState()` in `model.js` ist der einzige Eingang für fremde Daten.**
  Es lehnt neuere Schemaversionen ab, füllt Defaults, löst verwaiste
  Kategorie-Referenzen und Hierarchie-Zyklen auf und migriert ältere Schemata.
  Jeder neue Importweg muss hier durch.
- Schemaänderung ⇒ `SCHEMA_VERSION` erhöhen **und** Migrationsschritt in
  `normalizeState` ergänzen; `loadState()` schreibt migrierte Dokumente sofort
  zurück. Ein geänderter Ablageort kommt in `LEGACY_STORAGE_KEYS`.
- **Kategorien liegen flach** mit `parentId`; der Baum wird bei Bedarf über
  `categories.js` berechnet (`flattenTree`, `pathOf`, `descendantIds`,
  `canReparent`). Ein Eintrag zeigt immer auf genau eine Kategorie.
- **Beträge sind Phasen** `[{from, value}]` — `value` wird immer positiv
  gepflegt, das Vorzeichen kommt aus `direction` (`signedAmountAt`).
- **Zeiträume sind immer ganze Monate**: `settings.view = {from: "YYYY-MM",
  to: "YYYY-MM"}` im Dokument, `windowOf()` übersetzt in ein Tagesfenster.
  Standard ist das komplette laufende Kalenderjahr.

## Rechenkern

`expandRule()` (`recurrence.js`) übersetzt ein eigenes Regelformat — bewusst
kein RRULE — in Termine: `monthly` (inkl. `dayOfMonth: -1` für Monatsletzter
und `interval`), `weekly`, `quarterly`, `yearly`, `everyNDays`, `once`, jeweils
mit `skipMonths`/`skipDates`. Monatliche und wöchentliche Zyklen sind am
`startDate` des Eintrags verankert, nicht am Fensteranfang.

`buildForecast()` kumuliert den Saldo **immer ab `account.startDate`** und
schneidet erst danach auf das Anzeigefenster zu (A8) — beginnt das Fenster
später, muss sein Startsaldo die Buchungen davor enthalten.

## UI-Fallstricke

`public/app.js` hält den Zustand und bietet genau vier Änderungswege:

| Aktion | Speichert | Rendert |
|---|---|---|
| `update()` | ja | ja — für strukturelle Änderungen |
| `updateInline()` | ja | **nein** |
| `replaceState()` | ja | ja — kompletter neuer Datenstand |
| `resetState()` | nein, löscht | ja + Startdialog |

**`updateInline()` darf nicht rendern (A16).** Das `change` eines Feldes in der
Liste wird durch den Klick auf das *nächste* Element ausgelöst; ein Vollrender
tauscht die Liste mitten im Klick aus, der Klick landet dann im Nichts oder in
einer Nachbarzeile, und die Eingabe geht in die falsche Zeile. Betroffen ist
nur noch das Umbenennen an Ort und Stelle — alle anderen Editoren der
Buchungsliste sind Popovers am `<body>` (A20), weshalb die Liste dort frei neu
rendern darf. Wer ein neues Eingabefeld *in* eine Liste setzt, handelt sich das
Problem wieder ein.

**Die Buchungsliste ist eine Token-Liste**, keine Formulartabelle: Textzeile im
festen Raster, jede Angabe ein `<button class="tok">`, dessen Klick über
`popover.js` einen Editor für genau diesen Aspekt öffnet. Das Popover findet
seinen Anker nach einem Neurender über einen Selektor wieder — deshalb ruft
`render()` in `app.js` am Ende `repositionPopover()`. Popover-Inhalte bauen
sich nur bei strukturellen Wechseln neu auf (`api.rebuild()`), nie bei jeder
Wertänderung, sonst verliert das Feld den Fokus.

`render()` zeichnet nur den aktiven Tab — andere Tabs sind nach einer Änderung
ohne Render nicht veraltet, weil sie beim Umschalten neu gebaut werden.

Dialoge (`#entry-dialog`, `#welcome-dialog`) bleiben im DOM bestehen; Listener
gehören an den bei jedem Render ersetzten Inhalt, sonst laufen sie sich auf.
Der Startdialog muss Esc zusätzlich über `close` abfangen — ohne vorherige
Nutzerinteraktion liefert Chrome `cancel` nicht abbrechbar aus.

## Beispieldaten

`public/data/dummy-data.json` ist bewusst Datei statt Code und wird von
`test/dummyData.test.js` mitgeprüft: vorgegebener Kategoriebaum, jeder
Regeltyp genau einmal, feste Terminzahlen und — die tragende Zusicherung —
**die Summe aller Ausgaben entspricht 2026 exakt der Summe beider Gehälter**
(66.000 €, Jahresergebnis 0). Beträge dort nicht ohne Gegenrechnung ändern.

## Prüfen von UI-Änderungen

`node:test` deckt nur `src/core` ab. DOM-Verhalten (Fokus, Render, Dialoge)
wird per headless Chrome über das DevTools-Protokoll geprüft — es gibt kein
E2E-Framework im Projekt. Ablauf: `npm start`, dann Chrome mit
`--headless=new --remote-debugging-port=9222 --user-data-dir=<tmp>` starten und
über `Runtime.evaluate` / `Input.dispatch*Event` steuern. Für Fokus- und
Klickverhalten echte `Input`-Ereignisse verwenden — `dispatchEvent` aus dem
Seitenkontext umgeht genau die Fehler, um die es dabei geht.
