/** Betrag: Richtung und die komplette Phasenliste ("ab Datum X Betrag Y"). */
import { sortPhases } from '../../../core/amounts.js';
import { today } from '../../../core/dateUtils.js';
import { IconTrash } from '../Icons.jsx';

export default function AmountEditor({ entry, apply }) {
  const phases = sortPhases(entry.amounts ?? []);

  const setPhases = (next) => apply((draft) => { draft.amounts = sortPhases(next); });

  return (
    <>
      <h3>Art</h3>
      <div className="seg">
        <button type="button" className={entry.direction === 'expense' ? 'on' : ''}
          onClick={() => apply((draft) => { draft.direction = 'expense'; })}>Ausgabe</button>
        <button type="button" className={entry.direction === 'income' ? 'on' : ''}
          onClick={() => apply((draft) => { draft.direction = 'income'; })}>Einnahme</button>
      </div>

      <h3>Beträge</h3>
      <div className="stack">
        {phases.map((phase, index) => (
          <div className="phase-row" key={index}>
            {phase.from == null
              ? <span className="from-label">ab Beginn</span>
              : (
                <input type="date" aria-label="gilt ab" value={phase.from}
                  onChange={(e) => setPhases(phases.map((p, i) =>
                    (i === index ? { ...p, from: e.target.value || null } : p)))} />
              )}
            <input type="number" step="0.01" className="right" aria-label="Betrag" value={phase.value}
              onChange={(e) => setPhases(phases.map((p, i) =>
                (i === index ? { ...p, value: Math.abs(Number(e.target.value) || 0) } : p)))} />
            {phases.length > 1 && (
              <button type="button" className="btn icon ghost" title="Phase entfernen"
                onClick={() => setPhases(phases.filter((_, i) => i !== index))}>
                <IconTrash />
              </button>
            )}
          </div>
        ))}
        <button type="button" className="btn sm"
          onClick={() => setPhases([...phases, { from: today(), value: phases.at(-1)?.value ?? 0 }])}>
          + Betragsänderung
        </button>
        <p className="tiny muted">Ein Betrag gilt ab seinem Datum bis zum nächsten.</p>
      </div>
    </>
  );
}
