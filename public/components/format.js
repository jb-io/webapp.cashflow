/** Kleine Formatierungs- und DOM-Helfer für alle Ansichten. */
import { formatDE } from '../../src/core/dateUtils.js';

const currency = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export const money = (value) => currency.format(value ?? 0);
export const date = (iso) => (iso ? formatDE(iso) : '–');

/** Betrag mit Vorzeichenfarbe als HTML-Zelle. */
export function moneyCell(value) {
  const cls = value < 0 ? 'amount-negative' : value > 0 ? 'amount-positive' : '';
  return `<span class="${cls}">${money(value)}</span>`;
}

export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Farbpunkt + Name einer Kategorie (oder "ohne Kategorie"). */
export function categoryChip(category) {
  if (!category) return '<span class="chip hint">ohne Kategorie</span>';
  return `<span class="chip"><span class="dot" style="background:${escapeHtml(category.color)}"></span>${escapeHtml(category.name)}</span>`;
}

export const MONTH_LABELS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

/** "2026-03" -> "Mär 2026" */
export function monthLabel(key) {
  const [year, month] = key.split('-');
  return `${MONTH_LABELS[Number(month) - 1]} ${year}`;
}
