/**
 * Kennzahlen zum Kontoverlauf: Minimum/Maximum mit Datum, Zugewinn/Verlust
 * im Zeitraum und die Aufteilung nach Kategorie.
 */
import { round2 } from './forecast.ts';
import type { CategoryTotals, Forecast, Stats } from './types.ts';

export function computeStats(forecast: Forecast): Stats {
  let min = forecast.balancePoints[0];
  let max = forecast.balancePoints[0];
  let belowZero: Stats['belowZero'] = null;

  for (const point of forecast.balancePoints) {
    // strikt kleiner/größer: bei Gleichstand gewinnt der frühere Termin
    if (point.balance < min.balance) min = point;
    if (point.balance > max.balance) max = point;
    if (belowZero == null && point.balance < 0) belowZero = point;
  }

  let totalIncome = 0;
  let totalExpense = 0;
  const categories = new Map<string | null, CategoryTotals>();

  for (const tx of forecast.transactions) {
    if (tx.amount >= 0) totalIncome = round2(totalIncome + tx.amount);
    else totalExpense = round2(totalExpense + Math.abs(tx.amount));

    const key = tx.categoryId ?? null;
    if (!categories.has(key)) categories.set(key, { categoryId: key, income: 0, expense: 0, net: 0 });
    const bucket = categories.get(key)!;
    if (tx.amount >= 0) bucket.income = round2(bucket.income + tx.amount);
    else bucket.expense = round2(bucket.expense + Math.abs(tx.amount));
    bucket.net = round2(bucket.net + tx.amount);
  }

  return {
    min: { ...min },
    max: { ...max },
    opening: forecast.openingBalance,
    closing: forecast.closingBalance,
    delta: round2(forecast.closingBalance - forecast.openingBalance),
    totalIncome,
    totalExpense,
    byCategory: [...categories.values()].sort((a, b) => a.net - b.net),
    belowZero,
  };
}
