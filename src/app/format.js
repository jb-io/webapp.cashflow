/** Anzeigehilfen — Beträge, Daten, Kategoriefarben. */
import { formatDE, formatMonthDE } from '../core/dateUtils.js';

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const eurShort = new Intl.NumberFormat('de-DE', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
});

export const money = (value) => eur.format(value ?? 0);
export const moneyShort = (value) => eurShort.format(value ?? 0);

/** Mit führendem Pluszeichen, damit Einnahmen auch ohne Farbe erkennbar sind. */
export const moneySigned = (value) => (value > 0 ? `+${eur.format(value)}` : eur.format(value ?? 0));

export const day = (iso) => (iso ? formatDE(iso) : '–');
export const month = (key) => formatMonthDE(key);

/** "2026-03" -> "Mär 26" für enge Achsen. */
export const monthTick = (key) => {
  const [year, m] = key.split('-');
  return `${['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'][Number(m) - 1]} ${year.slice(2)}`;
};

export const signClass = (value) => (value < 0 ? 'neg' : value > 0 ? 'pos' : 'muted');

export const NO_CATEGORY_COLOR = '#8695ab';
