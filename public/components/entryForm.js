/**
 * Dialog zum Anlegen/Bearbeiten eines Eintrags.
 *
 * Arbeitet auf einer Kopie (`draft`); erst "Speichern" schreibt zurück.
 * Die Regelfelder werden je nach Regeltyp neu aufgebaut, die Betragsphasen
 * sind eine beliebig lange Liste "ab Datum : Betrag".
 */
import { createEntry } from '../../src/core/model.js';
import { flattenTree } from '../../src/core/categories.js';
import { describeRule } from '../../src/core/recurrence.js';
import { sortPhases } from '../../src/core/amounts.js';
import { today } from '../../src/core/dateUtils.js';
import { escapeHtml } from './format.js';

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const RULE_TYPES = [
  ['monthly', 'monatlich / alle N Monate'],
  ['weekly', 'wöchentlich / alle N Wochen'],
  ['quarterly', 'quartalsweise'],
  ['yearly', 'jährlich'],
  ['everyNDays', 'alle N Tage'],
  ['once', 'einmalig'],
];

/**
 * Öffnet den Dialog.
 * @param {object|null} entry  vorhandener Eintrag oder null für "neu"
 * @param {object} ctx         App-Kontext
 */
export function openEntryDialog(entry, ctx) {
  const dialog = document.getElementById('entry-dialog');
  const isNew = !entry;
  const draft = structuredClone(entry ?? createEntry({ startDate: today() }));
  draft.rule = { skipMonths: [], skipDates: [], ...draft.rule };

  function renderDialog() {
    dialog.innerHTML = `
      <form method="dialog">
        <div class="dialog-body">
          <h2>${isNew ? 'Neuer Eintrag' : 'Eintrag bearbeiten'}</h2>

          <div class="row">
            <div class="field"><label>Bezeichnung</label><input id="f-name" value="${escapeHtml(draft.name)}" style="width:220px"></div>
            <div class="field">
              <label>Art</label>
              <select id="f-direction">
                <option value="expense" ${draft.direction === 'expense' ? 'selected' : ''}>Ausgabe</option>
                <option value="income" ${draft.direction === 'income' ? 'selected' : ''}>Einnahme</option>
              </select>
            </div>
            <div class="field">
              <label>Kategorie</label>
              <select id="f-category">
                <option value="">— ohne —</option>
                ${flattenTree(ctx.state.categories).map(({ category, depth }) =>
                  `<option value="${category.id}" ${draft.categoryId === category.id ? 'selected' : ''}>${'\u00a0\u00a0'.repeat(depth)}${escapeHtml(category.name)}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>Aktiv</label>
              <input type="checkbox" id="f-active" ${draft.active !== false ? 'checked' : ''}>
            </div>
          </div>

          <div class="row">
            <div class="field"><label>Läuft ab</label><input id="f-start" type="date" value="${draft.startDate}"></div>
            <div class="field"><label>Läuft bis (optional)</label><input id="f-end" type="date" value="${draft.endDate ?? ''}"></div>
          </div>

          <h2>Wiederholung</h2>
          <div class="row">
            <div class="field">
              <label>Intervall</label>
              <select id="f-ruletype">
                ${RULE_TYPES.map(([value, label]) =>
                  `<option value="${value}" ${draft.rule.type === value ? 'selected' : ''}>${label}</option>`).join('')}
              </select>
            </div>
            <div class="rule-fields" id="rule-fields">${ruleFields(draft.rule)}</div>
          </div>
          <p class="hint">Ergibt: <strong id="rule-preview">${escapeHtml(describeRule(draft.rule))}</strong></p>

          <div class="row">
            <div class="field" style="flex:1">
              <label>Monate ohne Buchung (z. B. „monatlich außer Dezember“)</label>
              <div id="skip-months" class="month-toggles">
                ${MONTHS.map((name, i) => `
                  <label>
                    <input type="checkbox" data-month="${i + 1}" ${draft.rule.skipMonths?.includes(i + 1) ? 'checked' : ''}>${name.slice(0, 3)}
                  </label>`).join('')}
              </div>
            </div>
          </div>

          <h2>Beträge</h2>
          <p class="hint">Ein Betrag gilt ab seinem Datum bis zum nächsten. Die erste Zeile ohne Datum gilt von Anfang an.</p>
          <div id="phases">${phaseRows(draft.amounts)}</div>
          <button type="button" class="action" id="btn-add-phase">+ Betragsänderung</button>

          <div class="row" style="margin-top:12px">
            <div class="field" style="flex:1"><label>Notiz</label><input id="f-note" value="${escapeHtml(draft.note ?? '')}" style="width:100%"></div>
          </div>
          <p id="form-error" class="warn"></p>
        </div>
        <div class="dialog-foot">
          ${isNew ? '' : '<button type="button" class="action danger" id="btn-delete">Löschen</button>'}
          <button type="button" class="action" id="btn-cancel">Abbrechen</button>
          <button type="button" class="action primary" id="btn-save">Speichern</button>
        </div>
      </form>
    `;
    wire();
  }

  /** Nur die typabhängigen Regelfelder. */
  function ruleFields(rule) {
    const dayOptions = (selected) => [
      ...Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${selected === i + 1 ? 'selected' : ''}>${i + 1}.</option>`),
      `<option value="-1" ${selected === -1 ? 'selected' : ''}>Monatsletzter</option>`,
    ].join('');

    switch (rule.type) {
      case 'monthly':
        return `
          <div class="field"><label>Tag im Monat</label><select data-rule="dayOfMonth">${dayOptions(rule.dayOfMonth ?? 1)}</select></div>
          <div class="field"><label>alle … Monate</label><input type="number" min="1" max="24" data-rule="interval" value="${rule.interval ?? 1}" style="width:80px"></div>`;
      case 'weekly':
        return `
          <div class="field"><label>Wochentag</label><select data-rule="weekday">
            ${WEEKDAYS.map((name, i) => `<option value="${i}" ${(rule.weekday ?? 1) === i ? 'selected' : ''}>${name}</option>`).join('')}
          </select></div>
          <div class="field"><label>alle … Wochen</label><input type="number" min="1" max="52" data-rule="interval" value="${rule.interval ?? 1}" style="width:80px"></div>`;
      case 'quarterly':
        return `
          <div class="field"><label>Monat im Quartal</label><select data-rule="monthOffset">
            ${[1, 2, 3].map((n) => `<option value="${n - 1}" ${(rule.monthOffset ?? 0) === n - 1 ? 'selected' : ''}>${n}. Monat</option>`).join('')}
          </select></div>
          <div class="field"><label>Tag im Monat</label><select data-rule="dayOfMonth">${dayOptions(rule.dayOfMonth ?? 1)}</select></div>`;
      case 'yearly':
        return `
          <div class="field"><label>Monat</label><select data-rule="month">
            ${MONTHS.map((name, i) => `<option value="${i + 1}" ${(rule.month ?? 1) === i + 1 ? 'selected' : ''}>${name}</option>`).join('')}
          </select></div>
          <div class="field"><label>Tag</label><select data-rule="dayOfMonth">${dayOptions(rule.dayOfMonth ?? 1)}</select></div>`;
      case 'everyNDays':
        return `
          <div class="field"><label>alle … Tage</label><input type="number" min="1" data-rule="n" value="${rule.n ?? 30}" style="width:90px"></div>
          <div class="field"><label>erster Termin</label><input type="date" data-rule="anchor" value="${rule.anchor ?? draft.startDate}"></div>`;
      case 'once':
        return `<div class="field"><label>Datum</label><input type="date" data-rule="date" value="${rule.date ?? draft.startDate}"></div>`;
      default:
        return '';
    }
  }

  function phaseRows(amounts) {
    return sortPhases(amounts).map((phase, index) => `
      <div class="phase-row" data-index="${index}">
        <label style="margin:0">ab</label>
        <input type="date" data-phase="from" value="${phase.from ?? ''}" ${index === 0 ? 'placeholder="von Anfang an"' : ''}>
        <input type="number" step="0.01" data-phase="value" value="${phase.value}" style="width:120px"> €
        ${amounts.length > 1 ? '<button type="button" class="link" data-remove-phase>entfernen</button>' : ''}
        ${index === 0 && !phase.from ? '<span class="hint">gilt von Anfang an</span>' : ''}
      </div>`).join('');
  }

  function collectPhases() {
    return [...dialog.querySelectorAll('.phase-row')].map((row) => ({
      from: row.querySelector('[data-phase="from"]').value || null,
      value: Number(row.querySelector('[data-phase="value"]').value) || 0,
    }));
  }

  function syncFromForm() {
    draft.name = dialog.querySelector('#f-name').value.trim();
    draft.direction = dialog.querySelector('#f-direction').value;
    draft.categoryId = dialog.querySelector('#f-category').value || null;
    draft.active = dialog.querySelector('#f-active').checked;
    draft.startDate = dialog.querySelector('#f-start').value;
    draft.endDate = dialog.querySelector('#f-end').value || null;
    draft.note = dialog.querySelector('#f-note').value;
    draft.amounts = sortPhases(collectPhases());
    draft.rule.skipMonths = [...dialog.querySelectorAll('#skip-months input:checked')]
      .map((box) => Number(box.dataset.month));
    for (const input of dialog.querySelectorAll('[data-rule]')) {
      const key = input.dataset.rule;
      draft.rule[key] = input.type === 'number' || ['dayOfMonth', 'interval', 'weekday', 'month', 'monthOffset', 'n'].includes(key)
        ? Number(input.value)
        : input.value;
    }
  }

  function wire() {
    // Alles am <form> aufhängen, nicht am Dialog: der Dialog bleibt über alle
    // Renderdurchläufe hinweg bestehen, das Formular wird jedes Mal ersetzt.
    // Sonst sammeln sich mit jedem Öffnen weitere Zuhörer auf altem draft an.
    const form = dialog.querySelector('form');

    dialog.querySelector('#f-ruletype').addEventListener('change', (event) => {
      syncFromForm();
      draft.rule = { type: event.target.value, skipMonths: draft.rule.skipMonths, skipDates: draft.rule.skipDates ?? [] };
      renderDialog();
    });

    form.addEventListener('change', () => {
      syncFromForm();
      dialog.querySelector('#rule-preview').textContent = describeRule(draft.rule);
    });

    dialog.querySelector('#btn-add-phase').addEventListener('click', () => {
      syncFromForm();
      draft.amounts = [...draft.amounts, { from: today(), value: draft.amounts.at(-1)?.value ?? 0 }];
      renderDialog();
    });

    dialog.querySelector('#phases').addEventListener('click', (event) => {
      if (!event.target.hasAttribute('data-remove-phase')) return;
      syncFromForm();
      const index = Number(event.target.closest('.phase-row').dataset.index);
      draft.amounts = draft.amounts.filter((_, i) => i !== index);
      renderDialog();
    });

    dialog.querySelector('#btn-cancel').addEventListener('click', () => dialog.close());

    dialog.querySelector('#btn-delete')?.addEventListener('click', () => {
      if (!confirm(`„${draft.name}“ wirklich löschen?`)) return;
      ctx.actions.update((state) => {
        state.entries = state.entries.filter((e) => e.id !== draft.id);
      });
      dialog.close();
    });

    dialog.querySelector('#btn-save').addEventListener('click', () => {
      syncFromForm();
      const error = validate(draft);
      if (error) {
        dialog.querySelector('#form-error').textContent = error;
        return;
      }
      ctx.actions.update((state) => {
        const index = state.entries.findIndex((e) => e.id === draft.id);
        if (index >= 0) state.entries[index] = draft;
        else state.entries.push(draft);
      });
      dialog.close();
    });
  }

  renderDialog();
  dialog.showModal();
}

/** @returns {string|null} Fehlermeldung oder null */
function validate(draft) {
  if (!draft.name) return 'Bitte eine Bezeichnung angeben.';
  if (!draft.startDate) return 'Bitte ein Startdatum angeben.';
  if (draft.endDate && draft.endDate < draft.startDate) return 'Das Enddatum liegt vor dem Startdatum.';
  if (!draft.amounts.length) return 'Mindestens ein Betrag ist nötig.';
  const dates = draft.amounts.map((p) => p.from).filter(Boolean);
  if (new Set(dates).size !== dates.length) return 'Zwei Betragsphasen haben dasselbe Startdatum.';
  if (draft.rule.type === 'once' && !draft.rule.date) return 'Bitte ein Datum für die einmalige Buchung angeben.';
  return null;
}
