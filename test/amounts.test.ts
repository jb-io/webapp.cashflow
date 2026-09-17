import test from 'node:test';
import assert from 'node:assert/strict';
import { amountAt, signedAmountAt, setAmountAt } from '../src/core/amounts.ts';
import type { AmountPhase, Direction } from '../src/core/types.ts';

/** So viel von einem Eintrag, wie die Betragsfunktionen brauchen. */
type Phased = { direction: Direction; amounts: AmountPhase[] };

const entry: Phased = {
  direction: 'expense',
  amounts: [
    { from: null, value: 820 },
    { from: '2027-01-01', value: 890 },
    { from: '2028-06-15', value: 940 },
  ],
};

test('Phase gilt ab ihrem Datum, exakt am Grenztag', () => {
  assert.equal(amountAt(entry, '2026-12-31'), 820);
  assert.equal(amountAt(entry, '2027-01-01'), 890);
  assert.equal(amountAt(entry, '2028-06-14'), 890);
  assert.equal(amountAt(entry, '2028-06-15'), 940);
});

test('unsortierte Phasen werden korrekt ausgewertet', () => {
  const unsorted: Phased = { direction: 'income', amounts: [{ from: '2027-01-01', value: 2 }, { from: null, value: 1 }] };
  assert.equal(amountAt(unsorted, '2026-05-01'), 1);
  assert.equal(amountAt(unsorted, '2027-05-01'), 2);
});

test('vor der ersten Phase gilt 0', () => {
  const later: Phased = { direction: 'income', amounts: [{ from: '2027-01-01', value: 500 }] };
  assert.equal(amountAt(later, '2026-12-31'), 0);
  assert.equal(amountAt(later, '2027-01-01'), 500);
});

test('Vorzeichen kommt aus der Richtung, nicht aus dem gepflegten Wert', () => {
  assert.equal(signedAmountAt(entry, '2026-01-01'), -820);
  assert.equal(signedAmountAt({ ...entry, direction: 'income' }, '2026-01-01'), 820);
  const negativeGepflegt: Phased = { direction: 'expense', amounts: [{ from: null, value: -50 }] };
  assert.equal(signedAmountAt(negativeGepflegt, '2026-01-01'), -50);
});

test('setAmountAt ändert genau die heute gültige Phase', () => {
  const phased: Phased = { direction: 'expense', amounts: [
    { from: null, value: 820 },
    { from: '2027-01-01', value: 890 },
    { from: '2028-06-15', value: 940 },
  ] };

  assert.deepEqual(setAmountAt(phased, '2026-05-01', 800),
    [{ from: null, value: 800 }, { from: '2027-01-01', value: 890 }, { from: '2028-06-15', value: 940 }]);
  assert.deepEqual(setAmountAt(phased, '2027-06-01', 900),
    [{ from: null, value: 820 }, { from: '2027-01-01', value: 900 }, { from: '2028-06-15', value: 940 }]);
  assert.deepEqual(setAmountAt(phased, '2029-01-01', 1000).at(-1), { from: '2028-06-15', value: 1000 });
});

test('setAmountAt normalisiert das Vorzeichen und lässt das Original unberührt', () => {
  const entry: Phased = { direction: 'expense', amounts: [{ from: null, value: 100 }] };
  assert.deepEqual(setAmountAt(entry, '2026-01-01', -250), [{ from: null, value: 250 }]);
  assert.equal(entry.amounts[0].value, 100);
});

test('setAmountAt vor der ersten Phase ändert die früheste', () => {
  const entry: Phased = { direction: 'income', amounts: [{ from: '2027-01-01', value: 500 }] };
  assert.deepEqual(setAmountAt(entry, '2026-01-01', 600), [{ from: '2027-01-01', value: 600 }]);
});

test('setAmountAt auf einem Eintrag ohne Phasen legt eine an', () => {
  const ohnePhasen: Phased = { direction: 'expense', amounts: [] };
  assert.deepEqual(setAmountAt(ohnePhasen, '2026-01-01', 42), [{ from: null, value: 42 }]);
});
