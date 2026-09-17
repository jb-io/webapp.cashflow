/**
 * Tab "Einnahmen & Ausgaben" — Token-Liste.
 *
 * Die Zeile ist im Normalzustand reiner Text in einem festen Raster mit
 * weglassbaren Zellen: der Betrag steht immer rechtsbündig an derselben
 * Stelle, "außer Dez" erscheint nur dort, wo es die Ausnahme gibt. Jede
 * veränderliche Eigenschaft ist ein **Token**; ein Klick öffnet ein Popover
 * mit genau diesem Aspekt (Architecture.md, A20).
 *
 * Damit liegt der Fokus beim Bearbeiten nie in der Liste, sondern im Popover
 * am `<body>` — die Liste darf frei neu rendern. Einzige Ausnahme ist das
 * Umbenennen, das an Ort und Stelle passiert und deshalb weiter über
 * `updateInline` läuft (A16).
 */
import { describeRuleParts } from '../../src/core/recurrence.js';
import { amountAt, sortPhases } from '../../src/core/amounts.js';
import { duplicateEntry } from '../../src/core/model.js';
import { flattenTree, pathOf } from '../../src/core/categories.js';
import { today } from '../../src/core/dateUtils.js';
import { escapeHtml, money, date as fmtDate } from './format.js';
import { openEntryDialog } from './entryForm.js';
import { openPopover, closePopover, isPopoverOpen } from './popover.js';

/** Ausgewählte Zeile; überlebt das Neurendern des Tabs. */
let selectedId = null;

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const RULE_TYPES = [
  ['monthly', 'Monat'], ['weekly', 'Woche'], ['quarterly', 'Quartal'],
  ['yearly', 'Jahr'], ['everyNDays', 'N Tage'], ['once', 'einmalig'],
];

export function renderEntriesTab(root, ctx) {
  const { entries, categories } = ctx.state;
  const now = today();

  const rows = entries.map((entry) => {
    const parts = describeRuleParts(entry.rule);
    const phases = sortPhases(entry.amounts ?? []).length;
    const signed = entry.direction === 'expense' ? -amountAt(entry, now) : amountAt(entry, now);
    const category = categories.find((c) => c.id === entry.categoryId);

    return `
      <div class="entry-row ${entry.id === selectedId ? 'selected' : ''} ${entry.active === false ? 'inactive' : ''}"
           data-id="${entry.id}" tabindex="0">
        <button class="tok tok-name" data-token="name" title="Umbenennen">${escapeHtml(entry.name)}</button>

        <button class="tok tok-amount ${signed < 0 ? 'amount-negative' : 'amount-positive'}"
                data-token="amount" title="Betrag und Art ändern">
          ${signed > 0 ? '+' : ''}${money(signed)}${phases > 1 ? `<sup class="tok-badge">${phases}</sup>` : ''}
        </button>

        <button class="tok tok-rule" data-token="rule" title="Rhythmus und Ausnahmen ändern">
          ${escapeHtml(parts.rhythmShort)}${parts.exceptionsShort
            ? `<span class="tok-sub"> · ${escapeHtml(parts.exceptionsShort)}</span>` : ''}
        </button>

        <button class="tok tok-category ${category ? '' : 'tok-empty'}" data-token="category"
                title="${category ? escapeHtml(pathOf(categories, category.id)) : 'ohne Kategorie'} — ändern">
          ${category
            ? `<span class="dot" style="background:${escapeHtml(category.color)}"></span>${escapeHtml(pathOf(categories, category.id))}`
            : 'ohne Kategorie'}
        </button>

        <span class="row-actions">
          <button class="icon" data-action="active" title="${entry.active === false ? 'Aktivieren' : 'Stilllegen'}">${entry.active === false ? '○' : '●'}</button>
          <button class="icon" data-action="duplicate" title="Duplizieren">⧉</button>
          <button class="icon" data-action="more" title="Alle Felder: Laufzeit, Notiz, Löschen">⋯</button>
        </span>

        ${entry.id === selectedId ? `
          <div class="entry-meta">
            ${escapeHtml(entry.direction === 'income' ? 'Einnahme' : 'Ausgabe')}
            · ${escapeHtml(parts.rhythm)}${parts.exceptions ? `, ${escapeHtml(parts.exceptions)}` : ''}
            · ab ${fmtDate(entry.startDate)}${entry.endDate ? ` bis ${fmtDate(entry.endDate)}` : ', unbefristet'}
            ${entry.note ? ` · ${escapeHtml(entry.note)}` : ''}
          </div>` : ''}
      </div>`;
  }).join('');

  root.innerHTML = `
    <div class="panel">
      <div class="row" style="justify-content:space-between">
        <h2 style="margin:0">Einnahmen &amp; Ausgaben</h2>
        <button class="action primary" id="btn-new-entry">+ Neuer Eintrag</button>
      </div>
      ${entries.length ? `
        <p class="hint">Jede Angabe ist anklickbar und lässt sich direkt ändern. Pfeiltasten bewegen sich durch Zeilen und Angaben, Enter öffnet, Esc schließt.</p>
        <div class="entry-list">${rows}</div>`
      : '<p class="empty">Noch keine Einträge. Über „Neuer Eintrag“ anlegen oder im Tab „Konto &amp; Daten“ die Beispieldaten laden.</p>'}
    </div>
  `;

  root.querySelector('#btn-new-entry').addEventListener('click', () => {
    closePopover();
    openEntryDialog(null, ctx);
  });

  const list = root.querySelector('.entry-list');
  if (list) {
    list.addEventListener('click', (event) => onClick(event, ctx));
    list.addEventListener('keydown', (event) => onKeydown(event, list));
  }
}

/** Nach dem Neurendern der Liste: Auswahl wieder in den Blick holen. */
function focusRow(list, row) {
  if (!row) return;
  row.focus();
  row.scrollIntoView({ block: 'nearest' });
}

function onClick(event, ctx) {
  const row = event.target.closest('.entry-row');
  if (!row) return;
  const id = row.dataset.id;
  const entry = ctx.state.entries.find((e) => e.id === id);
  if (!entry) return;

  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action) { runAction(action, entry, ctx); return; }

  const token = event.target.closest('[data-token]')?.dataset.token;
  select(id, ctx);
  if (token) openTokenEditor(token, entry, ctx);
}

function select(id, ctx) {
  if (selectedId === id) return;
  selectedId = id;
  closePopover();
  ctx.actions.render();
}

function runAction(action, entry, ctx) {
  closePopover();
  switch (action) {
    case 'active':
      ctx.actions.update((state) => {
        const found = state.entries.find((e) => e.id === entry.id);
        if (found) found.active = found.active === false;
      });
      break;
    case 'duplicate':
      ctx.actions.update((state) => {
        const index = state.entries.findIndex((e) => e.id === entry.id);
        if (index < 0) return;
        state.entries.splice(index + 1, 0, duplicateEntry(state.entries[index], state.entries));
      });
      break;
    case 'more':
      openEntryDialog(entry, ctx);
      break;
  }
}

/* ------------------------------------------------------------------ Tastatur */

function onKeydown(event, list) {
  const row = event.target.closest('.entry-row');
  if (!row) return;
  const rows = [...list.querySelectorAll('.entry-row')];
  const tokens = [...row.querySelectorAll('.tok')];
  const inToken = event.target.classList.contains('tok');

  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp': {
      event.preventDefault();
      const next = rows[rows.indexOf(row) + (event.key === 'ArrowDown' ? 1 : -1)];
      focusRow(list, next);
      break;
    }
    case 'ArrowRight':
    case 'ArrowLeft': {
      event.preventDefault();
      const at = inToken ? tokens.indexOf(event.target) : -1;
      const step = event.key === 'ArrowRight' ? 1 : -1;
      const target = tokens[Math.max(0, Math.min(tokens.length - 1, at + step))];
      target?.focus();
      break;
    }
    case 'Enter':
    case ' ':
      // ausdrücklich statt über die native Schaltflächen-Aktivierung: so
      // verhält sich der Zeilenfokus (kein Token gewählt) genauso wie ein
      // gewähltes Token, und die Leertaste scrollt nicht die Seite.
      event.preventDefault();
      if (inToken) event.target.click();
      else { tokens[0]?.focus(); tokens[0]?.click(); }
      break;
  }
}

/* ------------------------------------------------------- Token-Editoren */

function openTokenEditor(token, entry, ctx) {
  if (token === 'name') { editNameInPlace(entry, ctx); return; }

  const key = `${entry.id}:${token}`;
  if (isPopoverOpen(key)) { closePopover(); return; }

  const anchorSelector = `.entry-row[data-id="${entry.id}"] [data-token="${token}"]`;
  const renderers = { amount: renderAmountEditor, rule: renderRuleEditor, category: renderCategoryEditor };

  openPopover({
    key,
    anchorSelector,
    render: (body, api) => renderers[token](body, api, entry.id, ctx),
  });
}

/**
 * Umbenennen an Ort und Stelle. Einziges Eingabefeld innerhalb der Liste —
 * es schreibt deshalb über `updateInline` und tauscht sich danach selbst
 * gegen den Text zurück, ohne die Liste neu zu bauen.
 */
function editNameInPlace(entry, ctx) {
  closePopover();
  const button = document.querySelector(`.entry-row[data-id="${entry.id}"] [data-token="name"]`);
  if (!button) return;

  const input = document.createElement('input');
  input.className = 'tok-input';
  input.value = entry.name;
  button.replaceWith(input);
  input.focus();
  input.select();

  let done = false;
  const finish = (commit) => {
    if (done) return;
    done = true;
    const name = input.value.trim();
    if (commit && name) {
      ctx.actions.updateInline((state) => {
        const found = state.entries.find((e) => e.id === entry.id);
        if (found) found.name = name;
      });
    }
    const replacement = document.createElement('button');
    replacement.className = 'tok tok-name';
    replacement.dataset.token = 'name';
    replacement.title = 'Umbenennen';
    replacement.textContent = commit && name ? name : entry.name;
    input.replaceWith(replacement);
  };

  input.addEventListener('change', () => finish(true));
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.stopPropagation(); finish(false); }
    if (event.key === 'Enter') finish(true);
  });
}

/** Betrag: Richtung und die komplette Phasenliste. */
function renderAmountEditor(body, api, entryId, ctx) {
  const entry = ctx.state.entries.find((e) => e.id === entryId);
  if (!entry) { api.close(); return; }
  const phases = sortPhases(entry.amounts ?? []);

  body.innerHTML = `
    <div class="pop-head">Betrag</div>
    <div class="segmented" data-role="direction">
      <button class="${entry.direction === 'expense' ? 'on' : ''}" data-direction="expense">Ausgabe</button>
      <button class="${entry.direction === 'income' ? 'on' : ''}" data-direction="income">Einnahme</button>
    </div>
    <div class="pop-rows">
      ${phases.map((phase, index) => `
        <div class="pop-row" data-index="${index}">
          <span class="pop-label">${phase.from ? 'ab' : 'ab Beginn'}</span>
          ${phase.from ? `<input type="date" data-phase="from" value="${phase.from}">` : ''}
          <input type="number" step="0.01" data-phase="value" value="${phase.value}" class="num-input"> €
          ${phases.length > 1 ? '<button class="icon" data-remove-phase title="Phase entfernen">✕</button>' : ''}
        </div>`).join('')}
    </div>
    <button class="action" data-add-phase>+ Betragsänderung</button>
    <p class="hint">Ein Betrag gilt ab seinem Datum bis zum nächsten.</p>
  `;

  const apply = (mutate) => ctx.actions.update((state) => {
    const found = state.entries.find((e) => e.id === entryId);
    if (found) mutate(found);
  });

  body.querySelector('[data-role="direction"]').addEventListener('click', (event) => {
    const direction = event.target.dataset.direction;
    if (!direction || direction === entry.direction) return;
    apply((found) => { found.direction = direction; });
    api.rebuild();
  });

  // Werte wirken sofort; die Liste rendert neu, das Popover bleibt stehen.
  body.querySelector('.pop-rows').addEventListener('change', (event) => {
    const field = event.target.dataset.phase;
    const index = Number(event.target.closest('.pop-row')?.dataset.index);
    if (!field || Number.isNaN(index)) return;
    apply((found) => {
      const list = sortPhases(found.amounts);
      if (field === 'value') list[index] = { ...list[index], value: Math.abs(Number(event.target.value) || 0) };
      else list[index] = { ...list[index], from: event.target.value || null };
      found.amounts = sortPhases(list);
    });
  });

  body.querySelector('.pop-rows').addEventListener('click', (event) => {
    if (!event.target.closest('[data-remove-phase]')) return;
    const index = Number(event.target.closest('.pop-row').dataset.index);
    apply((found) => { found.amounts = sortPhases(found.amounts).filter((_, i) => i !== index); });
    api.rebuild();
  });

  body.querySelector('[data-add-phase]').addEventListener('click', () => {
    apply((found) => {
      const list = sortPhases(found.amounts);
      found.amounts = sortPhases([...list, { from: today(), value: list.at(-1)?.value ?? 0 }]);
    });
    api.rebuild();
  });
}

/** Rhythmus: Typ, typabhängige Felder und die Ausnahmemonate. */
function renderRuleEditor(body, api, entryId, ctx) {
  const entry = ctx.state.entries.find((e) => e.id === entryId);
  if (!entry) { api.close(); return; }
  const rule = entry.rule;

  body.innerHTML = `
    <div class="pop-head">Rhythmus</div>
    <div class="segmented wrap" data-role="type">
      ${RULE_TYPES.map(([value, label]) =>
        `<button class="${rule.type === value ? 'on' : ''}" data-type="${value}">${label}</button>`).join('')}
    </div>
    <div class="pop-fields">${ruleFields(rule, entry)}</div>
    ${rule.type === 'once' ? '' : `
      <div class="pop-head">Ausnahmemonate</div>
      <div class="month-toggles" data-role="skip">
        ${MONTHS_SHORT.map((name, i) => `
          <label><input type="checkbox" data-month="${i + 1}" ${rule.skipMonths?.includes(i + 1) ? 'checked' : ''}>${name}</label>`).join('')}
      </div>`}
  `;

  const apply = (mutate) => ctx.actions.update((state) => {
    const found = state.entries.find((e) => e.id === entryId);
    if (found) mutate(found);
  });

  body.querySelector('[data-role="type"]').addEventListener('click', (event) => {
    const type = event.target.dataset.type;
    if (!type || type === rule.type) return;
    // Typwechsel verwirft die typabhängigen Felder, behält aber die Ausnahmen
    apply((found) => {
      found.rule = { type, skipMonths: found.rule.skipMonths ?? [], skipDates: found.rule.skipDates ?? [] };
    });
    api.rebuild();
  });

  body.querySelector('.pop-fields').addEventListener('change', (event) => {
    const field = event.target.dataset.rule;
    if (!field) return;
    const numeric = ['dayOfMonth', 'interval', 'weekday', 'month', 'monthOffset', 'n'].includes(field);
    apply((found) => { found.rule[field] = numeric ? Number(event.target.value) : event.target.value; });
  });

  body.querySelector('[data-role="skip"]')?.addEventListener('change', () => {
    const months = [...body.querySelectorAll('[data-role="skip"] input:checked')]
      .map((box) => Number(box.dataset.month))
      .sort((a, b) => a - b);
    apply((found) => { found.rule.skipMonths = months; });
  });
}

function ruleFields(rule, entry) {
  const dayOptions = (selected) => [
    ...Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${selected === i + 1 ? 'selected' : ''}>${i + 1}.</option>`),
    `<option value="-1" ${selected === -1 ? 'selected' : ''}>Monatsletzter</option>`,
  ].join('');

  switch (rule.type) {
    case 'monthly':
      return `
        <label class="pop-field">am <select data-rule="dayOfMonth">${dayOptions(rule.dayOfMonth ?? 1)}</select></label>
        <label class="pop-field">jeden <input type="number" min="1" max="24" data-rule="interval" value="${rule.interval ?? 1}" class="num-input small"> Monat</label>`;
    case 'weekly':
      return `
        <label class="pop-field">am <select data-rule="weekday">
          ${WEEKDAYS.map((name, i) => `<option value="${i}" ${(rule.weekday ?? 1) === i ? 'selected' : ''}>${name}</option>`).join('')}
        </select></label>
        <label class="pop-field">jede <input type="number" min="1" max="52" data-rule="interval" value="${rule.interval ?? 1}" class="num-input small"> Woche</label>`;
    case 'quarterly':
      return `
        <label class="pop-field"><select data-rule="monthOffset">
          ${[1, 2, 3].map((n) => `<option value="${n - 1}" ${(rule.monthOffset ?? 0) === n - 1 ? 'selected' : ''}>${n}. Quartalsmonat</option>`).join('')}
        </select></label>
        <label class="pop-field">am <select data-rule="dayOfMonth">${dayOptions(rule.dayOfMonth ?? 1)}</select></label>`;
    case 'yearly':
      return `
        <label class="pop-field">im <select data-rule="month">
          ${MONTHS.map((name, i) => `<option value="${i + 1}" ${(rule.month ?? 1) === i + 1 ? 'selected' : ''}>${name}</option>`).join('')}
        </select></label>
        <label class="pop-field">am <select data-rule="dayOfMonth">${dayOptions(rule.dayOfMonth ?? 1)}</select></label>`;
    case 'everyNDays':
      return `
        <label class="pop-field">alle <input type="number" min="1" data-rule="n" value="${rule.n ?? 30}" class="num-input small"> Tage</label>
        <label class="pop-field">ab <input type="date" data-rule="anchor" value="${rule.anchor ?? entry.startDate}"></label>`;
    case 'once':
      return `<label class="pop-field">am <input type="date" data-rule="date" value="${rule.date ?? entry.startDate}"></label>`;
    default:
      return '';
  }
}

/** Kategorie: der Baum als Liste, ein Klick ordnet zu. */
function renderCategoryEditor(body, api, entryId, ctx) {
  const entry = ctx.state.entries.find((e) => e.id === entryId);
  if (!entry) { api.close(); return; }
  const { categories } = ctx.state;

  body.innerHTML = `
    <div class="pop-head">Kategorie</div>
    <div class="pop-list">
      <button class="${entry.categoryId ? '' : 'on'}" data-category="">— ohne —</button>
      ${flattenTree(categories).map(({ category, depth }) => `
        <button class="${entry.categoryId === category.id ? 'on' : ''}" data-category="${category.id}"
                style="padding-left:${10 + depth * 16}px">
          <span class="dot" style="background:${escapeHtml(category.color)}"></span>${escapeHtml(category.name)}
        </button>`).join('')}
    </div>
  `;

  body.querySelector('.pop-list').addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    ctx.actions.update((state) => {
      const found = state.entries.find((e) => e.id === entryId);
      if (found) found.categoryId = button.dataset.category || null;
    });
    api.close();
  });
}
