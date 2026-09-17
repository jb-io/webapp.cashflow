# webapp.cashflow

Plant den erwarteten Kontoverlauf aus einem Startkontostand und wiederkehrenden
Einnahmen und Ausgaben — tabellarisch und grafisch, mit Tiefstand, Höchststand
und Jahresergebnis.

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # Typprüfung + Bau nach dist/
npm test          # Rechenlogik in src/core
```

Beim ersten Aufruf fragt ein Startdialog, womit es losgehen soll: eigene
JSON-Datei laden, leer starten oder die mitgelieferten Beispieldaten
(`public/data/dummy-data.json`) — zwei Gehälter und je eine Ausgabe pro
Kategorie über alle Intervalle, deren Jahressumme exakt aufgeht.

Die Daten liegen im Browser (localStorage). Für Sicherung oder Umzug den
JSON-Export unter **Konto** nutzen.

Oberfläche: React mit Hash-Routen (`#/verlauf`, `#/buchungen`, `#/kategorien`,
`#/konto`), ausgelegt für Telefon wie großen Bildschirm, heller und dunkler
Modus. Geschrieben in TypeScript. Die Rechenlogik in `src/core` ist framework-frei
und wird von der Testsuite ohne Bundler direkt geladen.

Architekturentscheidungen: siehe [Architecture.md](Architecture.md).
