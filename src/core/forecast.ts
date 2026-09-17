/**
 * Forecast: führt alle Einträge zu einer Transaktionsliste zusammen und
 * kumuliert daraus den Kontoverlauf.
 *
 * Pur und ohne DOM — dieselbe Datei läuft im Browser und unter node:test.
 */
import { expandRule } from './recurrence.ts';
import { signedAmountAt } from './amounts.ts';
import { maxDate, monthKey } from './dateUtils.ts';
import type {
  BalancePoint, CashflowDoc, Forecast, ISODate, MonthBucket, MonthKey, Transaction,
} from './types.ts';

/**
 * @param state vollständiges Dokument
 * @param from  Fensteranfang
 * @param to    Fensterende
 */
export function buildForecast(state: CashflowDoc, from: ISODate, to: ISODate): Forecast {
  const { account, entries = [] } = state;
  const windowFrom = maxDate(from, account.startDate) as ISODate;

  // Immer ab Kontostart rechnen, auch wenn das Fenster später beginnt:
  // sonst wäre der Startsaldo des Fensters falsch (Buchungen davor fehlten).
  const all: Transaction[] = [];
  for (const entry of entries) {
    if (entry.active === false) continue;
    const dates = expandRule(entry.rule, {
      startDate: maxDate(entry.startDate, account.startDate) as ISODate,
      endDate: entry.endDate ?? null,
      from: account.startDate,
      to,
    });
    for (const date of dates) {
      const amount = signedAmountAt(entry, date);
      if (amount === 0) continue;
      all.push({
        date,
        entryId: entry.id,
        name: entry.name,
        categoryId: entry.categoryId ?? null,
        direction: entry.direction,
        amount,
        balance: 0,
      });
    }
  }

  // stabil sortieren: nach Datum, bei Gleichstand Einnahmen vor Ausgaben
  all.sort((a, b) =>
    a.date.localeCompare(b.date) || b.amount - a.amount || a.name.localeCompare(b.name));

  // Saldo ab Kontostart kumulieren, dann auf das Anzeigefenster zuschneiden.
  let balance = round2(account.startBalance ?? 0);
  const transactions: Transaction[] = [];
  for (const tx of all) {
    balance = round2(balance + tx.amount);
    tx.balance = balance;
    if (tx.date >= windowFrom) transactions.push(tx);
  }

  const openingBalance = transactions.length
    ? round2(transactions[0].balance - transactions[0].amount)
    : balance;

  const balancePoints: BalancePoint[] = [{ date: windowFrom, balance: openingBalance }];
  for (const tx of transactions) balancePoints.push({ date: tx.date, balance: tx.balance });
  balancePoints.push({ date: to, balance });

  return {
    transactions,
    openingBalance,
    closingBalance: balance,
    balancePoints,
    from: windowFrom,
    to,
  };
}

/**
 * Monatsaggregation für die Grafik: Einnahmen, Ausgaben und Endsaldo je Monat,
 * zusätzlich die Summen je Kategorie (für gestapelte Balken).
 */
export function aggregateByMonth(forecast: Forecast): MonthBucket[] {
  // `endBalance` bleibt zunächst offen und wird unten aufgefüllt
  type OpenBucket = Omit<MonthBucket, 'endBalance'> & { endBalance: number | null };
  const months = new Map<MonthKey, OpenBucket>();
  const ensure = (key: MonthKey): OpenBucket => {
    if (!months.has(key)) {
      months.set(key, { month: key, income: 0, expense: 0, net: 0, endBalance: null, byCategory: {} });
    }
    return months.get(key)!;
  };

  // alle Monate des Fensters anlegen, damit die Grafik keine Lücken hat
  for (let m = monthKey(forecast.from); m <= monthKey(forecast.to); m = nextMonthKey(m)) {
    ensure(m);
  }
  ensure(monthKey(forecast.from)).endBalance = forecast.openingBalance;

  for (const tx of forecast.transactions) {
    const bucket = ensure(monthKey(tx.date));
    if (tx.amount >= 0) bucket.income = round2(bucket.income + tx.amount);
    else bucket.expense = round2(bucket.expense + Math.abs(tx.amount));
    bucket.net = round2(bucket.net + tx.amount);
    const key = tx.categoryId ?? '_none';
    bucket.byCategory[key] = round2((bucket.byCategory[key] ?? 0) + tx.amount);
    bucket.endBalance = tx.balance;
  }

  // Monate ohne Buchung erben den Saldo des Vormonats
  const sorted = [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
  let last = forecast.openingBalance;
  for (const bucket of sorted) {
    if (bucket.endBalance == null) bucket.endBalance = last;
    last = bucket.endBalance;
  }
  return sorted as MonthBucket[];
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** "2026-12" -> "2027-01" */
function nextMonthKey(key: MonthKey): MonthKey {
  const [year, month] = key.split('-').map(Number);
  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, '0')}`;
}
