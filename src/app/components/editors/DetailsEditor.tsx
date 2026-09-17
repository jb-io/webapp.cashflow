/** Alles, was kein eigenes Token hat: Laufzeit, Notiz, Löschen. */
import { day } from '../../format.ts';
import { IconCopy, IconTrash } from '../Icons.tsx';
import type { Entry } from '../../../core/types.ts';
import type { ApplyToEntry } from './AmountEditor.tsx';

interface Props {
  entry: Entry;
  apply: ApplyToEntry;
  onDuplicate: () => void;
  onDelete: () => void;
}

export default function DetailsEditor({ entry, apply, onDuplicate, onDelete }: Props) {
  const setStart = (value: string) => apply((draft) => { draft.startDate = value; });
  const setEnd = (value: string | null) => apply((draft) => { draft.endDate = value; });
  const setNote = (value: string) => apply((draft) => { draft.note = value; });

  return (
    <>
      <h3>Laufzeit</h3>
      <div className="stack">
        <div className="field">
          <label htmlFor="entry-start">Läuft ab</label>
          <input id="entry-start" type="date" value={entry.startDate}
            onChange={(e) => e.target.value && setStart(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="entry-end">Läuft bis (leer = unbefristet)</label>
          <input id="entry-end" type="date" value={entry.endDate ?? ''}
            onChange={(e) => setEnd(e.target.value || null)} />
        </div>
        {entry.endDate && entry.endDate < entry.startDate && (
          <p className="tiny neg">Das Enddatum liegt vor dem Startdatum — es fallen keine Termine an.</p>
        )}
        {(entry.rule.skipDates ?? []).length > 0 && (
          <p className="tiny muted">
            {entry.rule.skipDates!.length} einzelne Ausnahmetermine: {entry.rule.skipDates!.map(day).join(', ')}
          </p>
        )}
      </div>

      <h3>Notiz</h3>
      <input value={entry.note ?? ''} placeholder="optional"
        onChange={(e) => setNote(e.target.value)} />

      <h3>Eintrag</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn sm" onClick={onDuplicate}><IconCopy /> Duplizieren</button>
        <button type="button" className="btn sm danger" onClick={onDelete}><IconTrash /> Löschen</button>
      </div>
    </>
  );
}
