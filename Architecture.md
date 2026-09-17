# Architektur — webapp.cashflow

Stand: 2026-09-17 · React + TypeScript auf framework-freiem Rechenkern

Diese Datei hält die tragenden Entscheidungen fest und wird bei jeder
Architekturänderung mit aktualisiert. Abgelöste Entscheidungen werden als
solche markiert, nicht gelöscht — die Begründung von damals erklärt, warum es
heute anders aussieht.

## 1. Zielbild

Liquiditätsplanung eines einzelnen Kontos: aus einem Startkontostand und frei
konfigurierbaren wiederkehrenden Einnahmen und Ausgaben wird der erwartete
Kontoverlauf berechnet und tabellarisch wie grafisch dargestellt. Die
fachlichen Kernpunkte sind beliebige Wiederholungsregeln (inkl. Ausnahmen wie
„monatlich außer im Dezember"), zeitlich gestaffelte Beträge und die Kennzahlen
Tiefstand, Höchststand und Ergebnis im Zeitraum.

Nicht-Ziel: Mehrbenutzerbetrieb, echte Bankanbindung, Buchhaltung.

## 2. Entscheidungen

| # | Entscheidung | Begründung | Konsequenz |
|---|---|---|---|
| A1 | *(durch A22 abgelöst)* **Express nur als Static-Server**, keine REST-API | Alle Daten liegen im Browser; ein Backend ohne Daten wäre reine Zeremonie | `server.js` ist entfallen — Vite liefert aus |
| A2 | *(durch A22 abgelöst, in abgewandelter Form von A27 fortgeführt)* **Kein Build-Step**: native ES-Module in Browser und Node | Trug den Prototyp ohne Werkzeugkette | Gilt weiterhin für `src/core`: kein JSX, keine Bundler-Eigenheiten, damit die Tests die Dateien direkt laden |
| A3 | **`src/core` ist pur** — keine DOM-, Node- oder Framework-Abhängigkeit | Die Rechenlogik ist der wertvolle Teil und soll Wechsel der Oberfläche überleben | Hat sich bewährt: der Umstieg von Vanilla auf React (A22) ließ `src/core` unangetastet. `src/app` darf `core` importieren, nie umgekehrt |
| A4 | **Persistenz in `localStorage`** + JSON-Import/-Export | Kein Server-State, kein Setup; Export hält die Daten portabel und sicherbar | Daten hängen am Browserprofil — Sicherung ist Nutzeraufgabe |
| A5 | **Eigenes Regelformat statt RRULE** | „monatlich außer Dezember", Monatsletzter und Betragsphasen lassen sich direkt abbilden *und* in einem Formular pflegen; RRULE hätte einen Übersetzungslayer und eine schwerere Oberfläche erzwungen | Eigene Engine inkl. Tests (`src/core/recurrence.ts`) |
| A6 | **Beträge als Phasenliste** statt eines Werts pro Eintrag | Anforderung „bis Datum X Betrag A, danach B" über beliebig viele Stufen | Jeder Termin wird einzeln bewertet (`amountAt`) |
| A7 | **Datumsarithmetik in UTC auf ISO-Strings** | Lokale Zeitzonen und Sommerzeit verschieben sonst Termine um einen Tag | Ein Datum ist überall ein `"YYYY-MM-DD"`-String (`ISODate`), nie ein `Date` |
| A8 | **Saldo wird immer ab Kontostartdatum kumuliert**, das Anzeigefenster schneidet nur zu | Beginnt das Fenster später, muss sein Startsaldo die Buchungen davor enthalten | `buildForecast` rechnet ggf. mehr, als angezeigt wird |
| A9 | *(seit A22 als Paket statt per CDN)* **Chart.js für die Diagramme** | Deckt Stufenlinie und gestapelte Balken ab, ohne eigene Zeichenlogik | `chart.js` + `react-chartjs-2` als Abhängigkeit; dafür funktioniert der Offline-Betrieb ohne Cache-Glück |
| A10 | *(durch A22 hinfällig)* **Neurendern statt Diffing**: jede Änderung schreibt den Zustand und zeichnet den aktiven Tab neu | Bei der Datenmenge eines Privatkontos unmessbar schnell und einfacher als Zustandssynchronisation von Hand | Kostete Fokus und Scrollposition — genau daraus entstanden A13, A16 und A25. React übernimmt das jetzt |
| A11 | **Kategorien hierarchisch über `parentId`**, gespeichert bleibt eine *flache* Liste | Referenzen (`entry.categoryId`) bleiben stabil und Import/Export einfach; der Baum ist eine Sicht, kein Speicherformat | Baumoperationen liegen in `src/core/categories.ts`; `normalizeState` muss Zyklen und unbekannte Eltern auflösen |
| A12 | *(durch A20 abgelöst)* **Inline-Bearbeitung in der Übersichtstabelle** für Name, Art und Betrag; alles Weitere im Dialog | Die häufigste Pflege ist „Betrag hat sich geändert" — dafür soll kein Dialog nötig sein | Die Betragseingabe adressierte genau die *heute gültige* Phase (`setAmountAt`) |
| A13 | **Eingaben werden beim Verlassen übernommen**, nicht bei jedem Tastendruck | Ein Schreibvorgang je Zeichen erzeugt Zustandsrauschen ohne Nutzen | Vanilla: `change` statt `input`. React: `onBlur`/Enter beim Umbenennen, kontrollierte Felder sonst |
| A14 | **Zeiträume sind immer ganze Monate** — gespeichert als Monatsbereich `settings.view = {from, to}` im Dokument, Standard ist das komplette laufende Kalenderjahr | Geplant wird in Monaten, nicht in Tagen; ein angebrochener Monat verzerrt Monatsbalken und Kennzahlen. Im Dokument gilt der Zeitraum für alle Sichten gleichzeitig und übersteht einen Reload; bedient wird er dort, wo er wirkt — auf der Verlaufsseite | `windowOf()` übersetzt in ein Tagesfenster (erster bis letzter Monatstag); die Oberfläche kennt nur `<input type="month">`. Schemaänderung → **Version 2** |
| A15 | **Kategorie direkt aus der Liste wählbar** — seit A20 als Token-Editor mit eingerücktem Baum statt als Auswahlfeld in der Zeile | Das Umsortieren vieler Einträge war der einzige verbliebene Grund, einen Dialog zu öffnen | Zusammen mit Betrag und Rhythmus deckt die Liste die laufende Pflege vollständig ab |
| A16 | *(durch A22 erledigt; an seine Stelle tritt A25)* **Inline-Änderungen rendern nicht neu** (`updateInline`): sie schreiben und speichern, danach frischt die Sicht nur die abgeleiteten Stellen der betroffenen Zeile auf (`patchRow`) | A10 ist für Formulare falsch: das `change` einer Zelle wird durch den Klick in die *nächste* Zelle ausgelöst — der Vollrender tauscht die Tabelle mitten im Klick aus, und die Eingabe landet in der falschen Zeile | React tauscht keine DOM-Knoten aus, die es wiederverwenden kann; damit entfällt die Sonderbehandlung |
| A17 | **Kopien bekommen einen eindeutigen Namen** (`Name (Kopie)`, `(Kopie 2)`, …; vorhandene Kopie-Suffixe werden nicht gestapelt) | Zwei identisch benannte Zeilen direkt untereinander sind in einer bearbeitbaren Liste nicht auseinanderzuhalten | `duplicateEntry(entry, existing)` liest aus `existing` nur die Namen — das sagt auch der Typ |
| A18 | **Startdialog beim ersten Aufruf** mit drei Wegen: eigene JSON-Datei, leer beginnen, Beispieldaten. Er lässt sich nicht ohne Entscheidung schließen und erscheint nach „Alles zurücksetzen" erneut | Eine leere App erklärt sich nicht von selbst; die drei Wege decken alle Startsituationen ab. „Noch nie benutzt" (`hasStoredState()`) ist etwas anderes als „bewusst leer" — nur Ersteres fragt | `reset()` löscht die Ablage und speichert bewusst **nichts** zurück, stellt also den Zustand vor dem ersten Aufruf wieder her |
| A19 | **Beispieldaten liegen als JSON im Auslieferungsformat** (`public/data/dummy-data.json`), nicht als Code | Sie laufen damit durch exakt dieselbe Importprüfung wie eine fremde Datei — der Importpfad wird bei jedem Start mitgetestet — und lassen sich ohne Werkzeug bearbeiten | Das Laden ist asynchron (`fetch`); eine Quelle für Startdialog und „Beispieldaten laden" auf der Kontoseite |
| A20 | **Buchungsliste als Token-Liste statt Formulartabelle**: die Zeile ist Text in einem Raster mit weglassbaren Zellen, jede veränderliche Angabe ist ein Token, dessen Klick einen Editor für genau diesen Aspekt öffnet | Die Formulartabelle zeigte 11 × 5 Bedienelemente gleichzeitig — nichts stach hervor. Vor allem aber zwang sie die Wiederholung in eine Spalte, die für jeden Regeltyp andere Parameter bräuchte, weshalb die Regel dort nur *lesbar* war. Ein Token trägt nur das, was die jeweilige Regel hat | Der Editor hängt in einem Portal am `<body>` (`components/Sheet.tsx`) und findet seinen Anker über einen Selektor wieder; der Fokus liegt beim Bearbeiten nie in der Liste. Preis: eigene Positionierungslogik und Angaben, die anklickbar sind, ohne wie ein Eingabefeld auszusehen |
| A21 | **Tastaturbedienung der Liste**: ↑/↓ Zeile, ←/→ Angabe, Enter öffnet, Esc schließt | In einem Dauerformular ist die Tab-Reihenfolge schon von den Feldern belegt; erst die Token-Liste macht eine sinnvolle Navigation möglich | Enter und Leertaste werden ausdrücklich behandelt, nicht über die native Schaltflächen-Aktivierung |
| A22 | **Frontend auf Vite + React, Navigation über Hash-Routen** (`#/verlauf`, `#/buchungen`, `#/kategorien`, `#/konto`) | Der Prototyp hatte die Grenze des handgeschriebenen Renderns erreicht: Zustand, abgeleitete Werte und DOM von Hand synchron zu halten war die Quelle der meisten Fehler. Hash-Routen brauchen keine Server-Konfiguration — die App läuft aus jedem Verzeichnis und von der Platte | `src/core` wurde **unverändert** übernommen, `src/app` ist neu. Bau über `npm run build`; die Testsuite bleibt ohne Bundler (A27) |
| A23 | **Ein Layout, zwei Ausprägungen**: unter 900 px eine Spalte mit Navigationsleiste unten, darüber feste Seitenleiste; Editoren erscheinen unter 760 px als Blatt von unten, darüber angedockt am Token | Die Daumenzone ist unten, der Blick oben — dieselbe Navigation an beiden Stellen wäre auf einem der beiden Geräte falsch | Zwei Bruchstellen in `styles.css` (900 px Navigation, 760 px Zeilenraster und Editoren); `Sheet` entscheidet zur Laufzeit, ob es andockt |
| A24 | **Kategoriefarben aus einer geprüften Palette** (`DEFAULT_COLORS`), Diagrammfarben aus denselben CSS-Variablen wie die Oberfläche | Farbabstände sind rechenbar, nicht Geschmackssache: die Vorgängerpalette fiel bei Farbfehlsichtigkeit und beim Normalsicht-Abstand durch. Ab neun Reihen wird gebündelt statt weitergefärbt | Reihenfolge der Palette nicht umsortieren; der dunkle Modus hat eigene Werte statt gespiegelter |
| A25 | **Zeilenhöhe darf sich beim Bedienen nicht ändern**: die Detailzeile einer Buchung ist immer sichtbar, nicht erst bei Auswahl | Erscheint sie erst beim Anklicken, verschiebt sie alles darunter — zwischen Drücken und Loslassen wandert das Ziel weg, und es entsteht gar kein `click`. Dieselbe Klasse von Fehlern wie A16, nur über das Layout statt über den DOM-Austausch | Auch das Feld zum Umbenennen ist maßgleich zum Token gebaut |
| A26 | **TypeScript im ganzen Projekt**, geprüft mit `tsc --noEmit` als Teil von `npm run build` | Dasselbe Dokument wandert durch Kern, Speicher, Import und Oberfläche; die Typen beschreiben es an einer Stelle (`src/core/types.ts`) statt verstreut in JSDoc-Blöcken. Beim Umstellen fielen prompt schlampige Testdaten auf: fehlendes `parentId`, fehlendes `note` | Keine Enums, keine Parameter-Eigenschaften — siehe A27 |
| A27 | **Testsuite bleibt ohne Bundler**: `node --test` führt die `.ts`-Dateien direkt aus (Type-Stripping ab Node 22.18) | Ein zweiter Werkzeugstapel nur für Tests wäre Aufwand ohne Gegenwert; so prüft die Suite exakt die Dateien, die auch ausgeliefert werden | Verlangt rein löschbare Syntax (`erasableSyntaxOnly`), Importe mit echter Endung (`./foo.ts`) und Typimporte als `import type` (`verbatimModuleSyntax`) |

## 3. Aufbau

```
index.html            Einstiegspunkt (Vite)
vite.config.ts        Basis "./", Port 3000
tsconfig.json         strikt; erasableSyntaxOnly + .ts-Importe wegen A27
src/core/             pure Rechenlogik — Browser und Tests, ohne React
  types.ts            fachliche Typen: Dokument, Eintrag, Regel, Forecast, Kennzahlen
  dateUtils.ts        ISO-Datumsarithmetik in UTC, Monatsgrenzen
  categories.ts       Kategoriebaum: Pfad, Tiefe, Unterbaum, Zyklusschutz
  recurrence.ts       expandRule(): Regel → Termine; describeRuleParts()/describeRule()
  amounts.ts          amountAt()/setAmountAt(): gültiger Betrag zu einem Datum
  forecast.ts         buildForecast(): Buchungen + Saldoverlauf; aggregateByMonth()
  stats.ts            computeStats(): Min/Max mit Datum, Delta, Kategoriesummen
  model.ts            Schema, Defaults, Zeitraum, duplicateEntry(), normalizeState()
  storage.ts          localStorage + JSON-Import/-Export
src/app/              React-Oberfläche
  main.tsx            HashRouter + StateProvider
  App.tsx             Gerüst, Navigation, Routen
  format.ts           Beträge, Daten, Monatsbeschriftungen
  styles.css          Gestaltungsgrundlage: Variablen, Layout, Bausteine
  state/              StateProvider: Dokument, Ableitungen, Änderungswege
  pages/              je Route eine Seite
  components/         Sheet (Token-Editor), PeriodPicker, WelcomeDialog, Icons
  components/editors/ je Token ein Editor: Amount, Rule, Category, Details
  charts/             BalanceChart, MonthlyChart, gemeinsames Farbthema
public/data/          dummy-data.json — Beispieldaten im Import/Export-Format
test/                 node:test gegen src/core (führt .ts direkt aus)
```

**Abhängigkeitsrichtung:** `src/app` → `src/core`, nie umgekehrt. Innerhalb von
`core` gilt `dateUtils` ← `recurrence`/`amounts` ← `forecast` ← `stats`;
`categories` steht daneben und wird von `model` (Validierung) und der
Oberfläche genutzt. `types.ts` hängt von nichts ab.

**Zustandsänderungen** laufen ausschließlich über
`src/app/state/StateProvider.tsx` (Typ `Store`):

| Weg | Wirkung |
|---|---|
| `update(mutate)` | arbeitet auf einer Kopie, speichert, zeichnet neu |
| `replace(doc)` | kompletter neuer Datenstand: Import, Beispieldaten, Startdialog |
| `reset()` | löscht die Ablage, speichert **nichts** — der Startdialog fragt erneut |
| `setView(view)` | Zeitraum aller Sichten |

Forecast, Monatsaggregate und Kennzahlen sind abgeleitet, gememoisiert und
werden nie gespeichert.

## 4. Datenmodell

Ein einziges Dokument (`CashflowDoc` in `types.ts`); genau diese Struktur liegt
in `localStorage` unter `webapp.cashflow.v1` und in der Export-Datei.

```jsonc
{
  "version": 2,
  "account":  { "name": "Girokonto", "startBalance": 2500, "startDate": "2026-01-01" },
  "settings": { "view": { "from": "2026-01", "to": "2026-12" } },   // Monate, inklusive
  "categories": [
    { "id": "cat_x", "name": "Wohnen", "color": "#eb6834", "parentId": null },
    { "id": "cat_y", "name": "Miete",  "color": "#d1568a", "parentId": "cat_x" }
  ],
  "entries": [{
    "id": "ent_y",
    "name": "Miete",
    "categoryId": "cat_y",           // null = ohne Kategorie; immer die *genaue* Kategorie
    "direction": "expense",          // "income" | "expense"
    "active": true,
    "note": "",
    "startDate": "2026-01-01",
    "endDate": null,                 // null = unbefristet
    "rule":    { "type": "monthly", "dayOfMonth": 1, "interval": 1,
                 "skipMonths": [12], "skipDates": [] },
    "amounts": [ { "from": null, "value": 950 },
                 { "from": "2027-01-01", "value": 990 } ]
  }]
}
```

Konventionen:

- `amounts[].value` wird **immer positiv** gepflegt; das Vorzeichen ergibt sich
  aus `direction`. Das hält die Eingabe eindeutig.
- `from: null` heißt „gilt von Anfang an"; eine Phase gilt bis zum Beginn der
  nächsten. Vor der ersten Phase ist der Betrag 0.
- `skipMonths` (1–12) und `skipDates` (ISO) sind auf jeder Regel erlaubt.
- `category.parentId` verweist auf die Oberkategorie (`null` = oberste Ebene).
  Die Verschachtelung ist unbegrenzt tief. Ein Eintrag zeigt immer auf genau
  eine Kategorie — die Zuordnung zu Oberkategorien ergibt sich aus dem Baum,
  nicht aus zusätzlichen Feldern.

### Regeltypen

| `type` | Felder | Semantik |
|---|---|---|
| `monthly` | `dayOfMonth` (1–31 oder `-1` = Monatsletzter), `interval` | Tag wird auf den Monatsletzten geklemmt (31. → 28./29. Februar). Der Zyklus ist am `startDate` verankert. |
| `weekly` | `weekday` (0 = So … 6 = Sa), `interval` | `interval: 2` = 14-tägig, verankert am ersten passenden Wochentag ab `startDate` |
| `quarterly` | `monthOffset` (0–2), `dayOfMonth` | Zucker für `monthly` mit `interval: 3` |
| `yearly` | `month` (1–12), `dayOfMonth` | |
| `everyNDays` | `n`, `anchor` | Fester Tagesabstand, driftet bewusst gegenüber Monatsterminen |
| `once` | `date` | Einmalbuchung |

### Kategoriehierarchie — Regeln

- **Auswertung:** Summen einer Kategorie enthalten in der Anzeige ihren
  Unterbaum; die Buchungen selbst bleiben der exakten Kategorie zugeordnet.
  Der Filter im Verlauf schließt Unterkategorien ein, der Schalter
  „Nur Oberkategorien" rollt die Monatsbalken auf die Wurzel auf (`rootIdOf`).
- **Löschen:** Unterkategorien rücken auf die Ebene der gelöschten Kategorie
  nach; betroffene Einträge werden kategorielos statt mitgelöscht.
- **Umhängen:** Das Einhängen in den eigenen Unterbaum ist ausgeschlossen
  (`canReparent`) — solche Optionen erscheinen gar nicht erst zur Auswahl.
- **Farbe:** wird nicht vererbt. Unterkategorien starten üblicherweise mit einer
  Abstufung der Oberkategorie, sind aber frei änderbar.

### Zeitraum einer Sicht

`settings.view` ist ein **Monatsbereich** aus zwei Schlüsseln `"YYYY-MM"`,
beide inklusive. Daraus wird gerechnet:

- `windowOf(view)` → `{ from: "<erster Tag des von-Monats>", to: "<letzter Tag des bis-Monats>" }`
- `viewFromMonths(start, n)` für die Schnellwahl „N Monate" (inklusive, also
  `n = 12` ab `2026-09` ⇒ bis `2027-08`)
- `normalizeView()` repariert defekte oder verdrehte Bereiche, statt zu werfen

Der Standard ist bewusst **das komplette laufende Kalenderjahr** und nicht „ab
heute": Kennzahlen wie Tiefstand oder Jahresergebnis sind nur über ein ganzes
Jahr aussagekräftig.

## 5. Versionierung & Migration

`version` steht im Dokument. `normalizeState()` (in `model.ts`) ist der einzige
Eingang für fremde Daten: es lehnt neuere Versionen ab, füllt fehlende Felder
mit Defaults, löst verwaiste Kategorie-Referenzen und Hierarchie-Zyklen auf und
migriert ältere Schemata. `loadState()` schreibt ein migriertes Dokument sofort
zurück, damit die Ablage nicht im alten Schema verharrt. Die Eingabe ist
bewusst `unknown` — erst am Ende der Funktion steht fest, dass ein
`CashflowDoc` vorliegt.

| Version | Änderung | Migration |
|---|---|---|
| 1 | Ausgangsschema; Zeitraum nur als `settings.horizonMonths` ab heute | — |
| 2 | Zeitraum als Monatsbereich `settings.view`; Kategorien mit `parentId` | `horizonMonths` → `viewFromMonths(heute, n)`; fehlt beides, gilt das laufende Jahr |

Unabhängig vom Schema kann sich der **Ablageort** ändern: beim Umbenennen des
Projekts (`accountPlanner.v1` → `webapp.cashflow.v1`) übernimmt `loadState()`
eine vorhandene Altablage einmalig und entfernt sie danach. Frühere Schlüssel
stehen in `LEGACY_STORAGE_KEYS`.

## 6. Oberfläche

Vier Routen, jede eine Seite: **Verlauf** (Kennzahlen, Zeitraum, Kontoverlauf,
Monatssaldo, Buchungsliste), **Buchungen**, **Kategorien**, **Konto**.

### Buchungsliste

Die Zeile besteht aus vier Tokens — Name, Betrag, Rhythmus, Kategorie —, einer
Detailzeile und einer Aktionsgruppe (stilllegen, duplizieren, weitere Felder).
Das Raster ist fest, damit Beträge untereinander vergleichbar bleiben; nur der
Inhalt einzelner Zellen entfällt, wo es nichts zu zeigen gibt.

| Token | Editor | Deckt ab |
|---|---|---|
| Name | Eingabefeld an Ort und Stelle | `name` |
| Betrag | `AmountEditor` | `direction` und die komplette Phasenliste |
| Rhythmus | `RuleEditor` | Regeltyp, dessen Parameter, `skipMonths` |
| Kategorie | `CategoryEditor` | `categoryId` über den eingerückten Baum |
| `⋯` | `DetailsEditor` | Laufzeit, Notiz, Duplizieren, Löschen |

Änderungen wirken sofort (`update()`); die Liste zeichnet dabei neu, der offene
Editor bleibt stehen und sucht seinen Anker neu. Einzelne Ausnahmetermine
(`skipDates`) werden angezeigt, aber nicht bearbeitet — sie entstehen nur beim
Import.

### Diagramme

Der Kontoverlauf ist eine **Stufenlinie**: der Saldo springt mit jeder Buchung
und verläuft dazwischen waagerecht; eine gerade Verbindung würde Werte
behaupten, die es nie gab. Eine Reihe, also keine Legende; Punkte sitzen nur
auf Tief- und Höchststand und werden über Datum **und** Saldo bestimmt — an
einem Tag können mehrere Buchungen liegen.

Der Monatssaldo ist ein gestapelter Balken je Kategorie, Einnahmen nach oben,
Ausgaben nach unten. Ab neun Reihen wird zu „Übrige" gebündelt statt
weitergefärbt (A24); die Legende ist immer da, die Buchungsliste darunter ist
die zugehörige Tabellenansicht.

## 7. Tests

`npm test` (`node:test`, ohne Runner-Abhängigkeit, ohne Bundler) deckt
ausschließlich `src/core` ab. `npm run build` prüft zusätzlich mit
`tsc --noEmit`, `npm run typecheck` macht dasselbe allein.

Abgesichert sind u. a.: Monatsletzter und Schaltjahr, `skipMonths`/`skipDates`,
am `startDate` verankerte Intervalle, 14-tägig über den Jahreswechsel, Drift
von `everyNDays`, Phasenwechsel exakt am Grenztag, Saldovortrag bei später
beginnendem Fenster, Min/Max und Jahresdelta, Baumreihenfolge und Zyklusschutz
der Kategorien, unabhängige Kopien beim Duplizieren samt eindeutiger
Namensvergabe, das phasengenaue Setzen eines Betrags sowie Monatsgrenzen,
Monatsspannen und die Schema-1-Migration des Zeitraums.

Die Beispieldaten laufen als Datei durch dieselbe Importprüfung wie fremde
Dateien; Terminzahlen und Jahressummen sind fest verdrahtet, damit eine
Änderung an der Wiederholungs-Engine sofort auffällt.

**Nicht abgedeckt:** die Oberfläche. Fokus, Layoutstabilität und Klickziele
(A20, A21, A25) sind DOM-Verhalten; sie werden mit echten Maus- und
Tastatureingaben in einem headless Chrome geprüft, nicht von dieser Suite.

`npm run screenshots` (Playwright, `scripts/screenshots.mjs`) erzeugt die
Bilder der README aus den Beispieldaten. Der Lauf geht über den Startdialog
statt die Ablage zu füllen — damit prüft er den Einstieg gleich mit und
scheitert, wenn eine Route, ein Token oder ein Editor fehlt.

### Beispieldaten

`public/data/dummy-data.json` ist bewusst kein beliebiger Datensatz, sondern
eine Demonstration des Funktionsumfangs — und wird als solche getestet
(`test/dummyData.test.ts`):

- die vorgegebene Kategoriehierarchie (Gehälter mit zwei Untergehältern,
  Nebenkosten mit Telefon/Internet, Strom und Wasser),
- **jeder** Regeltyp genau einmal: `monthly`, `weekly`, `quarterly`, `yearly`,
  `everyNDays`, `once`, dazu die Varianten Monatsletzter, „außer im Dezember"
  und 14-tägig,
- je eine Ausgabe pro Blattkategorie; Oberkategorien bündeln nur,
- und die Bedingung, die das Ganze zusammenhält: **die Summe aller Ausgaben
  entspricht im Jahr 2026 exakt der Summe beider Gehälter** (66.000 €), das
  Jahr schließt also punktgenau auf null.

Der Datensatz ist auf 2026 festgelegt und bringt seinen Zeitraum mit
(`settings.view`), damit er unabhängig vom aktuellen Kalenderjahr immer das
Jahr zeigt, für das die Rechnung aufgeht. Wer die Beträge ändert, bricht die
Gleichheit — der Test weist genau darauf hin.

## 8. Bewusst ausgelassen

Tagesgenaue Zeiträume (siehe A14), je Seite eigene Zeiträume, Mehrfachzuordnung
eines Eintrags zu mehreren Kategorien, Drag-and-drop für den Kategoriebaum,
Farbvererbung, Serien-Bearbeitung mehrerer Einträge, Bearbeiten einzelner
Ausnahmetermine, mehrere Konten und Umbuchungen, Währungen außer EUR,
Authentifizierung, Server-Persistenz, Prognoseszenarien, Ist-Abgleich mit
echten Kontoumsätzen, Feiertags- und Werktagsverschiebung von Terminen,
Undo/Redo.

## 9. Geplanter nächster Schritt

Der Umstieg auf Vite + React (A22) und auf TypeScript (A26) ist erfolgt.
Offen bleibt:

- **A4 erneut prüfen**: sollen die Daten geräteübergreifend verfügbar sein,
  braucht es eine Ablage außerhalb des Browsers — dann ist auch A1 wieder
  offen.
- **`normalizeState` gegen ein Schema prüfen** statt von Hand: die Funktion ist
  der einzige Eingang für fremdes JSON und trägt die Last allein. Die Typen
  beschreiben das Ziel inzwischen vollständig — ein Prüfer ließe sich daraus
  ableiten.
- **Oberflächentests**: die Browser-Durchläufe sind bisher Wegwerf-Skripte.
  Sobald sich das Verhalten setzt, lohnt eine feste Suite.
