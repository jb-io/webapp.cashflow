/**
 * Wiederholungs-Engine: übersetzt ein Regelobjekt in konkrete Termine.
 *
 * Bewusst ein eigenes, kleines Format statt RRULE (iCalendar), weil sich
 * "monatlich, aber nicht im Dezember" damit direkt abbilden und in der UI
 * pflegen lässt. Siehe Architecture.md.
 *
 * Alle Funktionen sind pur: gleiche Eingabe -> gleiche Ausgabe, kein Zustand.
 */
import {
  addDays, addMonths, dateInMonth, diffDays, maxDate, minDate,
  partsOf, weekdayOf, formatDE,
} from './dateUtils.ts';
import type { ISODate, Rule } from './types.ts';

/** Zeitfenster und Gültigkeit eines Eintrags. */
export interface ExpandOptions {
  /** Beginn der Gültigkeit */
  startDate: ISODate;
  /** Ende der Gültigkeit, null = unbefristet */
  endDate?: ISODate | null;
  /** Fensteranfang */
  from: ISODate;
  /** Fensterende */
  to: ISODate;
}

/** Rhythmus und Ausnahmen, jeweils lang und kurz. */
export interface RuleParts {
  rhythm: string;
  rhythmShort: string;
  exceptions: string;
  exceptionsShort: string;
}

/** Obergrenze, damit eine fehlerhafte Regel nicht endlos Termine erzeugt. */
const MAX_OCCURRENCES = 20000;

const WEEKDAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const WEEKDAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/**
 * Liefert alle Termine einer Regel im Fenster, aufsteigend sortiert.
 */
export function expandRule(
  rule: Rule,
  { startDate, endDate = null, from, to }: ExpandOptions,
): ISODate[] {
  const begin = maxDate(startDate, from);
  const end = minDate(endDate, to);
  if (begin == null || end == null || begin > end) return [];

  const raw = generate(rule, begin, end, startDate);
  const skipMonths = new Set(rule.skipMonths ?? []);
  const skipDates = new Set(rule.skipDates ?? []);

  return raw.filter((iso) =>
    iso >= begin && iso <= end &&
    !skipDates.has(iso) &&
    !skipMonths.has(partsOf(iso).month));
}

/** Erzeugt die Rohtermine je Regeltyp (ohne skip-Filter). */
function generate(rule: Rule, begin: ISODate, end: ISODate, startDate: ISODate): ISODate[] {
  switch (rule.type) {
    case 'once':
      return rule.date ? [rule.date] : [];
    case 'everyNDays':
      return everyNDays(rule, begin, end, startDate);
    case 'weekly':
      return weekly(rule, begin, end, startDate);
    case 'monthly':
      return monthly(rule.dayOfMonth ?? 1, rule.interval ?? 1, begin, end, startDate);
    case 'quarterly':
      return quarterly(rule, begin, end, startDate);
    case 'yearly':
      return yearly(rule, begin, end);
    default:
      throw new Error(`Unbekannter Regeltyp: ${rule.type}`);
  }
}

/**
 * Monatliche Termine. Der Zyklus ist am Monat von `startDate` verankert,
 * damit `interval: 2` auch dann stabil bleibt, wenn das Fenster spaeter beginnt.
 */
function monthly(
  dayOfMonth: number, interval: number, begin: ISODate, end: ISODate, startDate: ISODate,
): ISODate[] {
  const step = Math.max(1, interval);
  const anchor = partsOf(startDate);
  const anchorIndex = anchor.year * 12 + (anchor.month - 1);

  const beginParts = partsOf(begin);
  let index = beginParts.year * 12 + (beginParts.month - 1);
  // auf den nächsten Termin des Zyklus aufruecken (auch bei rückwärts liegendem Anker)
  const offset = ((index - anchorIndex) % step + step) % step;
  if (offset !== 0) index += step - offset;

  const endParts = partsOf(end);
  const endIndex = endParts.year * 12 + (endParts.month - 1);

  const out: ISODate[] = [];
  for (; index <= endIndex && out.length < MAX_OCCURRENCES; index += step) {
    out.push(dateInMonth(Math.floor(index / 12), (index % 12) + 1, dayOfMonth));
  }
  return out;
}

/** Quartalsweise = monatlich mit Schrittweite 3, verankert an `monthOffset` im Quartal. */
function quarterly(rule: Rule, begin: ISODate, end: ISODate, startDate: ISODate): ISODate[] {
  const offset = rule.monthOffset ?? 0;
  const startYear = partsOf(startDate).year;
  // Anker auf den ersten passenden Monat des Startjahres legen
  const anchor = dateInMonth(startYear, offset + 1, 1);
  const from = anchor <= startDate ? anchor : dateInMonth(startYear - 1, offset + 1, 1);
  return monthly(rule.dayOfMonth ?? 1, 3, begin, end, from);
}

/** Jaehrlich zu festem Monat/Tag. */
function yearly(rule: Rule, begin: ISODate, end: ISODate): ISODate[] {
  const month = rule.month ?? 1;
  const day = rule.dayOfMonth ?? 1;
  const out: ISODate[] = [];
  for (let year = partsOf(begin).year; year <= partsOf(end).year; year += 1) {
    out.push(dateInMonth(year, month, day));
  }
  return out;
}

/**
 * Woechentlich bzw. alle `interval` Wochen, verankert am ersten passenden
 * Wochentag ab `startDate`.
 */
function weekly(rule: Rule, begin: ISODate, end: ISODate, startDate: ISODate): ISODate[] {
  const weekday = rule.weekday ?? weekdayOf(startDate);
  const step = Math.max(1, rule.interval ?? 1) * 7;

  let anchor = startDate;
  anchor = addDays(anchor, (weekday - weekdayOf(anchor) + 7) % 7);

  let current = anchor;
  if (current < begin) {
    const cycles = Math.ceil(diffDays(current, begin) / step);
    current = addDays(current, cycles * step);
  }

  const out: ISODate[] = [];
  for (; current <= end && out.length < MAX_OCCURRENCES; current = addDays(current, step)) {
    out.push(current);
  }
  return out;
}

/** Fester Tagesabstand ab einem Ankerdatum — ignoriert Monatslängen bewusst. */
function everyNDays(rule: Rule, begin: ISODate, end: ISODate, startDate: ISODate): ISODate[] {
  const n = Math.max(1, rule.n ?? 30);
  const anchor = rule.anchor ?? startDate;

  let current = anchor;
  if (current < begin) {
    const cycles = Math.ceil(diffDays(current, begin) / n);
    current = addDays(current, cycles * n);
  }

  const out: ISODate[] = [];
  for (; current <= end && out.length < MAX_OCCURRENCES; current = addDays(current, n)) {
    out.push(current);
  }
  return out;
}

/**
 * Zerlegt eine Regel in beschreibende Bausteine. Die Listenansicht zeigt
 * Rhythmus und Ausnahmen getrennt und in Kurzform, Fließtext braucht beides
 * zusammengesetzt — deshalb eine Quelle für beide Formen.
 *
 */
export function describeRuleParts(rule: Rule): RuleParts {
  const day = (d: number) => (d === -1 ? 'am Monatsletzten' : `am ${d}.`);
  const dayShort = (d: number) => (d === -1 ? 'am Letzten' : `am ${d}.`);
  let rhythm: string;
  let rhythmShort: string;

  switch (rule.type) {
    case 'once':
      rhythm = `einmalig am ${rule.date ? formatDE(rule.date) : '?'}`;
      rhythmShort = rhythm;
      break;
    case 'monthly': {
      const i = rule.interval ?? 1;
      const d = rule.dayOfMonth ?? 1;
      rhythm = i === 1 ? `monatlich ${day(d)}` : `alle ${i} Monate ${day(d)}`;
      rhythmShort = i === 1 ? `monatlich ${dayShort(d)}` : `alle ${i} Monate ${dayShort(d)}`;
      break;
    }
    case 'quarterly':
      rhythm = `quartalsweise im ${(rule.monthOffset ?? 0) + 1}. Quartalsmonat ${day(rule.dayOfMonth ?? 1)}`;
      rhythmShort = `quartalsweise ${dayShort(rule.dayOfMonth ?? 1)}`;
      break;
    case 'yearly':
      rhythm = `jährlich am ${rule.dayOfMonth ?? 1}. ${MONTH_NAMES[(rule.month ?? 1) - 1]}`;
      rhythmShort = `jährlich am ${rule.dayOfMonth ?? 1}.${rule.month ?? 1}.`;
      break;
    case 'weekly': {
      const i = rule.interval ?? 1;
      const wd = rule.weekday ?? 1;
      rhythm = i === 1 ? `wöchentlich am ${WEEKDAY_NAMES[wd]}` : `alle ${i} Wochen am ${WEEKDAY_NAMES[wd]}`;
      rhythmShort = i === 1 ? `wöchentlich ${WEEKDAY_SHORT[wd]}`
        : i === 2 ? `14-täglich ${WEEKDAY_SHORT[wd]}`
          : `alle ${i} Wochen ${WEEKDAY_SHORT[wd]}`;
      break;
    }
    case 'everyNDays':
      rhythm = `alle ${rule.n ?? 30} Tage`;
      rhythmShort = rhythm;
      break;
    default:
      rhythm = rule.type;
      rhythmShort = rule.type;
  }

  const months = rule.skipMonths ?? [];
  const dates = rule.skipDates ?? [];
  const parts: string[] = [];
  const partsShort: string[] = [];
  if (months.length) {
    parts.push(`außer ${months.map((m) => MONTH_NAMES[m - 1]).join(', ')}`);
    partsShort.push(`außer ${months.map((m) => MONTH_SHORT[m - 1]).join(', ')}`);
  }
  if (dates.length) {
    parts.push(`${dates.length} Ausnahmetermin(e)`);
    partsShort.push(`${dates.length} Ausnahme${dates.length === 1 ? '' : 'n'}`);
  }

  return {
    rhythm,
    rhythmShort,
    exceptions: parts.join(', '),
    exceptionsShort: partsShort.join(' · '),
  };
}

/** Menschenlesbare Beschreibung einer Regel, z.B. "monatlich am 1., außer Dezember". */
export function describeRule(rule: Rule): string {
  const { rhythm, exceptions } = describeRuleParts(rule);
  return exceptions ? `${rhythm}, ${exceptions}` : rhythm;
}
