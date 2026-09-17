/**
 * Zeitraum-Auswahl für alle Sichten — bewusst monatsgenau: Von/Bis sind
 * Monate, nie Tage. Der Zeitraum liegt im Dokument (`settings.view`) und gilt
 * daher für alle Tabs gleichzeitig und über einen Reload hinweg.
 *
 * `viewRangeHtml()` rendert, `wireViewRange()` hängt die Ereignisse an —
 * getrennt, damit der Aufrufer die Auswahl an beliebiger Stelle einsetzen kann.
 */
import { viewFromMonths, currentYearView } from '../../src/core/model.js';
import { monthKey, today } from '../../src/core/dateUtils.js';

/** Schnellwahl-Knöpfe: Beschriftung + wie sich daraus der Zeitraum ergibt. */
const PRESETS = [
  { key: 'thisYear', label: 'aktuelles Jahr', build: () => currentYearView() },
  { key: 'nextYear', label: 'nächstes Jahr', build: () => yearOf(Number(today().slice(0, 4)) + 1) },
  { key: 'm12', label: '12 Monate', build: () => viewFromMonths(today(), 12) },
  { key: 'm24', label: '24 Monate', build: () => viewFromMonths(today(), 24) },
  { key: 'm60', label: '5 Jahre', build: () => viewFromMonths(today(), 60) },
];

const yearOf = (year) => ({ from: `${year}-01`, to: `${year}-12` });

/** Ist der aktuelle Zeitraum genau dieser Vorgabe? */
const matches = (view, preset) => {
  const target = preset.build();
  return target.from === view.from && target.to === view.to;
};

export function viewRangeHtml(ctx) {
  const { view } = ctx;
  return `
    <div class="row view-range" style="margin-bottom:0">
      <div class="field"><label>Von (Monat)</label><input type="month" data-view="from" value="${view.from}"></div>
      <div class="field"><label>Bis (Monat)</label><input type="month" data-view="to" value="${view.to}"></div>
      <div class="field">
        <label>Schnellwahl</label>
        <div class="preset-row">
          <button class="action" data-view-step="-12" title="ein Jahr zurück">&laquo;</button>
          ${PRESETS.map((preset) =>
            `<button class="action ${matches(view, preset) ? 'primary' : ''}" data-view-preset="${preset.key}">${preset.label}</button>`).join('')}
          <button class="action" data-view-step="12" title="ein Jahr vor">&raquo;</button>
        </div>
      </div>
    </div>`;
}

export function wireViewRange(root, ctx) {
  const container = root.querySelector('.view-range');
  if (!container) return;

  container.addEventListener('change', (event) => {
    const field = event.target.dataset.view;
    if (!field || !event.target.value) return;
    ctx.actions.setView({ ...ctx.view, [field]: event.target.value });
  });

  container.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    if (button.dataset.viewPreset) {
      const preset = PRESETS.find((p) => p.key === button.dataset.viewPreset);
      if (preset) ctx.actions.setView(preset.build());
      return;
    }
    if (button.dataset.viewStep) {
      // Zeitraum in seiner Länge verschieben, statt ihn zu dehnen
      const step = Number(button.dataset.viewStep);
      ctx.actions.setView({
        from: shift(ctx.view.from, step),
        to: shift(ctx.view.to, step),
      });
    }
  });
}

function shift(key, months) {
  const [year, month] = key.split('-').map(Number);
  const index = year * 12 + (month - 1) + months;
  return monthKey(`${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`);
}
