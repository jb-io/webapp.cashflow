/** Alles, was kein eigenes Token hat: Laufzeit, Notiz, Löschen. */
import { day } from '../../format.js';
import { IconCopy, IconTrash } from '../Icons.jsx';

export default function DetailsEditor({ entry, apply, onDuplicate, onDelete }) {
  const set = (field, value) => apply((draft) => { draft[field] = value; });

  return (
    <>
      <h3>Laufzeit</h3>
      <div className="stack">
        <div className="field">
          <label htmlFor="entry-start">Läuft ab</label>
          <input id="entry-start" type="date" value={entry.startDate}
            onChange={(e) => e.target.value && set('startDate', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="entry-end">Läuft bis (leer = unbefristet)</label>
          <input id="entry-end" type="date" value={entry.endDate ?? ''}
            onChange={(e) => set('endDate', e.target.value || null)} />
        </div>
        {entry.endDate && entry.endDate < entry.startDate && (
          <p className="tiny neg">Das Enddatum liegt vor dem Startdatum — es fallen keine Termine an.</p>
        )}
        {(entry.rule.skipDates ?? []).length > 0 && (
          <p className="tiny muted">
            {entry.rule.skipDates.length} einzelne Ausnahmetermine: {entry.rule.skipDates.map(day).join(', ')}
          </p>
        )}
      </div>

      <h3>Notiz</h3>
      <input value={entry.note ?? ''} placeholder="optional"
        onChange={(e) => set('note', e.target.value)} />

      <h3>Eintrag</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn sm" onClick={onDuplicate}><IconCopy /> Duplizieren</button>
        <button type="button" className="btn sm danger" onClick={onDelete}><IconTrash /> Löschen</button>
      </div>
    </>
  );
}
