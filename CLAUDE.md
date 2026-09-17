# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Projektsprache ist Deutsch: Bezeichner, Kommentare, UI-Texte und Dokumentation.

## Befehle

```bash
npm run dev                                 # Vite-Entwicklungsserver, http://localhost:3000
npm run build                               # tsc --noEmit && vite build -> dist/
npm run typecheck                           # nur die Typprüfung
npm run preview                             # dist/ ausliefern (für Prüfungen im Browser)
npm test                                    # node:test, findet test/*.test.ts selbst
node --test test/view.test.ts               # eine Datei
node --test --test-name-pattern="Zyklen"    # einzelne Tests über den Namen
```

`npm test` läuft **ohne Bundler**: Node führt die `.ts`-Dateien direkt aus und
streift die Typen ab. Daraus folgen drei Regeln für alles unter `src/core` und
`test/` (A27):

- **Relative Importe mit echter Endung**: `from './model.ts'`, nie `.js`.
- **Nur rein löschbare Syntax** — keine Enums, keine Parameter-Eigenschaften,
  keine `namespace`. `erasableSyntaxOnly` erzwingt das.
- **Typen immer als `import type`** (`verbatimModuleSyntax`), sonst sucht Node
  zur Laufzeit nach einem Export, den es nicht gibt.

Nach jeder Änderung `npm run typecheck` — `node --test` allein merkt
Typfehler nicht, es streift die Typen ja nur ab.

`npm run screenshots` erzeugt die Bilder der README neu (Playwright gegen das
vorhandene Chrome, Server muss über `npm run preview` laufen). Nach
Änderungen an der Oberfläche mitlaufen lassen, sonst zeigt die Anleitung
einen Stand, den es nicht mehr gibt.

## Pflicht: Architecture.md

`Architecture.md` hält alle Architekturentscheidungen als nummerierte Liste
(A1, A2, …) mit Begründung und Konsequenz fest und **muss bei jeder
Architekturänderung im selben Schritt aktualisiert werden**. Abgelöste
Entscheidungen werden markiert, nicht gelöscht. Mehrere Stellen im Code
verweisen darauf ("siehe Architecture.md, A20").

## Aufbau

```
src/core/      pure Rechenlogik: kein DOM, kein React, kein JSX
src/core/types.ts  die fachlichen Typen — einzige Quelle, hier zuerst nachsehen
src/app/       React-Oberfläche (Vite, Hash-Routing), .tsx
public/data/   dummy-data.json — Beispieldaten im Import/Export-Format
test/          node:test, deckt ausschließlich src/core ab
```

**Abhängigkeitsrichtung: `src/app` → `src/core`, nie umgekehrt.** Der Kern ist
bewusst framework-frei; er hat den Umstieg von Vanilla auf React unverändert
überlebt und soll das beim nächsten Wechsel wieder tun.

Innerhalb von `core`: `dateUtils` ← `recurrence`/`amounts` ← `forecast` ←
`stats`; `categories` steht daneben und wird von `model` (Validierung) und der
Oberfläche genutzt.

## Datenmodell

Ein einziges Dokument ist gleichzeitig Zustand, localStorage-Inhalt und
Exportformat — `CashflowDoc` in `src/core/types.ts`.

- **`normalizeState()` in `model.ts` ist der einzige Eingang für fremde Daten.**
  Die Eingabe ist `unknown` — erst am Ende steht fest, dass ein `CashflowDoc` vorliegt.
  Es lehnt neuere Schemaversionen ab, füllt Defaults, löst verwaiste
  Kategorie-Referenzen und Hierarchie-Zyklen auf und migriert ältere Schemata.
  Jeder neue Importweg muss hier durch.
- Schemaänderung ⇒ `SCHEMA_VERSION` erhöhen **und** Migrationsschritt in
  `normalizeState` ergänzen; `loadState()` schreibt migrierte Dokumente sofort
  zurück. Ein geänderter Ablageort kommt in `LEGACY_STORAGE_KEYS`.
- **Kategorien liegen flach** mit `parentId`; der Baum wird bei Bedarf über
  `categories.ts` berechnet (`flattenTree`, `pathOf`, `descendantIds`,
  `canReparent`). Ein Eintrag zeigt immer auf genau eine Kategorie.
- **Beträge sind Phasen** `[{from, value}]` — `value` wird immer positiv
  gepflegt, das Vorzeichen kommt aus `direction` (`signedAmountAt`).
- **Zeiträume sind immer ganze Monate**: `settings.view = {from: "YYYY-MM",
  to: "YYYY-MM"}` im Dokument, `windowOf()` übersetzt in ein Tagesfenster.
  Standard ist das komplette laufende Kalenderjahr.

## Rechenkern

`expandRule()` (`recurrence.ts`) übersetzt ein eigenes Regelformat — bewusst
kein RRULE — in Termine: `monthly` (inkl. `dayOfMonth: -1` für Monatsletzter
und `interval`), `weekly`, `quarterly`, `yearly`, `everyNDays`, `once`, jeweils
mit `skipMonths`/`skipDates`. Monatliche und wöchentliche Zyklen sind am
`startDate` des Eintrags verankert, nicht am Fensteranfang.

`buildForecast()` kumuliert den Saldo **immer ab `account.startDate`** und
schneidet erst danach auf das Anzeigefenster zu (A8) — beginnt das Fenster
später, muss sein Startsaldo die Buchungen davor enthalten.

## Oberfläche

Vier Hash-Routen, je eine Seite in `src/app/pages/`: `#/verlauf`,
`#/buchungen`, `#/kategorien`, `#/konto`. Unbekannte Routen leiten auf den
Verlauf um. Zwei Bruchstellen im Layout: 900 px (Seitenleiste statt
Navigationsleiste unten) und 760 px (einzeiliges Zeilenraster, angedockte
Editoren statt Blatt von unten).

Zustand und Ableitungen liegen ausschließlich in
`src/app/state/StateProvider.tsx` (Typ `Store`): `update(mutate)` (auf einer Kopie,
speichert), `replace(doc)`, `reset()`, `setView(view)`. Forecast,
Monatsaggregate und Kennzahlen sind gememoisiert und werden nie gespeichert.

**Die Buchungsliste ist eine Token-Liste** (A20), keine Formulartabelle: die
Zeile ist Text in einem festen Raster, jede veränderliche Angabe ein
`<button class="tok">`, dessen Klick über `Sheet` einen Editor für genau diesen
Aspekt öffnet — mobil als Blatt von unten, ab 760 px angedockt am Token.
`Sheet` hängt in einem Portal am `<body>` und sucht seinen Anker per Selektor.
Je Token ein Editor in `components/editors/`; was kein Token hat — Laufzeit,
Notiz, Löschen — sitzt im `DetailsEditor` hinter `⋯`.

**Zwei Fallen, die dieses Projekt schon zweimal getroffen haben:**

1. **Layout darf sich beim Bedienen nicht verschieben** (A25). Verschiebt sich
   zwischen `mousedown` und `mouseup` etwas unter dem Cursor, entsteht gar kein
   `click`. Deshalb ist die Detailzeile einer Buchung immer sichtbar und das
   Umbenennen-Feld maßgleich zum Token gebaut. Wer eine Zeile bei Auswahl oder
   Hover wachsen lässt, holt sich den Fehler zurück.
2. **In einem Popover kein Zustand ohne Vergleich setzen.** `Sheet` misst seine
   Position in `useLayoutEffect`; ohne Abhängigkeitsliste und ohne Vergleich
   löst jedes Messen ein Neuzeichnen aus, das wieder misst.

## Diagramme

Farben kommen aus denselben CSS-Variablen wie die Oberfläche
(`charts/theme.ts`), der dunkle Modus hat eigene Werte statt gespiegelter.
`DEFAULT_COLORS` in `model.ts` ist eine **geprüfte** Kategorienpalette (A24):
Reihenfolge nicht umsortieren. Ab neun Reihen wird zu „Übrige" gebündelt statt
weitergefärbt. Vor Änderungen an Diagrammfarben die Visualisierungs-Richtlinie
laden und den Palettenprüfer laufen lassen.

## Beispieldaten

`public/data/dummy-data.json` ist bewusst Datei statt Code und wird von
`test/dummyData.test.ts` mitgeprüft: vorgegebener Kategoriebaum, jeder
Regeltyp genau einmal, feste Terminzahlen und — die tragende Zusicherung —
**die Summe aller Ausgaben entspricht 2026 exakt der Summe beider Gehälter**
(66.000 €, Jahresergebnis 0). Beträge dort nicht ohne Gegenrechnung ändern.

## Prüfen von Oberflächenänderungen

`node:test` deckt nur `src/core` ab. Für die Oberfläche gibt es kein
E2E-Framework im Projekt; geprüft wird per headless Chrome über das
DevTools-Protokoll: `npm run build && npm run preview`, dann Chrome mit
`--headless=new --remote-debugging-port=9222 --user-data-dir=<tmp>` starten und
über `Runtime.evaluate` / `Input.dispatch*Event` steuern. Für Fokus- und
Klickverhalten **echte `Input`-Ereignisse** verwenden — `dispatchEvent` aus dem
Seitenkontext umgeht genau die Fehler, um die es dabei geht. Mobil und Desktop
über `Emulation.setDeviceMetricsOverride` prüfen, den dunklen Modus über
`Emulation.setEmulatedMedia`.
