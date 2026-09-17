import test from 'node:test';
import assert from 'node:assert/strict';
import { expandRule, describeRule } from '../src/core/recurrence.js';

const win = (from, to) => ({ startDate: from, from, to });

test('monatlich zum 31. klemmt auf den Monatsletzten', () => {
  const dates = expandRule({ type: 'monthly', dayOfMonth: 31 }, win('2026-01-01', '2026-04-30'));
  assert.deepEqual(dates, ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
});

test('Schaltjahr: Februar bekommt den 29.', () => {
  const dates = expandRule({ type: 'monthly', dayOfMonth: -1 }, win('2028-01-01', '2028-03-31'));
  assert.deepEqual(dates, ['2028-01-31', '2028-02-29', '2028-03-31']);
});

test('skipMonths lässt den Dezember aus', () => {
  const dates = expandRule({ type: 'monthly', dayOfMonth: 1, skipMonths: [12] }, win('2026-01-01', '2026-12-31'));
  assert.equal(dates.length, 11);
  assert.ok(!dates.some((d) => d.startsWith('2026-12')));
});

test('skipDates entfernt einzelne Termine', () => {
  const dates = expandRule(
    { type: 'monthly', dayOfMonth: 15, skipDates: ['2026-03-15'] },
    win('2026-01-01', '2026-04-30'));
  assert.deepEqual(dates, ['2026-01-15', '2026-02-15', '2026-04-15']);
});

test('zweimonatlich bleibt am startDate verankert, auch wenn das Fenster später beginnt', () => {
  const dates = expandRule(
    { type: 'monthly', dayOfMonth: 10, interval: 2 },
    { startDate: '2026-01-10', from: '2026-05-01', to: '2026-10-31' });
  assert.deepEqual(dates, ['2026-05-10', '2026-07-10', '2026-09-10']);
});

test('14-tägig läuft sauber über den Jahreswechsel', () => {
  const dates = expandRule(
    { type: 'weekly', weekday: 1, interval: 2 },
    { startDate: '2026-12-07', from: '2026-12-01', to: '2027-01-31' });
  assert.deepEqual(dates, ['2026-12-07', '2026-12-21', '2027-01-04', '2027-01-18']);
  assert.ok(dates.every((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === 1));
});

test('everyNDays driftet gegenüber Monatsterminen', () => {
  const dates = expandRule(
    { type: 'everyNDays', n: 30, anchor: '2026-01-05' },
    win('2026-01-01', '2026-04-30'));
  assert.deepEqual(dates, ['2026-01-05', '2026-02-04', '2026-03-06', '2026-04-05']);
});

test('quartalsweise liefert vier Termine pro Jahr', () => {
  const dates = expandRule(
    { type: 'quarterly', dayOfMonth: 10, monthOffset: 0 },
    win('2026-01-01', '2026-12-31'));
  assert.deepEqual(dates, ['2026-01-10', '2026-04-10', '2026-07-10', '2026-10-10']);
});

test('quarterly mit monthOffset verschiebt innerhalb des Quartals', () => {
  const dates = expandRule(
    { type: 'quarterly', dayOfMonth: 1, monthOffset: 2 },
    win('2026-01-01', '2026-12-31'));
  assert.deepEqual(dates, ['2026-03-01', '2026-06-01', '2026-09-01', '2026-12-01']);
});

test('jährlich respektiert das Fenster', () => {
  const dates = expandRule({ type: 'yearly', month: 3, dayOfMonth: 15 }, win('2026-01-01', '2028-06-30'));
  assert.deepEqual(dates, ['2026-03-15', '2027-03-15', '2028-03-15']);
});

test('endDate beendet die Serie', () => {
  const dates = expandRule(
    { type: 'monthly', dayOfMonth: 1 },
    { startDate: '2026-01-01', endDate: '2026-03-15', from: '2026-01-01', to: '2026-12-31' });
  assert.deepEqual(dates, ['2026-01-01', '2026-02-01', '2026-03-01']);
});

test('once liefert genau einen Termin und nur im Fenster', () => {
  assert.deepEqual(expandRule({ type: 'once', date: '2026-05-05' }, win('2026-01-01', '2026-12-31')), ['2026-05-05']);
  assert.deepEqual(expandRule({ type: 'once', date: '2025-05-05' }, win('2026-01-01', '2026-12-31')), []);
});

test('unbekannter Regeltyp fällt auf', () => {
  assert.throws(() => expandRule({ type: 'quatsch' }, win('2026-01-01', '2026-12-31')), /Unbekannter Regeltyp/);
});

test('describeRule ist lesbar', () => {
  assert.equal(describeRule({ type: 'monthly', dayOfMonth: 1, skipMonths: [12] }), 'monatlich am 1., außer Dezember');
  assert.equal(describeRule({ type: 'monthly', dayOfMonth: -1 }), 'monatlich am Monatsletzten');
  assert.equal(describeRule({ type: 'everyNDays', n: 30 }), 'alle 30 Tage');
});
