import test from 'node:test';
import assert from 'node:assert/strict';
import { buildForecast, aggregateByMonth } from '../src/core/forecast.js';
import { computeStats } from '../src/core/stats.js';
import { normalizeState } from '../src/core/model.js';

function state(entries, startBalance = 1000) {
  return {
    version: 1,
    account: { name: 'Test', startBalance, startDate: '2026-01-01' },
    settings: { view: { from: '2026-01', to: '2026-12' } },
    categories: [{ id: 'c1', name: 'Wohnen', color: '#000000' }],
    entries,
  };
}

const miete = {
  id: 'e1', name: 'Miete', categoryId: 'c1', direction: 'expense', active: true,
  startDate: '2026-01-01', endDate: null,
  rule: { type: 'monthly', dayOfMonth: 1, skipMonths: [12] },
  amounts: [{ from: null, value: 100 }],
};
const gehalt = {
  id: 'e2', name: 'Gehalt', categoryId: null, direction: 'income', active: true,
  startDate: '2026-01-01', endDate: null,
  rule: { type: 'monthly', dayOfMonth: 15 },
  amounts: [{ from: null, value: 300 }],
};

test('Saldo kumuliert über alle Buchungen', () => {
  const fc = buildForecast(state([miete, gehalt]), '2026-01-01', '2026-03-31');
  assert.equal(fc.transactions.length, 6);
  assert.equal(fc.openingBalance, 1000);
  assert.equal(fc.closingBalance, 1000 + 3 * 300 - 3 * 100);
  assert.equal(fc.transactions[0].balance, 900);
  assert.equal(fc.transactions[1].balance, 1200);
});

test('inaktive Einträge werden ignoriert', () => {
  const fc = buildForecast(state([{ ...miete, active: false }, gehalt]), '2026-01-01', '2026-03-31');
  assert.equal(fc.transactions.length, 3);
});

test('bei gleichem Datum kommt die Einnahme vor der Ausgabe', () => {
  const sameDay = { ...gehalt, id: 'e3', rule: { type: 'monthly', dayOfMonth: 1 } };
  const fc = buildForecast(state([miete, sameDay]), '2026-01-01', '2026-01-31');
  assert.deepEqual(fc.transactions.map((t) => t.name), ['Gehalt', 'Miete']);
});

test('Fenster beginnt frühestens am Kontostart', () => {
  const fc = buildForecast(state([gehalt]), '2025-01-01', '2026-02-28');
  assert.equal(fc.from, '2026-01-01');
  assert.equal(fc.transactions.length, 2);
});

test('Betragsphasen wirken im Verlauf', () => {
  const phased = { ...miete, amounts: [{ from: null, value: 100 }, { from: '2026-03-01', value: 150 }] };
  const fc = buildForecast(state([phased]), '2026-01-01', '2026-03-31');
  assert.deepEqual(fc.transactions.map((t) => t.amount), [-100, -100, -150]);
});

test('Kennzahlen: Minimum, Maximum, Delta', () => {
  const fc = buildForecast(state([miete, gehalt]), '2026-01-01', '2026-12-31');
  const s = computeStats(fc);
  assert.equal(s.min.balance, 900);          // nach der ersten Miete
  assert.equal(s.min.date, '2026-01-01');
  assert.equal(s.max.date, '2026-12-15');    // Dezember ist mietfrei
  assert.equal(s.totalIncome, 3600);
  assert.equal(s.totalExpense, 1100);
  assert.equal(s.delta, 2500);
  assert.equal(s.closing - s.opening, s.delta);
});

test('Minimum meldet Unterdeckung mit Datum', () => {
  const fc = buildForecast(state([{ ...miete, amounts: [{ from: null, value: 2000 }] }], 500), '2026-01-01', '2026-02-28');
  const s = computeStats(fc);
  assert.equal(s.belowZero.date, '2026-01-01');
  assert.ok(s.min.balance < 0);
});

test('Monatsaggregation deckt jeden Monat des Fensters ab', () => {
  const fc = buildForecast(state([miete, gehalt]), '2026-01-01', '2026-12-31');
  const months = aggregateByMonth(fc);
  assert.equal(months.length, 12);
  assert.equal(months[0].month, '2026-01');
  assert.equal(months[11].expense, 0);        // Dezember mietfrei
  assert.equal(months[11].endBalance, fc.closingBalance);
  assert.equal(months[0].byCategory.c1, -100);
});

test('normalizeState löst verwaiste Kategorien und lehnt neuere Versionen ab', () => {
  const s = normalizeState({ ...state([{ ...miete, categoryId: 'weg' }]), categories: [] });
  assert.equal(s.entries[0].categoryId, null);
  assert.throws(() => normalizeState({ version: 99, account: {}, entries: [], categories: [] }), /Version 99/);
  assert.throws(() => normalizeState({ account: {}, categories: [] }), /entries/);
});

test('Fensterstart nach Kontostart trägt den Saldo korrekt vor', () => {
  // Konto startet 01.01. mit 1000, Fenster erst ab April:
  // Jan-Mär bringen 3x(+300 -100) = +600 -> Startsaldo des Fensters 1600.
  const fc = buildForecast(state([miete, gehalt]), '2026-04-01', '2026-06-30');
  assert.equal(fc.from, '2026-04-01');
  assert.equal(fc.openingBalance, 1600);
  assert.equal(fc.transactions.length, 6);
  assert.equal(fc.transactions[0].date, '2026-04-01');
  assert.equal(fc.transactions[0].balance, 1500);
  assert.equal(fc.closingBalance, 2200);
  assert.equal(computeStats(fc).delta, 600);
});

test('leeres Fenster behält den vorgetragenen Saldo', () => {
  const fc = buildForecast(state([gehalt]), '2026-12-16', '2026-12-31');
  assert.equal(fc.transactions.length, 0);
  assert.equal(fc.openingBalance, 1000 + 12 * 300);
  assert.equal(fc.closingBalance, fc.openingBalance);
  assert.equal(computeStats(fc).delta, 0);
});
