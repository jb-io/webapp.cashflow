import test from 'node:test';
import assert from 'node:assert/strict';
import {
  currentYearView, viewOf, windowOf, normalizeView, viewFromMonths, normalizeState, emptyState,
} from '../src/core/model.js';
import { monthStart, monthEnd, monthSpan, addMonthKey, yearRange } from '../src/core/dateUtils.js';

test('Monatsgrenzen treffen auch kurze Monate', () => {
  assert.equal(monthStart('2026-02'), '2026-02-01');
  assert.equal(monthEnd('2026-02'), '2026-02-28');
  assert.equal(monthEnd('2028-02'), '2028-02-29');
  assert.equal(monthEnd('2026-04'), '2026-04-30');
  assert.equal(monthStart('2026-02-17'), '2026-02-01', 'akzeptiert auch ein volles Datum');
});

test('Monatsrechnung über den Jahreswechsel', () => {
  assert.equal(addMonthKey('2026-12', 1), '2027-01');
  assert.equal(addMonthKey('2026-01', -1), '2025-12');
  assert.equal(monthSpan('2026-01', '2026-12'), 12);
  assert.equal(monthSpan('2026-11', '2027-02'), 4);
  assert.equal(monthSpan('2026-05', '2026-05'), 1);
});

test('Standardsicht ist das komplette laufende Kalenderjahr', () => {
  assert.deepEqual(currentYearView('2026-09-16'), { from: '2026-01', to: '2026-12' });
  assert.deepEqual(currentYearView('2026-01-01'), yearRange(2026));
  assert.deepEqual(emptyState().settings.view, currentYearView());
});

test('Monatsbereich wird zum Tagesfenster inklusive letztem Monatstag', () => {
  assert.deepEqual(windowOf({ from: '2026-01', to: '2026-12' }), { from: '2026-01-01', to: '2026-12-31' });
  assert.deepEqual(windowOf({ from: '2026-02', to: '2026-02' }), { from: '2026-02-01', to: '2026-02-28' });
});

test('normalizeView repariert Unsinn statt zu werfen', () => {
  assert.deepEqual(normalizeView({ from: '2026-12', to: '2026-03' }), { from: '2026-12', to: '2026-12' });
  assert.deepEqual(normalizeView({ from: 'quatsch', to: '2026-03' }).to, '2026-03');
  assert.deepEqual(normalizeView(undefined), currentYearView());
  assert.deepEqual(normalizeView({ from: '2026-05-17', to: '2026-08-02' }), { from: '2026-05', to: '2026-08' });
});

test('Schnellwahl über N Monate ist inklusive', () => {
  assert.deepEqual(viewFromMonths('2026-09-16', 12), { from: '2026-09', to: '2027-08' });
  assert.deepEqual(viewFromMonths('2026-01', 1), { from: '2026-01', to: '2026-01' });
});

test('Schema 1 wird auf einen Monatszeitraum migriert', () => {
  const state = normalizeState({
    version: 1,
    account: { name: 'T', startBalance: 0, startDate: '2026-01-01' },
    settings: { horizonMonths: 24 },
    categories: [],
    entries: [],
  });
  assert.equal(state.version, 2);
  assert.equal(monthSpan(state.settings.view.from, state.settings.view.to), 24);
  assert.match(state.settings.view.from, /^\d{4}-\d{2}$/);
});

test('fehlende settings fallen auf das laufende Jahr zurück', () => {
  const state = normalizeState({
    account: { name: 'T', startBalance: 0, startDate: '2026-01-01' },
    categories: [],
    entries: [],
  });
  assert.deepEqual(viewOf(state), currentYearView());
});
