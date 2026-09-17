# webapp.cashflow (Prototyp)

Plant den erwarteten Kontoverlauf aus einem Startkontostand und wiederkehrenden
Einnahmen/Ausgaben — tabellarisch und grafisch, mit Tiefstand, Höchststand und
Zugewinn/Verlust im gewählten Zeitraum.

```bash
npm install
npm start     # http://localhost:3000
npm test      # Rechenlogik in src/core
```

Beim ersten Aufruf fragt ein Startdialog, womit es losgehen soll: eigene
JSON-Datei laden, leer starten oder die mitgelieferten Beispieldaten
(`public/data/dummy-data.json`) — zwei Gehälter und je eine Ausgabe pro
Kategorie über alle Intervalle, deren Jahressumme exakt aufgeht. Später
erreichbar über Tab **Konto & Daten** → *Beispieldaten laden*.

Die Daten liegen im Browser (localStorage). Für Backup oder Umzug den
JSON-Export im selben Tab nutzen.

Architekturentscheidungen: siehe [Architecture.md](Architecture.md).
