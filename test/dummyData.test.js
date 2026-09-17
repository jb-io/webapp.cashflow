/**
 * Die mitgelieferten Beispieldaten sind Teil der Auslieferung und werden
 * mitgeprüft: sie müssen durch dieselbe Importprüfung laufen wie eine fremde
 * Datei, jedes Intervall abdecken und im Jahr exakt auf null aufgehen.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeState } from '../src/core/model.js';
import { importJson } from '../src/core/storage.js';
import { buildForecast } from '../src/core/forecast.js';
import { computeStats } from '../src/core/stats.js';
import { expandRule } from '../src/core/recurrence.js';
import { flattenTree, pathOf } from '../src/core/categories.js';

const RAW = readFileSync(new URL('../public/data/dummy-data.json', import.meta.url), 'utf8');
const YEAR = { from: '2026-01-01', to: '2026-12-31' };

const load = () => importJson(RAW);

test('Beispieldaten sind gültiges Import-Format', () => {
  const state = load();
  assert.deepEqual(state, normalizeState(JSON.parse(RAW)), 'Import verändert nichts mehr');
  assert.equal(state.version, 2);
  assert.deepEqual(state.settings.view, { from: '2026-01', to: '2026-12' });
});

test('Kategoriebaum entspricht der Vorgabe', () => {
  const state = load();
  assert.deepEqual(
    flattenTree(state.categories).map(({ category, depth }) => `${'  '.repeat(depth)}${category.name}`),
    [
      'Gehälter',
      '  Gehalt 1',
      '  Gehalt 2',
      'Haus / Wohnung',
      'Auto',
      'Versicherungen',
      'Nebenkosten',
      '  Telefon / Internet',
      '  Strom',
      '  Wasser',
      'Hobbies',
      'Steuer',
      'Haushaltsbudget',
    ]);
  assert.equal(pathOf(state.categories, 'cat_strom'), 'Nebenkosten / Strom');
});

test('jedes Intervall ist vertreten', () => {
  const used = new Set(load().entries.map((e) => e.rule.type));
  assert.deepEqual([...used].sort(),
    ['everyNDays', 'monthly', 'once', 'quarterly', 'weekly', 'yearly']);

  const byName = Object.fromEntries(load().entries.map((e) => [e.name, e.rule]));
  assert.equal(byName['Telefon & Internet'].dayOfMonth, -1, 'Monatsletzter');
  assert.deepEqual(byName['Stromabschlag'].skipMonths, [12], 'außer im Dezember');
  assert.equal(byName['Sport & Hobby'].interval, 2, '14-tägig');
});

test('beide Gehälter liefern 66.000 € im Jahr', () => {
  const stats = computeStats(buildForecast(load(), YEAR.from, YEAR.to));
  assert.equal(stats.totalIncome, 66000);
});

test('die Summe aller Ausgaben entspricht exakt der Summe beider Gehälter', () => {
  const stats = computeStats(buildForecast(load(), YEAR.from, YEAR.to));
  assert.equal(stats.totalExpense, stats.totalIncome);
  assert.equal(stats.delta, 0, 'das Jahr schließt punktgenau auf null');
  assert.equal(stats.closing, stats.opening);
});

test('jede Kategorie ohne Unterkategorien trägt genau eine Bewegung', () => {
  const state = load();
  const parents = new Set(state.categories.map((c) => c.parentId).filter(Boolean));
  const leaves = state.categories.filter((c) => !parents.has(c.id));
  for (const leaf of leaves) {
    const entries = state.entries.filter((e) => e.categoryId === leaf.id);
    assert.equal(entries.length, 1, `${leaf.name} hat genau einen Eintrag`);
  }
  // Oberkategorien bündeln nur, sie tragen selbst nichts
  for (const parentId of parents) {
    assert.equal(state.entries.filter((e) => e.categoryId === parentId).length, 0);
  }
});

test('die Termine je Eintrag sind stabil', () => {
  const counts = Object.fromEntries(load().entries.map((entry) => [
    entry.name,
    expandRule(entry.rule, {
      startDate: entry.startDate, endDate: entry.endDate, from: YEAR.from, to: YEAR.to,
    }).length,
  ]));
  assert.deepEqual(counts, {
    'Gehalt 1': 12,
    'Gehalt 2': 12,
    Miete: 12,
    'Tanken & Wartung': 13,
    Versicherungspaket: 4,
    'Telefon & Internet': 12,
    Stromabschlag: 11,
    'Wasser & Abwasser': 1,
    'Sport & Hobby': 26,
    Steuernachzahlung: 1,
    Wocheneinkauf: 52,
  });
});
