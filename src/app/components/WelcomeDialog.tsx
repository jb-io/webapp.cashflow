/**
 * Startdialog beim ersten Aufruf — ohne Entscheidung geht es nicht weiter,
 * eine leere App erklärt sich nicht von selbst (Architecture.md, A18).
 */
import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { emptyState } from '../../core/model.ts';
import { importJson } from '../../core/storage.ts';
import type { CashflowDoc } from '../../core/types.ts';
import { useStore } from '../state/StateProvider.tsx';

/** Mitgelieferte Beispieldaten im Import/Export-Format (A19). */
export const DUMMY_DATA_URL = `${import.meta.env.BASE_URL}data/dummy-data.json`;

export async function fetchDummyState(): Promise<CashflowDoc> {
  const response = await fetch(DUMMY_DATA_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Beispieldaten nicht erreichbar (HTTP ${response.status}).`);
  return importJson(await response.text());
}

export default function WelcomeDialog() {
  const { replace } = useStore();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  const takeFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      replace(importJson(await file.text()));
      navigate('/verlauf');
    } catch (err) {
      setError(`Datei konnte nicht gelesen werden: ${(err as Error).message}`);
      event.target.value = '';
    }
  };

  const takeDummy = async () => {
    setError('');
    try {
      replace(await fetchDummyState());
      navigate('/verlauf');
    } catch (err) {
      setError(`Beispieldaten konnten nicht geladen werden: ${(err as Error).message}`);
    }
  };

  return (
    <div className="modal-center" role="dialog" aria-modal="true" aria-label="Womit soll es losgehen?">
      <div className="card welcome-card">
        <div className="card-body">
          <h1>cashflow</h1>
          <p className="small muted" style={{ marginTop: 4 }}>
            Noch keine Daten vorhanden. Womit soll es losgehen?
          </p>

          <div className="welcome-options">
            <button type="button" className="welcome-option" onClick={() => fileRef.current?.click()}>
              <strong>Aus JSON-Datei laden</strong>
              <span>Eine zuvor exportierte Datei einlesen.</span>
            </button>
            <button type="button" className="welcome-option" onClick={() => { replace(emptyState()); navigate('/konto'); }}>
              <strong>Leer starten</strong>
              <span>Konto, Kategorien und Buchungen selbst anlegen.</span>
            </button>
            <button type="button" className="welcome-option" onClick={takeDummy}>
              <strong>Beispieldaten laden</strong>
              <span>Zwei Gehälter und je eine Ausgabe pro Kategorie — über alle Intervalle.</span>
            </button>
          </div>

          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={takeFile} />
          {error && <p className="small neg" style={{ marginTop: 12 }}>{error}</p>}
        </div>
      </div>
    </div>
  );
}
