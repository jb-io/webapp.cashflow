/**
 * Kategorien: beliebig tief verschachtelt (Architecture.md, A11). Die Liste
 * bleibt flach gespeichert, der Baum wird berechnet.
 */
import { useState } from 'react';

import { createCategory, DEFAULT_COLORS } from '../../core/model.ts';
import { canReparent, descendantIds, flattenTree, pathOf } from '../../core/categories.ts';
import { useStore } from '../state/StateProvider.tsx';
import { money } from '../format.ts';
import { IconEmpty, IconPlus, IconTrash } from '../components/Icons.tsx';
import type { Category } from '../../core/types.ts';

interface Draft { name: string; parentId: string; color: string | null; }

export default function CategoriesPage() {
  const { doc, stats, update } = useStore();
  const { categories, entries } = doc;
  const tree = flattenTree(categories);

  const [draft, setDraft] = useState<Draft>({ name: '', parentId: '', color: null });
  const newColor = draft.color ?? DEFAULT_COLORS[categories.length % DEFAULT_COLORS.length];

  const usage = new Map<string, number>();
  for (const entry of entries) {
    if (entry.categoryId) usage.set(entry.categoryId, (usage.get(entry.categoryId) ?? 0) + 1);
  }
  const netOf = (id: string) => stats.byCategory.find((b) => b.categoryId === id)?.net ?? 0;

  const patch = <K extends keyof Category>(id: string, field: K, value: Category[K]) => update((d) => {
    const category = d.categories.find((c) => c.id === id);
    if (category) category[field] = value;
  });

  const add = () => {
    const name = draft.name.trim();
    if (!name) return;
    update((d) => { d.categories.push(createCategory(name, newColor, draft.parentId || null)); });
    setDraft({ name: '', parentId: draft.parentId, color: null });
  };

  const remove = (id: string) => {
    const subtree = descendantIds(categories, id);
    const children = subtree.size - 1;
    const affected = [...subtree].reduce((sum, key) => sum + (usage.get(key) ?? 0), 0);
    const notes = [];
    if (children) notes.push(`${children} Unterkategorie(n) rücken eine Ebene nach oben`);
    if (affected) notes.push(`${affected} Buchung(en) verlieren ihre Kategorie`);
    if (notes.length && !confirm(`„${pathOf(categories, id)}“ löschen?\n\n${notes.join('\n')}`)) return;

    update((d) => {
      const parentId = d.categories.find((c) => c.id === id)?.parentId ?? null;
      d.categories = d.categories.filter((c) => c.id !== id);
      for (const category of d.categories) if (category.parentId === id) category.parentId = parentId;
      for (const entry of d.entries) if (entry.categoryId === id) entry.categoryId = null;
    });
  };

  return (
    <main className="content">
      <div className="page-head"><h1>Kategorien</h1></div>

      <section className="card">
        <div className="card-head">
          <span className="small muted">
            Beliebig tief verschachtelbar. Der Saldo enthält die Unterkategorien.
          </span>
        </div>
        <div className="card-body tight">
          {tree.length ? (
            <div className="rows">
              {tree.map(({ category, depth }) => {
                const subtree = descendantIds(categories, category.id);
                const own = usage.get(category.id) ?? 0;
                const all = [...subtree].reduce((sum, id) => sum + (usage.get(id) ?? 0), 0);
                const net = [...subtree].reduce((sum, id) => sum + netOf(id), 0);

                return (
                  <div className="row-item cat-row" key={category.id} style={{ paddingLeft: 10 + depth * 20 }}>
                    <input type="color" aria-label={`Farbe von ${category.name}`} value={category.color}
                      onChange={(e) => patch(category.id, 'color', e.target.value)} />

                    <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                      <input aria-label="Name" value={category.name}
                        onChange={(e) => patch(category.id, 'name', e.target.value)} />
                      <div className="tiny muted" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <span>{all} Buchung{all === 1 ? '' : 'en'}{all !== own ? ` (${own} direkt)` : ''}</span>
                        <span className="num">{money(net)}</span>
                        <label style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                          in
                          <select style={{ minHeight: 28, padding: '2px 6px', fontSize: 12, width: 'auto' }}
                            value={category.parentId ?? ''}
                            onChange={(e) => {
                              const parentId = e.target.value || null;
                              if (parentId && !canReparent(categories, category.id, parentId)) return;
                              patch(category.id, 'parentId', parentId);
                            }}>
                            <option value="">oberster Ebene</option>
                            {tree
                              .filter(({ category: other }) =>
                                other.id !== category.id && canReparent(categories, category.id, other.id))
                              .map(({ category: other, depth: d }) => (
                                <option key={other.id} value={other.id}>{'  '.repeat(d)}{other.name}</option>
                              ))}
                          </select>
                        </label>
                      </div>
                    </div>

                    <button type="button" className="btn icon ghost" title="Löschen"
                      onClick={() => remove(category.id)}>
                      <IconTrash />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : <div className="empty"><IconEmpty /><p className="small">Noch keine Kategorien.</p></div>}
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2>Neue Kategorie</h2></div>
        <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '2 1 180px' }}>
            <label htmlFor="cat-name">Name</label>
            <input id="cat-name" value={draft.name} placeholder="z. B. Wohnen"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
          </div>
          <div className="field" style={{ flex: '2 1 180px' }}>
            <label htmlFor="cat-parent">Oberkategorie</label>
            <select id="cat-parent" value={draft.parentId}
              onChange={(e) => setDraft({ ...draft, parentId: e.target.value })}>
              <option value="">— keine —</option>
              {tree.map(({ category, depth }) => (
                <option key={category.id} value={category.id}>{'  '.repeat(depth)}{category.name}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: '0 0 auto' }}>
            <label htmlFor="cat-color">Farbe</label>
            <input id="cat-color" type="color" value={newColor}
              onChange={(e) => setDraft({ ...draft, color: e.target.value })} />
          </div>
          <button type="button" className="btn primary" onClick={add}><IconPlus /> Hinzufügen</button>
        </div>
      </section>
    </main>
  );
}
