# Architektur — webapp.cashflow

Stand: 2026-09-17 · Phase: **React-Frontend auf geprüftem Rechenkern**

Diese Datei hält die tragenden Entscheidungen fest und wird bei jeder
Architekturänderung mit aktualisiert.

## 1. Zielbild

Liquiditätsplanung eines einzelnen Kontos: aus einem Startkontostand und frei
konfigurierbaren wiederkehrenden Einnahmen/Ausgaben wird der erwartete
Kontoverlauf berechnet und tabellarisch wie grafisch dargestellt. Die
fachlichen Kernpunkte sind beliebige Wiederholungsregeln (inkl. Ausnahmen wie
„monatlich außer im Dezember"), zeitlich gestaffelte Beträge und die Kennzahlen
Tiefstand, Höchststand und Zugewinn/Verlust im Zeitraum.

Nicht-Ziel in dieser Phase: Design, Mehrbenutzerbetrieb, echte Bankanbindung.

## 2. Entscheidungen

| # | Entscheidung | Begründung | Konsequenz |
|---|---|---|---|
| A1 | *(durch A22 abgelöst)* **Express nur als Static-Server**, keine REST-API | Alle Daten liegen im Browser; ein Backend ohne Daten wäre reine Zeremonie | `server.js` ist entfallen — Vite liefert aus |
| A2 | *(durch A22 abgelöst)* **Kein Build-Step**: native ES-Module in Browser und Node | Trug den Prototyp ohne Werkzeugkette | Gilt weiterhin für `src/core`: dort kein JSX, keine Bundler-Eigenheiten, damit die Tests die Dateien direkt laden |
| A3 | **`src/core` ist pur** — keine DOM-, Node- oder Framework-Abhängigkeit | Die Rechenlogik ist der wertvolle Teil und soll den geplanten Umstieg auf Vite + React unverändert überleben | UI-Code darf `core` importieren, nie umgekehrt |
| A4 | **Persistenz in `localStorage`** + JSON-Import/-Export | Kein Server-State, kein Setup; Export hält die Daten portabel und sicherbar | Daten hängen am Browserprofil — Backup ist Nutzeraufgabe |
| A5 | **Eigenes Regelformat statt RRULE** | „monatlich außer Dezember", Monatsletzter und Betragsphasen lassen sich direkt abbilden *und* in einem Formular pflegen; RRULE hätte einen Übersetzungslayer und eine schwerere UI erzwungen | Eigene Engine inkl. Tests (`src/core/recurrence.js`) |
| A6 | **Beträge als Phasenliste** statt eines Werts pro Eintrag | Anforderung „bis Datum X Betrag A, danach B" über beliebig viele Stufen | Jeder Termin wird einzeln bewertet (`amountAt`) |
| A7 | **Datumsarithmetik in UTC auf ISO-Strings** | Lokale Zeitzonen und Sommerzeit verschieben sonst Termine um einen Tag | Ein Datum ist überall ein `"YYYY-MM-DD"`-String, nie ein `Date` |
| A8 | **Saldo wird immer ab Kontostartdatum kumuliert**, das Anzeigefenster schneidet nur zu | Beginnt das Fenster später, muss der Startsaldo des Fensters die Buchungen davor enthalten | `buildForecast` rechnet ggf. mehr als angezeigt wird |
| A9 | **Chart.js per CDN** | Ausreichend für Linien- und Stapelbalken-Diagramm, kein Bundler nötig | Offline-Betrieb funktioniert nur mit Cache |
| A10 | **Neurendern statt Diffing**: jede Änderung schreibt den Zustand und rendert den aktiven Tab neu | Bei der Datenmenge eines Privatkontos (einige hundert Buchungen) unmessbar schnell und deutlich einfacher als Zustandssynchronisation | Fokus/Scrollposition gehen bei Vollrender verloren — bewusst akzeptiert |
| A11 | **Kategorien hierarchisch über `parentId`**, gespeichert bleibt eine *flache* Liste | Referenzen (`entry.categoryId`) bleiben stabil und Import/Export einfach; der Baum ist eine Sicht, kein Speicherformat | Baumoperationen liegen in `src/core/categories.js`; `normalizeState` muss Zyklen und unbekannte Eltern auflösen |
| A12 | *(durch A20 abgelöst)* **Inline-Bearbeitung in der Übersichtstabelle** für Name, Art und Betrag; alles Weitere im Dialog | Die häufigste Pflege ist „Betrag hat sich geändert" — dafür soll kein Dialog nötig sein. Regel und Phasen brauchen dagegen Kontext | Die Betragseingabe adressiert genau die *heute gültige* Phase (`setAmountAt`); die Tabelle weist die laufende Phase aus |
| A13 | **Inline-Änderungen greifen auf `change`**, nicht auf `input` | Bei `input` würde jeder Tastendruck einen Schreibvorgang auslösen | Übernahme erst beim Verlassen des Feldes bzw. mit Enter — siehe A16 zur Folge daraus |
| A14 | **Zeiträume sind immer ganze Monate** — gespeichert als Monatsbereich `settings.view = {from, to}` im Dokument, Standard ist das komplette laufende Kalenderjahr | Geplant wird in Monaten, nicht in Tagen; ein angebrochener Monat verzerrt Monatsbalken und Kennzahlen. Im Dokument gilt der Zeitraum für alle Sichten gleichzeitig und übersteht einen Reload; bedient wird er dort, wo er wirkt — im Verlauf-Tab | `windowOf()` übersetzt in ein Tagesfenster (erster bis letzter Monatstag); die UI kennt nur `<input type="month">`. Schemaänderung → **Version 2** |
| A15 | **Kategorie ebenfalls direkt aus der Liste wählbar** — seit A20 als Token-Popover mit eingerücktem Baum statt als Auswahlfeld in der Zeile | Das Umsortieren vieler Einträge war der einzige verbliebene Grund, den Dialog zu öffnen | Der Dialog bleibt für alles Strukturelle zuständig, die Tabelle deckt die laufende Pflege ab |
| A16 | *(durch A22 erledigt: React tauscht keine DOM-Knoten aus, die es wiederverwenden kann — an seine Stelle tritt A25)* **Inline-Änderungen rendern nicht neu** (`updateInline`): sie schreiben und speichern, danach frischt die Sicht nur die abgeleiteten Stellen der betroffenen Zeile auf (`patchRow`) | A10 (Vollrender) ist für Formulare falsch: das `change` einer Zelle wird durch den Klick in die *nächste* Zelle ausgelöst — der Vollrender tauscht die Tabelle dann mitten im Klick aus, der Klick landet im Nichts oder auf einer verschobenen Nachbarzeile, und die Eingabe geht in die falsche Zeile. Bei gleichnamigen Kopien untereinander fällt das als „falsche Zeile bearbeitet" auf | Die Tabelle muss abgeleitete Zellen (Betragsfarbe, Phasenhinweis, Kategoriefarbe/-Tooltip, Aktiv-Graustufe) selbst nachziehen. Andere Tabs sind unkritisch, weil `render()` ohnehin nur den aktiven Tab zeichnet |
| A18 | **Startdialog beim ersten Aufruf** mit drei Wegen: eigene JSON-Datei, leer beginnen, Beispieldaten. Er lässt sich nicht ohne Entscheidung schließen und erscheint nach „Alles zurücksetzen" erneut | Eine leere App erklärt sich nicht von selbst; die drei Wege decken alle Startsituationen ab. „Noch nie benutzt" (`hasStoredState()`) ist etwas anderes als „bewusst leer" — nur Ersteres fragt, und Zurücksetzen stellt genau diesen Ausgangszustand wieder her | Esc muss zusätzlich über das `close`-Ereignis abgefangen werden: ohne vorherige Nutzerinteraktion liefert Chrome `cancel` nicht abbrechbar aus. `resetState()` löscht die Ablage und speichert bewusst **nichts** zurück |
| A20 | **Buchungsliste als Token-Liste statt Formulartabelle**: die Zeile ist Text in einem Raster mit weglassbaren Zellen, jede veränderliche Angabe ist ein Token, dessen Klick ein Popover mit genau diesem Aspekt öffnet | Die Formulartabelle zeigte 11 × 5 Bedienelemente gleichzeitig — nichts stach hervor. Vor allem aber zwang sie die Wiederholung in eine Spalte, die für jeden Regeltyp andere Parameter bräuchte, weshalb die Regel dort nur *lesbar* war. Ein Token trägt nur das, was die jeweilige Regel hat | Das Popover hängt am `<body>` und findet seinen Anker über einen Selektor wieder; damit liegt der Fokus beim Bearbeiten nie in der Liste, und A16 ist für alle Tokens konstruktiv erledigt statt abgefangen. Preis: eigene Positionierungslogik (`popover.js`) und Angaben, die anklickbar sind, ohne wie ein Eingabefeld auszusehen |
| A22 | **Frontend auf Vite + React, Navigation über Hash-Routen** (`#/verlauf`, `#/buchungen`, `#/kategorien`, `#/konto`) | Der Prototyp hatte die Grenze des handgeschriebenen Renderns erreicht: Zustand, abgeleitete Werte und DOM von Hand synchron zu halten war die Quelle der meisten Fehler. Hash-Routen brauchen keine Server-Konfiguration — die App läuft aus jedem Verzeichnis und von der Platte | `src/core` wurde **unverändert** übernommen (A3 hat sich ausgezahlt), `src/app` ist neu. Build über `npm run build`; `npm test` prüft weiterhin nur den Kern, ohne Bundler |
| A23 | **Ein Layout, zwei Ausprägungen**: unter 900 px eine Spalte mit Navigationsleiste unten, darüber feste Seitenleiste; Editoren erscheinen mobil als Blatt von unten, ab 760 px angedockt am Token | Die Daumenzone ist unten, der Blick oben — dieselbe Navigation an beiden Stellen wäre auf einem der beiden Geräte falsch | Zwei Bruchstellen in `styles.css` (900 px Navigation, 760 px Zeilenraster und Editoren); `Sheet` entscheidet zur Laufzeit, ob es andockt |
| A24 | **Kategoriefarben aus einer geprüften Palette** (`DEFAULT_COLORS`), Diagrammfarben aus denselben CSS-Variablen wie die Oberfläche | Farbabstände sind rechenbar, nicht Geschmackssache: die Vorgängerpalette fiel bei Farbfehlsichtigkeit und beim Normalsicht-Abstand durch. Ab neun Reihen wird gebündelt statt weitergefärbt | Reihenfolge der Palette nicht umsortieren; der dunkle Modus hat eigene Werte statt gespiegelter |
| A21 | **Tastaturbedienung der Liste**: ↑/↓ Zeile, ←/→ Angabe, Enter öffnet, Esc schließt | In einem Dauerformular ist die Tab-Reihenfolge schon von den Feldern belegt; erst die Token-Liste macht eine sinnvolle Navigation möglich | Enter/Leertaste werden ausdrücklich behandelt, nicht über die native Schaltflächen-Aktivierung |
| A25 | **Zeilenhöhe darf sich beim Bedienen nicht ändern**: die Detailzeile einer Buchung ist immer sichtbar, nicht erst bei Auswahl | Erscheint sie erst beim Anklicken, verschiebt sie alles darunter — zwischen Drücken und Loslassen wandert das Ziel weg, und der Klick kommt nie an. Dieselbe Klasse von Fehlern wie A16, nur über das Layout statt über den DOM-Austausch | Auch das Feld zum Umbenennen ist maßgleich zum Token gebaut |
| A19 | **Beispieldaten liegen als JSON im Auslieferungsformat** (`public/data/dummy-data.json`), nicht als Code | Sie laufen damit durch exakt dieselbe Importprüfung wie eine fremde Datei — der Importpfad wird bei jedem Start mitgetestet — und lassen sich ohne Werkzeug bearbeiten | Das Laden ist asynchron (`fetch`); es gibt nur noch eine Quelle für Startdialog und „Beispieldaten laden" im Konto-Tab |
| A17 | **Kopien bekommen einen eindeutigen Namen** (`Name (Kopie)`, `(Kopie 2)`, …; vorhandene Kopie-Suffixe werden nicht gestapelt) | Zwei identisch benannte Zeilen direkt untereinander sind in einer inline bearbeitbaren Tabelle nicht auseinanderzuhalten | `duplicateEntry(entry, existing)` braucht die vorhandenen Einträge |

## 3. Aufbau

```
server.js            Static-Server (public/ und src/)
src/core/            pure Rechenlogik — Browser + Tests
  dateUtils.js       ISO-Datumsarithmetik in UTC
  categories.js      Kategoriebaum: Pfad, Tiefe, Unterbaum, Zyklusschutz
  recurrence.js      expandRule(): Regel -> konkrete Termine; describeRule()
  amounts.js         amountAt()/setAmountAt(): gültiger Betrag zu einem Datum (Phasen)
  forecast.js        buildForecast(): Transaktionen + Saldoverlauf; aggregateByMonth()
  stats.js           computeStats(): Min/Max mit Datum, Delta, Kategoriesummen
  model.js           Schema, Defaults, Zeitraum (viewOf/windowOf), duplicateEntry(), normalizeState()
  storage.js         localStorage + JSON-Import/-Export
public/              UI (Vanilla, ES-Module)
  app.js             Zustand, Render-Zyklus, Tab-Umschaltung
  components/        je Tab eine Datei + entryForm.js (Dialog), welcome.js (Startdialog),
                     popover.js (Token-Editor), viewRange.js (Zeitraum), format.js
  data/              dummy-data.json — Beispieldaten im Import/Export-Format
test/                node:test-Suite gegen src/core
```

**Zustandsänderungen** laufen ausschließlich über `state/StateProvider.jsx`:
`update(mutate)` arbeitet auf einer Kopie und speichert, `replace(doc)` setzt
einen komplett neuen Datenstand (Import, Beispieldaten, Startdialog),
`reset()` löscht die Ablage und fragt erneut, `setView(view)` ändert den
Zeitraum. Forecast, Monatsaggregate und Kennzahlen sind gememoisiert und
werden nie gespeichert.

**Abhängigkeitsrichtung:** `public/*` → `src/core/*`. Innerhalb von `core` gilt
`dateUtils` ← `recurrence`/`amounts` ← `forecast` ← `stats`; `categories` ist
unabhängig davon und wird von `model` (Validierung) und der UI genutzt.

## 4. Datenmodell

Ein einziges Dokument; genau diese Struktur liegt in `localStorage`
(Schlüssel `webapp.cashflow.v1`) und in der Export-Datei.

```jsonc
{
  "version": 2,
  "account":  { "name": "Girokonto", "startBalance": 2500, "startDate": "2026-01-01" },
  "settings": { "view": { "from": "2026-01", "to": "2026-12" } },   // Monate, inklusive
  "categories": [
    { "id": "cat_x", "name": "Wohnen", "color": "#e07a5f", "parentId": null },
    { "id": "cat_y", "name": "Miete",  "color": "#e07a5f", "parentId": "cat_x" }
  ],
  "entries": [{
    "id": "ent_y",
    "name": "Miete",
    "categoryId": "cat_y",          // null = ohne Kategorie; immer die *genaue* Kategorie
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

### Kategoriehierarchie — Regeln

- **Auswertung:** Summen einer Kategorie enthalten in der Anzeige ihren
  Unterbaum; die Buchungen selbst bleiben der exakten Kategorie zugeordnet.
  Der Filter im Verlauf schließt Unterkategorien ein, der Schalter
  „nur Oberkategorien" rollt die Monatsbalken auf die Wurzel auf (`rootIdOf`).
- **Löschen:** Unterkategorien rücken auf die Ebene der gelöschten Kategorie
  nach; betroffene Einträge werden kategorielos statt mitgelöscht.
- **Umhängen:** Das Einhängen in den eigenen Unterbaum ist ausgeschlossen
  (`canReparent`) — solche Optionen erscheinen gar nicht erst im Auswahlfeld.
- **Farbe:** wird nicht vererbt. Unterkategorien starten üblicherweise mit der
  Farbe der Oberkategorie, sind aber frei änderbar.

### Regeltypen

| `type` | Felder | Semantik |
|---|---|---|
| `monthly` | `dayOfMonth` (1–31 oder `-1` = Monatsletzter), `interval` | Tag wird auf den Monatsletzten geklemmt (31. → 28./29. Februar). Der Zyklus ist am `startDate` verankert. |
| `weekly` | `weekday` (0 = So … 6 = Sa), `interval` | `interval: 2` = 14-tägig, verankert am ersten passenden Wochentag ab `startDate` |
| `quarterly` | `monthOffset` (0–2), `dayOfMonth` | Zucker für `monthly` mit `interval: 3` |
| `yearly` | `month` (1–12), `dayOfMonth` | |
| `everyNDays` | `n`, `anchor` | Fester Tagesabstand, driftet bewusst gegenüber Monatsterminen |
| `once` | `date` | Einmalbuchung |

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

`version` steht im Dokument. `normalizeState()` (in `model.js`) ist der einzige
Eingang für fremde Daten: es lehnt neuere Versionen ab, füllt fehlende Felder
mit Defaults, löst verwaiste Kategorie-Referenzen und Hierarchie-Zyklen auf und
migriert ältere Schemata. `loadState()` schreibt ein migriertes Dokument sofort
zurück, damit die Ablage nicht im alten Schema verharrt.

| Version | Änderung | Migration |
|---|---|---|
| 1 | Ausgangsschema; Zeitraum nur als `settings.horizonMonths` ab heute | — |
| 2 | Zeitraum als Monatsbereich `settings.view`; Kategorien mit `parentId` | `horizonMonths` → `viewFromMonths(heute, n)`; fehlt beides, gilt das laufende Jahr |

Unabhängig vom Schema kann sich der **Ablageort** ändern: beim Umbenennen des
Projekts (`accountPlanner.v1` → `webapp.cashflow.v1`) übernimmt `loadState()`
eine vorhandene Altablage einmalig und entfernt sie danach. Frühere Schlüssel
stehen in `LEGACY_STORAGE_KEYS`.

## 6. Tests

`npm test` (`node:test`, ohne Runner-Abhängigkeit) deckt ausschließlich
`src/core` ab — die UI ist im Prototyp bewusst ungetestet. Abgesichert sind
u. a.: Monatsletzter und Schaltjahr, `skipMonths`/`skipDates`, am `startDate`
verankerte Intervalle, 14-tägig über den Jahreswechsel, Drift von
`everyNDays`, Phasenwechsel exakt am Grenztag, Saldovortrag bei später
beginnendem Fenster, Min/Max und Jahresdelta, Baumreihenfolge und Zyklusschutz
der Kategorien, unabhängige Kopien beim Duplizieren samt eindeutiger
Namensvergabe, das phasengenaue Setzen eines Betrags sowie Monatsgrenzen,
Monatsspannen und die Schema-1-Migration des Zeitraums.

Die Beispieldaten laufen als Datei durch dieselbe Importprüfung wie fremde
Dateien; Terminzahlen und Jahressummen sind fest verdrahtet, damit eine
Änderung an der Wiederholungs-Engine sofort auffällt.

Das Zusammenspiel von Fokus, `change` und Render (A16) ist DOM-Verhalten und
damit außerhalb dieser Suite; es wird mit echten Maus- und Tastatureingaben im
Browser geprüft (Klick von einer Zelle in die nächste über mehrere
gleichartige Zeilen hinweg).

### Buchungsliste

Die Zeile besteht aus vier Tokens — Name, Betrag, Rhythmus, Kategorie — und
einer Aktionsgruppe (stilllegen, duplizieren, alle Felder). Das Raster ist fest,
damit Beträge untereinander vergleichbar bleiben; nur der Inhalt einzelner
Zellen entfällt, wo es nichts zu zeigen gibt.

| Token | Editor | Deckt ab |
|---|---|---|
| Name | Eingabefeld an Ort und Stelle | `name` |
| Betrag | Popover | `direction` und die komplette Phasenliste |
| Rhythmus | Popover | Regeltyp, dessen Parameter, `skipMonths` |
| Kategorie | Popover | `categoryId` über den eingerückten Baum |

Was ein Token nicht abdeckt — Laufzeit, Notiz, einzelne Ausnahmetermine,
Löschen — bleibt im Dialog hinter `⋯` erreichbar. Änderungen wirken sofort
(`update()`); die Liste rendert dabei neu, das offene Popover bleibt stehen und
sucht seinen Anker neu. Nur ein Wechsel des Regeltyps oder der Phasenzahl baut
den Popover-Inhalt neu auf — sonst würde es den Cursor aus einem Feld werfen.

### Beispieldaten

`public/data/dummy-data.json` ist bewusst kein beliebiger Datensatz, sondern
eine Demonstration des Funktionsumfangs — und wird als solche getestet
(`test/dummyData.test.js`):

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

## 7. Bewusst ausgelassen

Tagesgenaue Zeiträume (bewusst, siehe A14), je Tab eigene Zeiträume,
Mehrfachzuordnung eines Eintrags zu mehreren Kategorien, Drag-and-drop für den
Kategoriebaum, Farbvererbung, Serien-Bearbeitung mehrerer Einträge,
mehrere Konten und Umbuchungen, Währungen außer EUR, Authentifizierung,
Server-Persistenz, Prognoseszenarien (optimistisch/pessimistisch),
Ist-Abgleich mit echten Kontoumsätzen, Feiertags-/Werktagsverschiebung von
Terminen, Undo/Redo.

## 8. Geplanter nächster Schritt

Der Umstieg auf Vite + React ist erfolgt (A22); `src/core` wurde dabei nicht
angefasst. Offen bleiben aus derselben Überlegung:

- **TypeScript**: JSDoc → `.ts` für `src/core`, danach für `src/app`.
- **A4 erneut prüfen**: sollen die Daten geräteübergreifend verfügbar sein,
  braucht es eine Ablage außerhalb des Browsers — dann ist auch A1 wieder
  offen.
