/** Konto & Daten: Stammdaten, Import/Export, Beispieldaten, Zurücksetzen. */
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { exportJson, importJson } from '../../core/storage.js';
import { useStore } from '../state/StateProvider.jsx';
import { fetchDummyState } from '../components/WelcomeDialog.jsx';

export default function AccountPage() {
  const { doc, update, replace, reset } = useStore();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [message, setMessage] = useState(null);

  const say = (text, bad = false) => setMessage({ text, bad });

  const setAccount = (field, value) => update((draft) => { draft.account[field] = value; });

  const exportFile = () => {
    const blob = new Blob([exportJson(doc)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `webapp.cashflow-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    say('Export heruntergeladen.');
  };

  const importFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!confirm('Import überschreibt die aktuell gespeicherten Daten. Fortfahren?')) {
      event.target.value = '';
      return;
    }
    try {
      replace(importJson(await file.text()));
      say(`Import aus „${file.name}“ erfolgreich.`);
    } catch (err) {
      say(`Import fehlgeschlagen: ${err.message}`, true);
    }
    event.target.value = '';
  };

  const loadDummy = async () => {
    if (doc.entries.length && !confirm('Beispieldaten ersetzen die aktuellen Daten. Fortfahren?')) return;
    try {
      replace(await fetchDummyState());
      navigate('/verlauf');
    } catch (err) {
      say(`Beispieldaten konnten nicht geladen werden: ${err.message}`, true);
    }
  };

  const resetAll = () => {
    if (!confirm('Wirklich alle Daten löschen? Danach fragt der Startdialog erneut, womit es losgehen soll.')) return;
    reset();
  };

  return (
    <main className="content">
      <div className="page-head"><h1>Konto</h1></div>

      <section className="card">
        <div className="card-head"><h2>Stammdaten</h2></div>
        <div className="card-body" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
          <div className="field">
            <label htmlFor="acc-name">Bezeichnung</label>
            <input id="acc-name" value={doc.account.name} onChange={(e) => setAccount('name', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="acc-balance">Startkontostand (€)</label>
            <input id="acc-balance" type="number" step="0.01" className="right" value={doc.account.startBalance}
              onChange={(e) => setAccount('startBalance', Number(e.target.value) || 0)} />
          </div>
          <div className="field">
            <label htmlFor="acc-start">Startdatum</label>
            <input id="acc-start" type="date" value={doc.account.startDate}
              onChange={(e) => e.target.value && setAccount('startDate', e.target.value)} />
          </div>
          <p className="small muted" style={{ gridColumn: '1 / -1' }}>
            Vor dem Startdatum wird nichts gerechnet — der Startkontostand gilt an diesem Tag.
          </p>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2>Daten</h2></div>
        <div className="card-body" style={{ display: 'grid', gap: 12 }}>
          <p className="small muted">
            Gespeichert wird im Browser (localStorage). Für Sicherung oder Umzug den JSON-Export nutzen.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={exportFile}>JSON exportieren</button>
            <button type="button" className="btn" onClick={() => fileRef.current.click()}>JSON importieren</button>
            <button type="button" className="btn" onClick={loadDummy}>Beispieldaten laden</button>
            <button type="button" className="btn danger" onClick={resetAll}>Alles zurücksetzen</button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importFile} />
          {message && <p className={`small ${message.bad ? 'neg' : 'muted'}`}>{message.text}</p>}
        </div>
      </section>
    </main>
  );
}
