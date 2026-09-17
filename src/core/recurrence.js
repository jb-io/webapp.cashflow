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
} from './dateUtils.js';

/** Obergrenze, damit eine fehlerhafte Regel nicht endlos Termine erzeugt. */
const MAX_OCCURRENCES = 20000;

const WEEKDAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/**
 * @typedef {object} Rule
 * @property {'monthly'|'weekly'|'quarterly'|'yearly'|'everyNDays'|'once'} type
 * @property {number} [dayOfMonth]  1..31, oder -1 fuer "Monatsletzter"
 * @property {number} [interval]    Schrittweite (Monate bzw. Wochen), Default 1
 * @property {number[]} [skipMonths] Monate 1..12, in denen die Buchung entfaellt
 * @property {string[]} [skipDates]  einzelne ISO-Daten, die entfallen
 * @property {number} [weekday]     0=So .. 6=Sa (weekly)
 * @property {number} [monthOffset] 0..2, Position im Quartal (quarterly)
 * @property {number} [month]       1..12 (yearly)
 * @property {number} [n]           Tagesabstand (everyNDays)
 * @property {string} [anchor]      Ankerdatum (everyNDays)
 * @property {string} [date]        Termin (once)
 */

/**
 * Liefert alle Termine einer Regel im Fenster [windowFrom, windowTo].
 *
 * @param {Rule} rule
 * @param {object} opts
 * @param {string} opts.startDate   Beginn der Gültigkeit (ISO)
 * @param {string|null} [opts.endDate] Ende der Gültigkeit (ISO) oder null
 * @param {string} opts.from        Fensteranfang (ISO)
 * @param {string} opts.to          Fensterende (ISO)
 * @returns {string[]} aufsteigend sortierte ISO-Daten
 */
export function expandRule(rule, { startDate, endDate = null, from, to }) {
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
function generate(rule, begin, end, startDate) {
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
function monthly(dayOfMonth, interval, begin, end, startDate) {
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

  const out = [];
  for (; index <= endIndex && out.length < MAX_OCCURRENCES; index += step) {
    out.push(dateInMonth(Math.floor(index / 12), (index % 12) + 1, dayOfMonth));
  }
  return out;
}

/** Quartalsweise = monatlich mit Schrittweite 3, verankert an `monthOffset` im Quartal. */
function quarterly(rule, begin, end, startDate) {
  const offset = rule.monthOffset ?? 0;
  const startYear = partsOf(startDate).year;
  // Anker auf den ersten passenden Monat des Startjahres legen
  const anchor = dateInMonth(startYear, offset + 1, 1);
  const from = anchor <= startDate ? anchor : dateInMonth(startYear - 1, offset + 1, 1);
  return monthly(rule.dayOfMonth ?? 1, 3, begin, end, from);
}

/** Jaehrlich zu festem Monat/Tag. */
function yearly(rule, begin, end) {
  const month = rule.month ?? 1;
  const day = rule.dayOfMonth ?? 1;
  const out = [];
  for (let year = partsOf(begin).year; year <= partsOf(end).year; year += 1) {
    out.push(dateInMonth(year, month, day));
  }
  return out;
}

/**
 * Woechentlich bzw. alle `interval` Wochen, verankert am ersten passenden
 * Wochentag ab `startDate`.
 */
function weekly(rule, begin, end, startDate) {
  const weekday = rule.weekday ?? weekdayOf(startDate);
  const step = Math.max(1, rule.interval ?? 1) * 7;

  let anchor = startDate;
  anchor = addDays(anchor, (weekday - weekdayOf(anchor) + 7) % 7);

  let current = anchor;
  if (current < begin) {
    const cycles = Math.ceil(diffDays(current, begin) / step);
    current = addDays(current, cycles * step);
  }

  const out = [];
  for (; current <= end && out.length < MAX_OCCURRENCES; current = addDays(current, step)) {
    out.push(current);
  }
  return out;
}

/** Fester Tagesabstand ab einem Ankerdatum — ignoriert Monatslängen bewusst. */
function everyNDays(rule, begin, end, startDate) {
  const n = Math.max(1, rule.n ?? 30);
  const anchor = rule.anchor ?? startDate;

  let current = anchor;
  if (current < begin) {
    const cycles = Math.ceil(diffDays(current, begin) / n);
    current = addDays(current, cycles * n);
  }

  const out = [];
  for (; current <= end && out.length < MAX_OCCURRENCES; current = addDays(current, n)) {
    out.push(current);
  }
  return out;
}

/** Menschenlesbare Beschreibung einer Regel, z.B. "monatlich am 1., außer Dezember". */
export function describeRule(rule) {
  const day = (d) => (d === -1 ? 'am Monatsletzten' : `am ${d}.`);
  let text;
  switch (rule.type) {
    case 'once':
      text = `einmalig am ${rule.date ? formatDE(rule.date) : '?'}`;
      break;
    case 'monthly': {
      const i = rule.interval ?? 1;
      text = i === 1 ? `monatlich ${day(rule.dayOfMonth ?? 1)}`
        : `alle ${i} Monate ${day(rule.dayOfMonth ?? 1)}`;
      break;
    }
    case 'quarterly':
      text = `quartalsweise im ${(rule.monthOffset ?? 0) + 1}. Quartalsmonat ${day(rule.dayOfMonth ?? 1)}`;
      break;
    case 'yearly':
      text = `jährlich am ${rule.dayOfMonth ?? 1}. ${MONTH_NAMES[(rule.month ?? 1) - 1]}`;
      break;
    case 'weekly': {
      const i = rule.interval ?? 1;
      const wd = WEEKDAY_NAMES[rule.weekday ?? 1];
      text = i === 1 ? `wöchentlich am ${wd}` : `alle ${i} Wochen am ${wd}`;
      break;
    }
    case 'everyNDays':
      text = `alle ${rule.n ?? 30} Tage`;
      break;
    default:
      text = rule.type;
  }
  const skips = (rule.skipMonths ?? []).map((m) => MONTH_NAMES[m - 1]);
  if (skips.length) text += `, außer ${skips.join(', ')}`;
  if ((rule.skipDates ?? []).length) text += `, ${rule.skipDates.length} Ausnahmetermin(e)`;
  return text;
}
