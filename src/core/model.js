/**
 * Datenmodell und Defaults. Das gesamte Dokument wird genau so
 * in localStorage abgelegt und als JSON exportiert/importiert.
 */
import {
  today, monthKey, monthStart, monthEnd, addMonthKey, yearRange,
} from './dateUtils.js';
import { canReparent, indexById } from './categories.js';

export const SCHEMA_VERSION = 2;
/** Ablageort in localStorage (nicht die Schemaversion — die steht im Dokument). */
export const STORAGE_KEY = 'webapp.cashflow.v1';
/** Frühere Ablage unter dem alten Projektnamen; wird beim Laden übernommen. */
export const LEGACY_STORAGE_KEYS = ['accountPlanner.v1'];

/**
 * Palette für neue Kategorien, in fester Reihenfolge vergeben.
 *
 * Geprüft mit dem Validator der Visualisierungsrichtlinie: Helligkeitsband,
 * Chroma, Farbfehlsichtigkeits- und Normalsicht-Abstand bestehen in hellem
 * wie dunklem Modus. Die Reihenfolge deshalb nicht umsortieren; ab der
 * neunten Kategorie wählt der Anwender selbst.
 */
export const DEFAULT_COLORS = [
  '#2a78d6', '#eb6834', '#1baf7a', '#eda100',
  '#e87ba4', '#008300', '#4a3aa7', '#e34948',
];

export function createId(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

/** Standardsicht: das komplette laufende Kalenderjahr. */
export function currentYearView(iso = today()) {
  return yearRange(Number(iso.slice(0, 4)));
}

/** Leeres, gültiges Dokument. */
export function emptyState() {
  return {
    version: SCHEMA_VERSION,
    account: { name: 'Girokonto', startBalance: 0, startDate: monthStart(today()) },
    settings: { view: currentYearView() },
    categories: [],
    entries: [],
  };
}

export function createCategory(name, color, parentId = null) {
  return { id: createId('cat'), name, color, parentId };
}

/**
 * Kopie eines Eintrags mit neuer id — die Vorlage bleibt unberührt.
 *
 * Der Name wird eindeutig gemacht: mehrere Kopien nebeneinander wären sonst
 * nicht auseinanderzuhalten, und genau daneben liegt die Inline-Bearbeitung.
 *
 * @param {object} entry
 * @param {object[]} [existing] alle vorhandenen Einträge (für die Eindeutigkeit)
 */
export function duplicateEntry(entry, existing = []) {
  return {
    ...structuredClone(entry),
    id: createId('ent'),
    name: copyNameFor(entry.name, existing),
  };
}

/** "Miete" -> "Miete (Kopie)" -> "Miete (Kopie 2)" -> … */
export function copyNameFor(name, existing = []) {
  const taken = new Set(existing.map((e) => e.name));
  // „Miete (Kopie 2)" erneut kopiert ergibt „Miete (Kopie 3)", nicht „… (Kopie) (Kopie)"
  const stem = String(name ?? '').replace(/ \(Kopie(?: \d+)?\)$/, '');
  for (let n = 1; ; n += 1) {
    const candidate = n === 1 ? `${stem} (Kopie)` : `${stem} (Kopie ${n})`;
    if (!taken.has(candidate)) return candidate;
  }
}

export function createEntry(partial = {}) {
  return {
    id: createId('ent'),
    name: '',
    categoryId: null,
    direction: 'expense',
    note: '',
    active: true,
    startDate: today(),
    endDate: null,
    rule: { type: 'monthly', dayOfMonth: 1, interval: 1, skipMonths: [], skipDates: [] },
    amounts: [{ from: null, value: 0 }],
    ...partial,
  };
}

/**
 * Gespeicherter Zeitraum einer Sicht, immer als Monatsbereich
 * ("YYYY-MM" bis "YYYY-MM", beide inklusive).
 */
export function viewOf(state) {
  return normalizeView(state.settings?.view);
}

/** Monatsbereich -> Tagesfenster für die Rechnung. */
export function windowOf(view) {
  const { from, to } = normalizeView(view);
  return { from: monthStart(from), to: monthEnd(to) };
}

/** Sorgt für gültige Monatsschlüssel und eine nicht-negative Spanne. */
export function normalizeView(view) {
  const fallback = currentYearView();
  const isMonth = (value) => typeof value === 'string' && /^\d{4}-\d{2}$/.test(value.slice(0, 7));
  const from = isMonth(view?.from) ? view.from.slice(0, 7) : fallback.from;
  const to = isMonth(view?.to) ? view.to.slice(0, 7) : fallback.to;
  return to < from ? { from, to: from } : { from, to };
}

/** Zeitraum ab einem Monat über `count` Monate — für die Schnellwahl. */
export function viewFromMonths(startKey, count) {
  const from = monthKey(startKey);
  return { from, to: addMonthKey(from, Math.max(1, count) - 1) };
}

/**
 * Prüft ein importiertes Dokument und füllt fehlende Felder auf.
 * Wirft bei strukturellen Fehlern — der Aufrufer zeigt die Meldung an.
 */
export function normalizeState(input) {
  if (!input || typeof input !== 'object') throw new Error('Keine gültige JSON-Struktur.');
  if (input.version != null && input.version > SCHEMA_VERSION) {
    throw new Error(`Datei nutzt Version ${input.version}, dieses Tool kennt nur ${SCHEMA_VERSION}.`);
  }
  if (!input.account || typeof input.account !== 'object') throw new Error('Feld "account" fehlt.');
  if (!Array.isArray(input.entries)) throw new Error('Feld "entries" fehlt oder ist kein Array.');
  if (!Array.isArray(input.categories)) throw new Error('Feld "categories" fehlt oder ist kein Array.');

  const base = emptyState();
  const state = {
    version: SCHEMA_VERSION,
    account: {
      name: input.account.name ?? base.account.name,
      startBalance: Number(input.account.startBalance) || 0,
      startDate: input.account.startDate ?? base.account.startDate,
    },
    settings: { view: migrateView(input.settings) },
    categories: input.categories.map((c) => ({
      id: c.id ?? createId('cat'),
      name: c.name ?? 'Ohne Namen',
      color: c.color ?? DEFAULT_COLORS[0],
      parentId: c.parentId ?? null,
    })),
    entries: input.entries.map((e) => createEntry({
      ...e,
      amounts: Array.isArray(e.amounts) && e.amounts.length
        ? e.amounts.map((a) => ({ from: a.from ?? null, value: Number(a.value) || 0 }))
        : [{ from: null, value: 0 }],
      rule: { skipMonths: [], skipDates: [], ...(e.rule ?? {}) },
    })),
  };

  // verwaiste Kategorie-Referenzen lösen, statt später still falsch zu färben
  const known = new Set(state.categories.map((c) => c.id));
  for (const entry of state.entries) {
    if (entry.categoryId && !known.has(entry.categoryId)) entry.categoryId = null;
  }

  // Hierarchie absichern: unbekannte Eltern und Zyklen zu Wurzeln auflösen,
  // sonst würde die Baumdarstellung Kategorien verschlucken.
  const byId = indexById(state.categories);
  for (const category of state.categories) {
    if (category.parentId && !byId.has(category.parentId)) category.parentId = null;
  }
  for (const category of state.categories) {
    if (category.parentId && !canReparent(state.categories, category.id, category.parentId)) {
      category.parentId = null;
    }
  }
  return state;
}

/**
 * Schema 1 kannte nur `horizonMonths` ab heute; daraus wird ein
 * monatsgenauer Zeitraum. Fehlt beides, gilt das laufende Jahr.
 */
function migrateView(settings) {
  if (settings?.view) return normalizeView(settings.view);
  if (settings?.horizonMonths) {
    return viewFromMonths(today(), Number(settings.horizonMonths) || 12);
  }
  return currentYearView();
}
