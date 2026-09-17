/** Rhythmus: Regeltyp, dessen Parameter und die Ausnahmemonate. */
import type { Entry, Rule, RuleType } from '../../../core/types.ts';
import type { ApplyToEntry } from './AmountEditor.tsx';

const RULE_TYPES: [RuleType, string][] = [
  ['monthly', 'Monat'], ['weekly', 'Woche'], ['quarterly', 'Quartal'],
  ['yearly', 'Jahr'], ['everyNDays', 'N Tage'], ['once', 'einmalig'],
];
const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const DAYS: [number, string][] = [
  ...Array.from({ length: 31 }, (_, i): [number, string] => [i + 1, `${i + 1}.`]),
  [-1, 'Monatsletzter'],
];

interface Props { entry: Entry; apply: ApplyToEntry; }

export default function RuleEditor({ entry, apply }: Props) {
  const rule = entry.rule;
  const setRule = (patch: Partial<Rule>) => apply((draft) => { Object.assign(draft.rule, patch); });

  /** Typwechsel verwirft die typabhängigen Felder, behält aber die Ausnahmen. */
  const setType = (type: RuleType) => apply((draft) => {
    draft.rule = { type, skipMonths: draft.rule.skipMonths ?? [], skipDates: draft.rule.skipDates ?? [] };
  });

  const toggleMonth = (m: number) => apply((draft) => {
    const months = new Set<number>(draft.rule.skipMonths ?? []);
    if (months.has(m)) months.delete(m); else months.add(m);
    draft.rule.skipMonths = [...months].sort((a, b) => a - b);
  });

  return (
    <>
      <h3>Wiederholung</h3>
      <div className="seg">
        {RULE_TYPES.map(([value, label]) => (
          <button key={value} type="button" className={rule.type === value ? 'on' : ''}
            onClick={() => setType(value)}>{label}</button>
        ))}
      </div>

      <div className="inline" style={{ marginTop: 10 }}>
        {rule.type === 'monthly' && (<>
          <label>am</label>
          <select style={{ width: 'auto' }} value={rule.dayOfMonth ?? 1}
            onChange={(e) => setRule({ dayOfMonth: Number(e.target.value) })}>
            {DAYS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <label>jeden</label>
          <input type="number" min="1" max="24" style={{ width: 72 }} value={rule.interval ?? 1}
            onChange={(e) => setRule({ interval: Number(e.target.value) })} />
          <label>Monat</label>
        </>)}

        {rule.type === 'weekly' && (<>
          <label>am</label>
          <select style={{ width: 'auto' }} value={rule.weekday ?? 1}
            onChange={(e) => setRule({ weekday: Number(e.target.value) })}>
            {WEEKDAYS.map((name, i) => <option key={i} value={i}>{name}</option>)}
          </select>
          <label>jede</label>
          <input type="number" min="1" max="52" style={{ width: 72 }} value={rule.interval ?? 1}
            onChange={(e) => setRule({ interval: Number(e.target.value) })} />
          <label>Woche</label>
        </>)}

        {rule.type === 'quarterly' && (<>
          <select style={{ width: 'auto' }} value={rule.monthOffset ?? 0}
            onChange={(e) => setRule({ monthOffset: Number(e.target.value) })}>
            {[1, 2, 3].map((n) => <option key={n} value={n - 1}>{n}. Quartalsmonat</option>)}
          </select>
          <label>am</label>
          <select style={{ width: 'auto' }} value={rule.dayOfMonth ?? 1}
            onChange={(e) => setRule({ dayOfMonth: Number(e.target.value) })}>
            {DAYS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </>)}

        {rule.type === 'yearly' && (<>
          <label>im</label>
          <select style={{ width: 'auto' }} value={rule.month ?? 1}
            onChange={(e) => setRule({ month: Number(e.target.value) })}>
            {MONTHS.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}
          </select>
          <label>am</label>
          <select style={{ width: 'auto' }} value={rule.dayOfMonth ?? 1}
            onChange={(e) => setRule({ dayOfMonth: Number(e.target.value) })}>
            {DAYS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </>)}

        {rule.type === 'everyNDays' && (<>
          <label>alle</label>
          <input type="number" min="1" style={{ width: 80 }} value={rule.n ?? 30}
            onChange={(e) => setRule({ n: Number(e.target.value) })} />
          <label>Tage, ab</label>
          <input type="date" style={{ width: 'auto' }} value={rule.anchor ?? entry.startDate}
            onChange={(e) => setRule({ anchor: e.target.value })} />
        </>)}

        {rule.type === 'once' && (<>
          <label>am</label>
          <input type="date" style={{ width: 'auto' }} value={rule.date ?? entry.startDate}
            onChange={(e) => setRule({ date: e.target.value })} />
        </>)}
      </div>

      {rule.type !== 'once' && (<>
        <h3>Ausnahmemonate</h3>
        <div className="chips">
          {MONTHS_SHORT.map((name, i) => {
            const on = (rule.skipMonths ?? []).includes(i + 1);
            return (
              <button key={name} type="button" className={`chip-toggle ${on ? 'on' : ''}`}
                aria-pressed={on} onClick={() => toggleMonth(i + 1)}>
                {name}
              </button>
            );
          })}
        </div>
      </>)}
    </>
  );
}
