/**
 * Einziger Ort, an dem der Zustand lebt.
 *
 * Das Dokument bleibt exakt das Format aus `src/core` — die Rechenlogik ist
 * unverändert übernommen (Architecture.md, A3). Abgeleitetes (Forecast,
 * Monatsaggregate, Kennzahlen) wird gememoisiert, nicht gespeichert.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { loadState, saveState, hasStoredState, clearState } from '../../core/storage.ts';
import { emptyState, viewOf, windowOf, normalizeView } from '../../core/model.ts';
import { buildForecast, aggregateByMonth } from '../../core/forecast.ts';
import { computeStats } from '../../core/stats.ts';
import type {
  CashflowDoc, Forecast, ISODate, MonthBucket, MonthRange, Stats,
} from '../../core/types.ts';

/** Was eine Änderung am Dokument tut — immer auf einer Kopie. */
export type Mutate = (draft: CashflowDoc) => void;

export interface Store {
  doc: CashflowDoc;
  /** Zeitraum als Monatsbereich */
  view: MonthRange;
  /** derselbe Zeitraum als Tagesfenster */
  range: { from: ISODate; to: ISODate };
  forecast: Forecast;
  months: MonthBucket[];
  stats: Stats;
  /** true, solange noch nie eine Ablage bestand */
  askStart: boolean;
  update: (mutate: Mutate) => void;
  replace: (next: CashflowDoc) => void;
  reset: () => void;
  setView: (view: MonthRange) => void;
}

const StateContext = createContext<Store | null>(null);

export function StateProvider({ children }: { children: ReactNode }) {
  const [doc, setDoc] = useState(() => loadState());
  // „noch nie benutzt" ist etwas anderes als „bewusst leer" (A18)
  const [askStart, setAskStart] = useState(() => !hasStoredState());

  /** Ändern über eine Kopie: React braucht eine neue Referenz zum Neuzeichnen. */
  const update = useCallback((mutate: Mutate) => {
    setDoc((previous) => {
      const next = structuredClone(previous);
      mutate(next);
      saveState(next);
      return next;
    });
  }, []);

  const replace = useCallback((next: CashflowDoc) => {
    saveState(next);
    setDoc(next);
    setAskStart(false);
  }, []);

  /** Zurücksetzen speichert bewusst nichts — der Startdialog fragt erneut. */
  const reset = useCallback(() => {
    clearState();
    setDoc(emptyState());
    setAskStart(true);
  }, []);

  const setView = useCallback((view: MonthRange) => {
    update((draft) => { draft.settings.view = normalizeView(view); });
  }, [update]);

  const view = useMemo(() => viewOf(doc), [doc]);
  const range = useMemo(() => windowOf(view), [view]);
  const forecast = useMemo(() => buildForecast(doc, range.from, range.to), [doc, range]);
  const months = useMemo(() => aggregateByMonth(forecast), [forecast]);
  const stats = useMemo(() => computeStats(forecast), [forecast]);

  const value = useMemo<Store>(() => ({
    doc, view, range, forecast, months, stats, askStart,
    update, replace, reset, setView,
  }), [doc, view, range, forecast, months, stats, askStart, update, replace, reset, setView]);

  return <StateContext.Provider value={value}>{children}</StateContext.Provider>;
}

export function useStore(): Store {
  const value = useContext(StateContext);
  if (!value) throw new Error('useStore außerhalb des StateProvider benutzt');
  return value;
}
