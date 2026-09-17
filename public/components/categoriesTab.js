/**
 * Tab "Kategorien": hierarchische Pflege von Name, Farbe und Oberkategorie —
 * inline und ohne Speichern-Knopf.
 */
import { createCategory, DEFAULT_COLORS } from '../../src/core/model.js';
import { flattenTree, canReparent, descendantIds, pathOf } from '../../src/core/categories.js';
import { escapeHtml, money } from './format.js';

export function renderCategoriesTab(root, ctx) {
  const { categories, entries } = ctx.state;
  const tree = flattenTree(categories);

  const usage = new Map();
  for (const entry of entries) {
    if (entry.categoryId) usage.set(entry.categoryId, (usage.get(entry.categoryId) ?? 0) + 1);
  }
  const netOf = (id) => ctx.stats.byCategory.find((b) => b.categoryId === id)?.net ?? 0;

  /** Optionen für "Oberkategorie", ohne den eigenen Unterbaum. */
  const parentOptions = (category) => [
    `<option value="">— keine (oberste Ebene) —</option>`,
    ...tree
      .filter(({ category: other }) =>
        other.id !== category.id && canReparent(categories, category.id, other.id))
      .map(({ category: other, depth }) =>
        `<option value="${other.id}" ${category.parentId === other.id ? 'selected' : ''}>${'  '.repeat(depth)}${escapeHtml(other.name)}</option>`),
  ].join('');

  const rows = tree.map(({ category, depth }) => {
    const subtree = descendantIds(categories, category.id);
    const ownEntries = usage.get(category.id) ?? 0;
    const allEntries = [...subtree].reduce((sum, id) => sum + (usage.get(id) ?? 0), 0);
    const subtreeNet = [...subtree].reduce((sum, id) => sum + netOf(id), 0);
    return `
      <tr data-id="${category.id}">
        <td><input type="color" data-field="color" value="${escapeHtml(category.color)}"></td>
        <td style="padding-left:${8 + depth * 22}px">
          ${depth ? '<span class="hint">└ </span>' : ''}
          <input data-field="name" value="${escapeHtml(category.name)}" style="width:200px">
        </td>
        <td><select data-field="parentId">${parentOptions(category)}</select></td>
        <td class="num">${ownEntries}${allEntries !== ownEntries ? ` <span class="hint">(${allEntries})</span>` : ''}</td>
        <td class="num">${money(subtreeNet)}${subtreeNet !== netOf(category.id) && netOf(category.id) !== 0
          ? `<div class="hint">davon selbst ${money(netOf(category.id))}</div>` : ''}</td>
        <td><button class="link" data-action="delete">löschen</button></td>
      </tr>`;
  }).join('');

  const newParentOptions = tree.map(({ category, depth }) =>
    `<option value="${category.id}">${'  '.repeat(depth)}${escapeHtml(category.name)}</option>`).join('');

  root.innerHTML = `
    <div class="panel">
      <h2>Kategorien</h2>
      <p class="hint">Kategorien lassen sich beliebig tief verschachteln. Die Spalte „Saldo im Zeitraum“ enthält die Unterkategorien.</p>
      ${categories.length ? `
        <table>
          <thead><tr>
            <th>Farbe</th><th>Name</th><th>Oberkategorie</th>
            <th class="num">Einträge</th><th class="num">Saldo im Zeitraum</th><th></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>` : '<p class="empty">Noch keine Kategorien angelegt.</p>'}
      <div class="row" style="margin-top:12px">
        <div class="field"><label>Neue Kategorie</label><input id="new-cat-name" placeholder="z. B. Wohnen"></div>
        <div class="field">
          <label>Oberkategorie</label>
          <select id="new-cat-parent"><option value="">— keine —</option>${newParentOptions}</select>
        </div>
        <div class="field"><label>Farbe</label><input id="new-cat-color" type="color" value="${DEFAULT_COLORS[categories.length % DEFAULT_COLORS.length]}"></div>
        <button class="action primary" id="btn-add-cat">Hinzufügen</button>
      </div>
    </div>
  `;

  const tbody = root.querySelector('tbody');

  tbody?.addEventListener('change', (event) => {
    const field = event.target.dataset.field;
    const id = event.target.closest('tr')?.dataset.id;
    if (!field || !id) return;

    if (field === 'parentId') {
      const parentId = event.target.value || null;
      if (parentId && !canReparent(categories, id, parentId)) {
        alert('Eine Kategorie kann nicht unter sich selbst einsortiert werden.');
        ctx.actions.render();
        return;
      }
      ctx.actions.update((state) => {
        const category = state.categories.find((c) => c.id === id);
        if (category) category.parentId = parentId;
      });
      return;
    }

    ctx.actions.update((state) => {
      const category = state.categories.find((c) => c.id === id);
      if (category) category[field] = event.target.value;
    });
  });

  tbody?.addEventListener('click', (event) => {
    if (event.target.dataset.action !== 'delete') return;
    const id = event.target.closest('tr').dataset.id;
    const subtree = descendantIds(categories, id);
    const children = subtree.size - 1;
    const affected = [...subtree].reduce((sum, key) => sum + (usage.get(key) ?? 0), 0);

    const notes = [];
    if (children) notes.push(`${children} Unterkategorie(n) rücken eine Ebene nach oben`);
    if (affected) notes.push(`${affected} Eintrag/Einträge verlieren ihre Kategorie`);
    if (notes.length && !confirm(`„${pathOf(categories, id)}“ löschen?\n\n${notes.join('\n')}`)) return;

    ctx.actions.update((state) => {
      const removed = state.categories.find((c) => c.id === id);
      const newParent = removed?.parentId ?? null;
      state.categories = state.categories.filter((c) => c.id !== id);
      for (const category of state.categories) {
        if (category.parentId === id) category.parentId = newParent;
      }
      for (const entry of state.entries) {
        if (entry.categoryId === id) entry.categoryId = null;
      }
    });
  });

  const nameInput = root.querySelector('#new-cat-name');
  const add = () => {
    const name = nameInput.value.trim();
    if (!name) return;
    const parentId = root.querySelector('#new-cat-parent').value || null;
    const color = root.querySelector('#new-cat-color').value;
    ctx.actions.update((state) => { state.categories.push(createCategory(name, color, parentId)); });
  };
  root.querySelector('#btn-add-cat').addEventListener('click', add);
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
}
