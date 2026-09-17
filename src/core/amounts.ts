/**
 * Betragsphasen: ein Eintrag kann über die Zeit unterschiedliche Beträge haben
 * ("bis 31.12. 820 €, danach 890 €"), beliebig viele Phasen.
 *
 * Eine Phase gilt ab ihrem `from`-Datum bis zum Beginn der nächsten Phase.
 * `from: null` bedeutet "von Anfang an".
 */
import type { AmountPhase, Direction, Entry, ISODate } from './types.ts';

/** Was `amountAt`/`setAmountAt` mindestens brauchen. */
type WithPhases = { amounts?: AmountPhase[] };
type WithDirection = WithPhases & { direction: Direction };

/** Phasen aufsteigend nach `from` sortiert (null zuerst). */
export function sortPhases(phases: AmountPhase[]): AmountPhase[] {
  return [...phases].sort((a, b) => (a.from ?? '').localeCompare(b.from ?? ''));
}

/**
 * Gültiger Betrag eines Eintrags an einem Datum — die letzte Phase,
 * deren `from` nicht in der Zukunft liegt.
 *
 * @returns 0, wenn an dem Datum noch keine Phase gilt
 */
export function amountAt(entry: WithPhases, iso: ISODate): number {
  let value = 0;
  let found = false;
  for (const phase of sortPhases(entry.amounts ?? [])) {
    if (phase.from == null || phase.from <= iso) {
      value = Number(phase.value) || 0;
      found = true;
    } else {
      break;
    }
  }
  return found ? value : 0;
}

/** Vorzeichenbehafteter Betrag: Ausgaben negativ, Einnahmen positiv. */
export function signedAmountAt(entry: WithDirection, iso: ISODate): number {
  const value = Math.abs(amountAt(entry, iso));
  return entry.direction === 'expense' ? -value : value;
}

/**
 * Setzt den Betrag der Phase, die an `iso` gilt — für die Inline-Bearbeitung
 * in der Übersichtstabelle. Gilt dort noch keine Phase (das Datum liegt vor
 * der ersten), wird die früheste Phase geändert.
 *
 * @returns neue Phasenliste (das Original bleibt unberührt)
 */
export function setAmountAt(entry: WithPhases, iso: ISODate, value: number): AmountPhase[] {
  const phases = sortPhases(entry.amounts ?? []);
  if (!phases.length) return [{ from: null, value: Math.abs(value) }];

  let target = 0;
  for (let i = 0; i < phases.length; i += 1) {
    const from = phases[i].from;
    if (from == null || from <= iso) target = i;
  }
  return phases.map((phase, i) => (i === target ? { ...phase, value: Math.abs(value) } : phase));
}
