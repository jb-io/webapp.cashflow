/**
 * Zeitraum aller Sichten — immer ganze Monate (Architecture.md, A14).
 * Der Wert liegt im Dokument und gilt damit für alle Seiten gleichzeitig.
 */
import { currentYearView, viewFromMonths } from '../../core/model.ts';
import { monthKey, monthSpan, today } from '../../core/dateUtils.ts';
import { useStore } from '../state/StateProvider.tsx';
import { IconChevronLeft, IconChevronRight } from './Icons.tsx';
import type { MonthKey, MonthRange } from '../../core/types.ts';

interface Preset { key: string; label: string; build: () => MonthRange; }

const yearOf = (year: number): MonthRange => ({ from: `${year}-01`, to: `${year}-12` });

const PRESETS: Preset[] = [
  { key: 'thisYear', label: 'Dieses Jahr', build: () => currentYearView() },
  { key: 'nextYear', label: 'Nächstes Jahr', build: () => yearOf(Number(today().slice(0, 4)) + 1) },
  { key: 'm12', label: '12 Monate', build: () => viewFromMonths(today(), 12) },
  { key: 'm24', label: '24 Monate', build: () => viewFromMonths(today(), 24) },
  { key: 'm60', label: '5 Jahre', build: () => viewFromMonths(today(), 60) },
];

function shift(key: MonthKey, months: number): MonthKey {
  const [year, m] = key.split('-').map(Number);
  const index = year * 12 + (m - 1) + months;
  return monthKey(`${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`);
}

export default function PeriodPicker() {
  const { view, setView } = useStore();
  const span = monthSpan(view.from, view.to);
  const move = (months: number) => setView({ from: shift(view.from, months), to: shift(view.to, months) });

  return (
    <div className="card">
      <div className="card-head">
        <h2>Zeitraum</h2>
        <span className="spacer" />
        <span className="small muted num">{span} Monate</span>
      </div>
      <div className="card-body" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" className="btn icon" title="Ein Jahr zurück" onClick={() => move(-12)}>
            <IconChevronLeft />
          </button>
          <div className="field" style={{ flex: '1 1 130px' }}>
            <label htmlFor="view-from">Von</label>
            <input id="view-from" type="month" value={view.from}
              onChange={(e) => e.target.value && setView({ ...view, from: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 130px' }}>
            <label htmlFor="view-to">Bis</label>
            <input id="view-to" type="month" value={view.to}
              onChange={(e) => e.target.value && setView({ ...view, to: e.target.value })} />
          </div>
          <button type="button" className="btn icon" title="Ein Jahr vor" onClick={() => move(12)}>
            <IconChevronRight />
          </button>
        </div>

        <div className="seg">
          {PRESETS.map((preset) => {
            const target = preset.build();
            const on = target.from === view.from && target.to === view.to;
            return (
              <button key={preset.key} type="button" className={on ? 'on' : ''}
                onClick={() => setView(target)}>
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
