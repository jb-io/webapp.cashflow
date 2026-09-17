/**
 * Fachliche Typen. Sie beschreiben genau das Dokument, das in localStorage
 * liegt und exportiert wird — Speicherformat und Typmodell sind dieselbe
 * Struktur, nicht zwei Sichten darauf.
 */

/** Datum als "YYYY-MM-DD". Im ganzen Projekt nie ein `Date`-Objekt. */
export type ISODate = string;

/** Monat als "YYYY-MM". */
export type MonthKey = string;

/** Einnahme oder Ausgabe; das Vorzeichen ergibt sich hieraus, nie aus `value`. */
export type Direction = 'income' | 'expense';

export type RuleType = 'monthly' | 'weekly' | 'quarterly' | 'yearly' | 'everyNDays' | 'once';

/**
 * Wiederholungsregel. Bewusst ein eigenes, flaches Format statt RRULE: nur so
 * lassen sich Ausnahmen wie „monatlich außer im Dezember" abbilden *und* in
 * einem Formular pflegen (Architecture.md, A5).
 *
 * Die typabhängigen Felder sind optional, weil jeder Regeltyp andere braucht;
 * `expandRule` setzt die jeweils passenden Vorgaben.
 */
export interface Rule {
  type: RuleType;
  /** 1–31 oder -1 für „Monatsletzter" (monthly, quarterly, yearly) */
  dayOfMonth?: number;
  /** Schrittweite in Monaten bzw. Wochen (monthly, weekly) */
  interval?: number;
  /** Monate 1–12, in denen die Buchung entfällt */
  skipMonths?: number[];
  /** einzelne Termine, die entfallen */
  skipDates?: ISODate[];
  /** 0 = Sonntag … 6 = Samstag (weekly) */
  weekday?: number;
  /** 0–2, Position im Quartal (quarterly) */
  monthOffset?: number;
  /** 1–12 (yearly) */
  month?: number;
  /** Tagesabstand (everyNDays) */
  n?: number;
  /** Ankertermin (everyNDays) */
  anchor?: ISODate;
  /** Termin (once) */
  date?: ISODate;
}

/**
 * Eine Betragsstufe. `from: null` heißt „gilt von Anfang an"; eine Stufe gilt
 * bis zum Beginn der nächsten. `value` wird immer positiv gepflegt.
 */
export interface AmountPhase {
  from: ISODate | null;
  value: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  /** null = oberste Ebene; die Liste bleibt flach, der Baum wird berechnet. */
  parentId: string | null;
}

export interface Entry {
  id: string;
  name: string;
  /** immer genau eine Kategorie, nie mehrere; null = ohne */
  categoryId: string | null;
  direction: Direction;
  note: string;
  active: boolean;
  startDate: ISODate;
  /** null = unbefristet */
  endDate: ISODate | null;
  rule: Rule;
  amounts: AmountPhase[];
}

export interface Account {
  name: string;
  startBalance: number;
  startDate: ISODate;
}

/** Zeitraum einer Sicht — immer ganze Monate, beide Grenzen inklusive. */
export interface MonthRange {
  from: MonthKey;
  to: MonthKey;
}

export interface Settings {
  view: MonthRange;
}

/** Das gesamte Dokument: Zustand, localStorage-Inhalt und Exportformat. */
export interface CashflowDoc {
  version: number;
  account: Account;
  settings: Settings;
  categories: Category[];
  entries: Entry[];
}

/** Eine einzelne Buchung im berechneten Verlauf. */
export interface Transaction {
  date: ISODate;
  entryId: string;
  name: string;
  categoryId: string | null;
  direction: Direction;
  /** vorzeichenbehaftet: Ausgaben negativ */
  amount: number;
  /** Saldo nach dieser Buchung */
  balance: number;
}

export interface BalancePoint {
  date: ISODate;
  balance: number;
}

export interface Forecast {
  transactions: Transaction[];
  openingBalance: number;
  closingBalance: number;
  balancePoints: BalancePoint[];
  /** tatsächlicher Fensteranfang (nie vor dem Kontostart) */
  from: ISODate;
  to: ISODate;
}

export interface MonthBucket {
  month: MonthKey;
  income: number;
  expense: number;
  net: number;
  endBalance: number;
  /** Summen je Kategorie; "_none" steht für „ohne Kategorie" */
  byCategory: Record<string, number>;
}

export interface CategoryTotals {
  categoryId: string | null;
  income: number;
  expense: number;
  net: number;
}

export interface Stats {
  min: BalancePoint;
  max: BalancePoint;
  opening: number;
  closing: number;
  /** Endsaldo minus Startsaldo des Fensters */
  delta: number;
  totalIncome: number;
  totalExpense: number;
  byCategory: CategoryTotals[];
  /** erster Zeitpunkt im Minus, sonst null */
  belowZero: BalancePoint | null;
}

/** Ein Knoten der flachen Baumdarstellung. */
export interface TreeNode {
  category: Category;
  depth: number;
}
