/**
 * Tab "Einnahmen & Ausgaben": Übersicht aller Einträge.
 *
 * Name, Kategorie, Art und Betrag sind direkt in der Tabelle änderbar; alles
 * Strukturelle — Wiederholung, Phasen, Zeitraum — läuft über den Dialog.
 *
 * Wichtig: Inline-Änderungen dürfen die Tabelle **nicht** neu aufbauen
 * (Architecture.md, A16). Sie schreiben über `updateInline` und frischen
 * anschließend nur die abgeleiteten Stellen der betroffenen Zeile auf.
 */
import { describeRule } from '../../src/core/recurrence.js';
import { amountAt, setAmountAt, sortPhases } from '../../src/core/amounts.js';
import { duplicateEntry } from '../../src/core/model.js';
import { flattenTree, pathOf } from '../../src/core/categories.js';
import { today } from '../../src/core/dateUtils.js';
import { escapeHtml, date as fmtDate } from './format.js';
import { openEntryDialog } from './entryForm.js';

export function renderEntriesTab(root, ctx) {
  const { entries, categories } = ctx.state;
  const tree = flattenTree(categories);
  const now = today();

  /** Auswahlfeld mit eingerücktem Kategoriebaum. */
  const categoryOptions = (selectedId) => [
    `<option value="" ${!selectedId ? 'selected' : ''}>— ohne —</option>`,
    ...tree.map(({ category, depth }) =>
      `<option value="${category.id}" ${selectedId === category.id ? 'selected' : ''}>${'  '.repeat(depth)}${escapeHtml(category.name)}</option>`),
  ].join('');

  const rows = entries.map((entry) => `
      <tr data-id="${entry.id}" class="${entry.active === false ? 'inactive' : ''}">
        <td>
          <input data-inline="name" value="${escapeHtml(entry.name)}" style="width:190px">
          ${entry.note ? `<div class="hint">${escapeHtml(entry.note)}</div>` : ''}
        </td>
        <td>
          <span class="chip">
            <span class="dot" data-cell="dot" style="background:${dotColor(entry, categories)};border:1px solid var(--border)"></span>
            <select data-inline="categoryId" title="${escapeHtml(categoryTitle(entry, categories))}">${categoryOptions(entry.categoryId)}</select>
          </span>
        </td>
        <td>
          <select data-inline="direction">
            <option value="expense" ${entry.direction === 'expense' ? 'selected' : ''}>Ausgabe</option>
            <option value="income" ${entry.direction === 'income' ? 'selected' : ''}>Einnahme</option>
          </select>
        </td>
        <td class="num">
          <input type="number" step="0.01" data-inline="amount" value="${amountAt(entry, now)}"
                 class="${amountClass(entry)}" style="width:110px;text-align:right"
                 title="Ändert den heute gültigen Betrag">
          <div class="hint" data-cell="phase">${phaseText(entry, now)}</div>
        </td>
        <td>${escapeHtml(describeRule(entry.rule))}</td>
        <td>${fmtDate(entry.startDate)}${entry.endDate ? ` – ${fmtDate(entry.endDate)}` : ''}</td>
        <td><input type="checkbox" data-inline="active" ${entry.active !== false ? 'checked' : ''} title="aktiv"></td>
        <td style="white-space:nowrap">
          <button class="link" data-action="edit">bearbeiten</button>
          <button class="link" data-action="duplicate" title="Eintrag als Vorlage kopieren">duplizieren</button>
        </td>
      </tr>`).join('');

  root.innerHTML = `
    <div class="panel">
      <div class="row" style="justify-content:space-between">
        <h2 style="margin:0">Einnahmen &amp; Ausgaben</h2>
        <button class="action primary" id="btn-new-entry">+ Neuer Eintrag</button>
      </div>
      ${entries.length ? `
        <p class="hint">Name, Kategorie, Art und Betrag lassen sich direkt in der Tabelle ändern. Der Betrag gilt für die heute laufende Phase.</p>
        <div class="scroll">
          <table>
            <thead><tr>
              <th>Bezeichnung</th><th>Kategorie</th><th>Art</th><th class="num">Betrag heute</th>
              <th>Wiederholung</th><th>Zeitraum</th><th>Aktiv</th><th></th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`
      : '<p class="empty">Noch keine Einträge. Über „Neuer Eintrag“ anlegen oder im Tab „Konto &amp; Daten“ die Beispieldaten laden.</p>'}
    </div>
  `;

  root.querySelector('#btn-new-entry').addEventListener('click', () => openEntryDialog(null, ctx));

  const tbody = root.querySelector('tbody');

  // Strukturelle Aktionen — hier ist ein Neurendern richtig und ungefährlich,
  // weil kein Feld im Zugriff ist.
  tbody?.addEventListener('click', (event) => {
    const action = event.target.dataset.action;
    const id = event.target.closest('tr')?.dataset.id;
    if (!action || !id) return;

    if (action === 'edit') {
      openEntryDialog(ctx.state.entries.find((e) => e.id === id), ctx);
      return;
    }
    if (action === 'duplicate') {
      ctx.actions.update((state) => {
        const index = state.entries.findIndex((e) => e.id === id);
        if (index < 0) return;
        // direkt hinter dem Original einfügen, mit eindeutigem Namen
        state.entries.splice(index + 1, 0, duplicateEntry(state.entries[index], state.entries));
      });
    }
  });

  // Inline-Änderungen: erst bei "change" (Verlassen des Feldes / Enter) und
  // ohne Neurendern — sonst wird der DOM mitten im Klick ausgetauscht.
  tbody?.addEventListener('change', (event) => {
    const field = event.target.dataset.inline;
    const tr = event.target.closest('tr');
    const id = tr?.dataset.id;
    if (!field || !id) return;

    let changed = null;
    ctx.actions.updateInline((state) => {
      const entry = state.entries.find((e) => e.id === id);
      if (!entry) return;
      changed = entry;
      switch (field) {
        case 'name': {
          const name = event.target.value.trim();
          if (name) entry.name = name;
          else event.target.value = entry.name;   // leerer Name wird verworfen
          break;
        }
        case 'categoryId':
          entry.categoryId = event.target.value || null;
          break;
        case 'direction':
          entry.direction = event.target.value;
          break;
        case 'amount':
          entry.amounts = setAmountAt(entry, today(), Number(event.target.value) || 0);
          break;
        case 'active':
          entry.active = event.target.checked;
          break;
      }
    });

    if (changed) patchRow(tr, changed, ctx.state.categories);
  });
}

/**
 * Frischt die abgeleiteten Stellen einer Zeile auf, ohne sie neu zu bauen —
 * das Feld, in dem der Anwender gerade steht, bleibt unangetastet.
 */
function patchRow(tr, entry, categories) {
  tr.classList.toggle('inactive', entry.active === false);

  const dot = tr.querySelector('[data-cell="dot"]');
  if (dot) dot.style.background = dotColor(entry, categories);

  const categorySelect = tr.querySelector('[data-inline="categoryId"]');
  if (categorySelect) categorySelect.title = categoryTitle(entry, categories);

  const amount = tr.querySelector('[data-inline="amount"]');
  if (amount) amount.className = amountClass(entry);

  const phase = tr.querySelector('[data-cell="phase"]');
  if (phase) phase.textContent = phaseText(entry, today());
}

const amountClass = (entry) => (entry.direction === 'income' ? 'amount-positive' : 'amount-negative');

function dotColor(entry, categories) {
  return categories.find((c) => c.id === entry.categoryId)?.color ?? 'transparent';
}

function categoryTitle(entry, categories) {
  return entry.categoryId ? pathOf(categories, entry.categoryId) : 'ohne Kategorie';
}

/** Welche Betragsphase gilt heute? Leer, wenn es nur eine gibt. */
function phaseText(entry, now) {
  const phases = sortPhases(entry.amounts ?? []);
  if (phases.length < 2) return '';
  const index = phases.findIndex((p, i) =>
    (p.from == null || p.from <= now) && (phases[i + 1] == null || phases[i + 1].from > now));
  return `Phase ${index + 1} von ${phases.length}`;
}
