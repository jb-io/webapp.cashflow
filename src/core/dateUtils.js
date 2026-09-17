/**
 * Datums-Helfer auf Basis von ISO-Strings ("YYYY-MM-DD").
 * Alles rechnet in UTC, damit es keine Zeitzonen-/Sommerzeit-Drift gibt.
 * Ein Datum ist im ganzen Projekt immer ein ISO-String, nie ein Date-Objekt.
 */

/** @param {string} iso @returns {Date} */
export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** @param {Date} date @returns {string} */
export function toISO(date) {
  return date.toISOString().slice(0, 10);
}

/** @returns {string} heutiges Datum als ISO-String (lokale Kalenderansicht) */
export function today() {
  const now = new Date();
  return toISO(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

/** @param {string} iso @param {number} days @returns {string} */
export function addDays(iso, days) {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}

/**
 * Verschiebt um Monate und klemmt den Tag auf den Monatsletzten,
 * damit der 31. Januar + 1 Monat der 28./29. Februar wird (nicht der 3. März).
 */
export function addMonths(iso, months) {
  const d = parseISO(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  d.setUTCDate(Math.min(day, daysInMonth(d.getUTCFullYear(), d.getUTCMonth() + 1)));
  return toISO(d);
}

/** @param {number} year @param {number} month 1-12 @returns {number} */
export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Baut ein Datum aus Jahr/Monat/Tag. `day === -1` bedeutet Monatsletzter,
 * zu grosse Tage (31. im Februar) werden auf den Monatsletzten geklemmt.
 */
export function dateInMonth(year, month, day) {
  const last = daysInMonth(year, month);
  const d = day === -1 ? last : Math.min(day, last);
  return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Ganze Tage zwischen zwei ISO-Daten (b - a). */
export function diffDays(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}

/** @param {string} iso @returns {number} 0=Sonntag .. 6=Samstag */
export function weekdayOf(iso) {
  return parseISO(iso).getUTCDay();
}

/** @param {string} iso @returns {{year:number, month:number, day:number}} */
export function partsOf(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
}

/** ISO-Monatsschluessel "YYYY-MM". */
export function monthKey(iso) {
  return iso.slice(0, 7);
}

/** Vergleich als String funktioniert bei ISO-Daten lexikografisch. */
export function isBefore(a, b) { return a < b; }
export function isAfter(a, b) { return a > b; }

/** Kleinster/groesster Wert, `null` wird als "unbegrenzt" behandelt. */
export function maxDate(a, b) {
  if (a == null) return b;
  if (b == null) return a;
  return a > b ? a : b;
}
export function minDate(a, b) {
  if (a == null) return b;
  if (b == null) return a;
  return a < b ? a : b;
}

/** Formatiert ein ISO-Datum als "TT.MM.JJJJ". */
export function formatDE(iso) {
  const { year, month, day } = partsOf(iso);
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
}

/**
 * Sichten sind immer monatsgenau: ein Zeitraum wird über Monatsschlüssel
 * ("YYYY-MM") beschrieben und erst für die Rechnung in Tagesdaten übersetzt.
 */

/** "2026-03" -> "2026-03-01" (auch aus einem vollen Datum). */
export function monthStart(key) {
  return `${key.slice(0, 7)}-01`;
}

/** "2026-02" -> "2026-02-28" (auch aus einem vollen Datum). */
export function monthEnd(key) {
  const [year, month] = key.slice(0, 7).split('-').map(Number);
  return dateInMonth(year, month, -1);
}

/** Verschiebt einen Monatsschlüssel um `count` Monate. */
export function addMonthKey(key, count) {
  return monthKey(addMonths(monthStart(key), count));
}

/** Anzahl Monate von `a` bis `b`, beide als Monatsschlüssel, inklusive. */
export function monthSpan(a, b) {
  const [ay, am] = a.slice(0, 7).split('-').map(Number);
  const [by, bm] = b.slice(0, 7).split('-').map(Number);
  return (by * 12 + bm) - (ay * 12 + am) + 1;
}

/** Ganzes Kalenderjahr als Monatsbereich. */
export function yearRange(year) {
  return { from: `${year}-01`, to: `${year}-12` };
}

/** "2026-03" -> "März 2026" */
const MONTH_NAMES_LONG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export function formatMonthDE(key) {
  const [year, month] = key.slice(0, 7).split('-').map(Number);
  return `${MONTH_NAMES_LONG[month - 1]} ${year}`;
}
