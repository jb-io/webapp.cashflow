import test from 'node:test';
import assert from 'node:assert/strict';
import {
  flattenTree, pathOf, rootIdOf, depthOf, descendantIds, canReparent, ancestryOf,
} from '../src/core/categories.js';
import { normalizeState, duplicateEntry, copyNameFor, createCategory } from '../src/core/model.js';

const cats = [
  { id: 'a', name: 'Wohnen', color: '#111111', parentId: null },
  { id: 'b', name: 'Miete', color: '#222222', parentId: 'a' },
  { id: 'c', name: 'Nebenkosten', color: '#333333', parentId: 'a' },
  { id: 'd', name: 'Strom', color: '#444444', parentId: 'c' },
  { id: 'e', name: 'Einkommen', color: '#555555', parentId: null },
];

test('flattenTree liefert Baumreihenfolge mit Tiefe', () => {
  assert.deepEqual(flattenTree(cats).map(({ category, depth }) => `${depth}:${category.id}`),
    ['0:a', '1:b', '1:c', '2:d', '0:e']);
});

test('Pfad, Wurzel und Tiefe', () => {
  assert.equal(pathOf(cats, 'd'), 'Wohnen / Nebenkosten / Strom');
  assert.equal(rootIdOf(cats, 'd'), 'a');
  assert.equal(rootIdOf(cats, 'e'), 'e');
  assert.equal(depthOf(cats, 'd'), 2);
  assert.equal(depthOf(cats, 'a'), 0);
  assert.deepEqual(ancestryOf(cats, 'b').map((c) => c.id), ['a', 'b']);
});

test('descendantIds enthält die Kategorie selbst und den ganzen Ast', () => {
  assert.deepEqual([...descendantIds(cats, 'a')].sort(), ['a', 'b', 'c', 'd']);
  assert.deepEqual([...descendantIds(cats, 'd')], ['d']);
});

test('canReparent verhindert Selbstbezug und Einhängen im eigenen Ast', () => {
  assert.equal(canReparent(cats, 'a', 'a'), false);
  assert.equal(canReparent(cats, 'a', 'd'), false);
  assert.equal(canReparent(cats, 'd', 'e'), true);
  assert.equal(canReparent(cats, 'd', null), true);
});

test('defekte Hierarchien hängen die Baumdarstellung nicht auf', () => {
  const cyclic = [
    { id: 'x', name: 'X', color: '#000000', parentId: 'y' },
    { id: 'y', name: 'Y', color: '#000000', parentId: 'x' },
  ];
  assert.equal(flattenTree(cyclic).length, 2);
  assert.equal(ancestryOf(cyclic, 'x').length, 2);
});

test('normalizeState repariert unbekannte Eltern und Zyklen', () => {
  const state = normalizeState({
    version: 1,
    account: { name: 'T', startBalance: 0, startDate: '2026-01-01' },
    categories: [
      { id: 'x', name: 'X', color: '#000000', parentId: 'y' },
      { id: 'y', name: 'Y', color: '#000000', parentId: 'x' },
      { id: 'z', name: 'Z', color: '#000000', parentId: 'gibtsnicht' },
    ],
    entries: [],
  });
  assert.equal(state.categories.find((c) => c.id === 'z').parentId, null);
  assert.equal(flattenTree(state.categories).length, 3);
  const roots = state.categories.filter((c) => c.parentId === null);
  assert.ok(roots.length >= 2, 'der Zyklus ist aufgelöst');
});

test('createCategory übernimmt die Oberkategorie', () => {
  assert.equal(createCategory('Strom', '#fff', 'a').parentId, 'a');
  assert.equal(createCategory('Wohnen', '#fff').parentId, null);
});

test('duplicateEntry erzeugt eine unabhängige Kopie mit neuer id', () => {
  const original = {
    id: 'ent_1', name: 'Miete', categoryId: 'a', direction: 'expense', active: true,
    startDate: '2026-01-01', endDate: null,
    rule: { type: 'monthly', dayOfMonth: 1, skipMonths: [12] },
    amounts: [{ from: null, value: 950 }],
  };
  const copy = duplicateEntry(original, [original]);
  assert.notEqual(copy.id, original.id);
  assert.equal(copy.name, 'Miete (Kopie)');
  assert.deepEqual(copy.rule, original.rule);

  copy.rule.skipMonths.push(1);
  copy.amounts[0].value = 1;
  assert.deepEqual(original.rule.skipMonths, [12], 'das Original bleibt unberührt');
  assert.equal(original.amounts[0].value, 950);
});

test('Kopien bekommen eindeutige Namen', () => {
  const entries = [{ name: 'Miete' }];
  const first = duplicateEntry({ name: 'Miete' }, entries);
  entries.push(first);
  const second = duplicateEntry({ name: 'Miete' }, entries);
  entries.push(second);
  const third = duplicateEntry(second, entries);

  assert.deepEqual([first.name, second.name, third.name],
    ['Miete (Kopie)', 'Miete (Kopie 2)', 'Miete (Kopie 3)']);
  assert.equal(new Set(entries.map((e) => e.name)).size, entries.length);
});

test('copyNameFor stapelt keine Kopie-Suffixe', () => {
  assert.equal(copyNameFor('Miete (Kopie)', []), 'Miete (Kopie)');
  assert.equal(copyNameFor('Miete (Kopie 7)', []), 'Miete (Kopie)');
  assert.equal(copyNameFor('Miete', [{ name: 'Miete (Kopie)' }]), 'Miete (Kopie 2)');
  assert.equal(copyNameFor('Vertrag (alt)', []), 'Vertrag (alt) (Kopie)');
});
