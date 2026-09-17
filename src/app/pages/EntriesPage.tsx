/**
 * Buchungen als Token-Liste (Architecture.md, A20): die Zeile ist Text in
 * einem festen Raster, jede veränderliche Angabe ein Token. Ein Tippen öffnet
 * den Editor für genau diesen Aspekt — als Blatt von unten auf kleinen
 * Schirmen, als angedocktes Popover ab Tablet.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

import { describeRuleParts } from '../../core/recurrence.ts';
import { amountAt, sortPhases } from '../../core/amounts.ts';
import { createEntry, duplicateEntry } from '../../core/model.ts';
import { pathOf } from '../../core/categories.ts';
import { today } from '../../core/dateUtils.ts';
import { useStore } from '../state/StateProvider.tsx';
import { day, money, moneySigned, signClass, NO_CATEGORY_COLOR } from '../format.ts';
import Sheet from '../components/Sheet.tsx';
import { IconCopy, IconEmpty, IconMore, IconPlus, IconPower } from '../components/Icons.tsx';
import AmountEditor from '../components/editors/AmountEditor.tsx';
import RuleEditor from '../components/editors/RuleEditor.tsx';
import CategoryEditor from '../components/editors/CategoryEditor.tsx';
import DetailsEditor from '../components/editors/DetailsEditor.tsx';
import type { Category, Entry } from '../../core/types.ts';
import type { ApplyToEntry } from '../components/editors/AmountEditor.tsx';

/** Welches Token einer Zeile gerade offen ist. */
type TokenName = 'amount' | 'rule' | 'category' | 'more';
interface OpenEditor { id: string; token: TokenName; }
interface Renaming { id: string; value: string; }

export default function EntriesPage() {
  const { doc, update } = useStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [editor, setEditor] = useState<OpenEditor | null>(null);
  const [renaming, setRenaming] = useState<Renaming | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const now = today();

  const applyTo = useCallback((id: string): ApplyToEntry => (mutate) => update((draft) => {
    const entry = draft.entries.find((e) => e.id === id);
    if (entry) mutate(entry);
  }), [update]);

  const addEntry = () => {
    const entry = createEntry({ name: 'Neue Buchung', startDate: now });
    update((draft) => { draft.entries.push(entry); });
    setSelected(entry.id);
    setRenaming({ id: entry.id, value: entry.name });
  };

  const duplicate = (id: string) => update((draft) => {
    const index = draft.entries.findIndex((e) => e.id === id);
    if (index < 0) return;
    draft.entries.splice(index + 1, 0, duplicateEntry(draft.entries[index], draft.entries));
  });

  const remove = (id: string) => {
    update((draft) => { draft.entries = draft.entries.filter((e) => e.id !== id); });
    setEditor(null);
    setSelected(null);
  };

  /** ↑/↓ Zeile, ←/→ Angabe, Enter öffnet (Architecture.md, A21). */
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>('.entry-row');
    if (!row || !listRef.current) return;
    const rows = [...listRef.current.querySelectorAll<HTMLElement>('.entry-row')];
    const tokens = [...row.querySelectorAll<HTMLElement>('.tok')];
    const inToken = target.classList.contains('tok');

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      rows[rows.indexOf(row) + (event.key === 'ArrowDown' ? 1 : -1)]?.focus();
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const at = inToken ? tokens.indexOf(target) : -1;
      const step = event.key === 'ArrowRight' ? 1 : -1;
      tokens[Math.max(0, Math.min(tokens.length - 1, at + step))]?.focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (inToken) target.click();
      else { tokens[0]?.focus(); tokens[0]?.click(); }
    }
  };

  const openEditor = (id: string, token: TokenName) => {
    setSelected(id);
    setEditor((current) => (current?.id === id && current?.token === token ? null : { id, token }));
  };

  const editorEntry = editor && doc.entries.find((e) => e.id === editor.id);

  return (
    <main className="content">
      <div className="page-head">
        <h1>Buchungen</h1>
        <span className="spacer" />
        <button type="button" className="btn primary" onClick={addEntry}><IconPlus /> Neue Buchung</button>
      </div>

      <section className="card">
        <div className="card-head">
          <span className="small muted">
            Jede Angabe lässt sich direkt ändern. Pfeiltasten bewegen sich durch Zeilen und Angaben, Enter öffnet.
          </span>
        </div>
        <div className="card-body tight">
          {doc.entries.length ? (
            <div className="rows" ref={listRef} onKeyDown={onKeyDown}>
              {doc.entries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  categories={doc.categories}
                  now={now}
                  selected={selected === entry.id}
                  openToken={editor?.id === entry.id ? editor.token : null}
                  renaming={renaming?.id === entry.id ? renaming.value : null}
                  onSelect={() => setSelected(entry.id)}
                  onToken={(token) => openEditor(entry.id, token)}
                  onRenameStart={() => { setSelected(entry.id); setRenaming({ id: entry.id, value: entry.name }); }}
                  onRenameChange={(value) => setRenaming({ id: entry.id, value })}
                  onRenameEnd={(commit) => {
                    const name = (renaming?.value ?? '').trim();
                    if (commit && name) applyTo(entry.id)((draft) => { draft.name = name; });
                    setRenaming(null);
                  }}
                  onToggleActive={() => applyTo(entry.id)((draft) => { draft.active = draft.active === false; })}
                  onDuplicate={() => duplicate(entry.id)}
                />
              ))}
            </div>
          ) : (
            <div className="empty">
              <IconEmpty />
              <p className="small">Noch keine Buchungen.</p>
              <button type="button" className="btn primary" onClick={addEntry}><IconPlus /> Neue Buchung</button>
            </div>
          )}
        </div>
      </section>

      {editorEntry && (
        <Sheet
          anchorSelector={`[data-row="${editor.id}"] [data-token="${editor.token}"]`}
          onClose={() => setEditor(null)}
        >
          {editor.token === 'amount' && <AmountEditor entry={editorEntry} apply={applyTo(editor.id)} />}
          {editor.token === 'rule' && <RuleEditor entry={editorEntry} apply={applyTo(editor.id)} />}
          {editor.token === 'category' && (
            <CategoryEditor entry={editorEntry} categories={doc.categories}
              apply={applyTo(editor.id)} close={() => setEditor(null)} />
          )}
          {editor.token === 'more' && (
            <DetailsEditor entry={editorEntry} apply={applyTo(editor.id)}
              onDuplicate={() => { duplicate(editor.id); setEditor(null); }}
              onDelete={() => { if (confirm(`„${editorEntry.name}“ wirklich löschen?`)) remove(editor.id); }} />
          )}
        </Sheet>
      )}
    </main>
  );
}

interface EntryRowProps {
  entry: Entry;
  categories: Category[];
  now: string;
  selected: boolean;
  /** offenes Token dieser Zeile, sonst null */
  openToken: TokenName | null;
  /** laufende Umbenennung dieser Zeile, sonst null */
  renaming: string | null;
  onSelect: () => void;
  onToken: (token: TokenName) => void;
  onRenameStart: () => void;
  onRenameChange: (value: string) => void;
  onRenameEnd: (commit: boolean) => void;
  onToggleActive: () => void;
  onDuplicate: () => void;
}

function EntryRow({
  entry, categories, now, selected, openToken, renaming,
  onSelect, onToken, onRenameStart, onRenameChange, onRenameEnd, onToggleActive, onDuplicate,
}: EntryRowProps) {
  const parts = useMemo(() => describeRuleParts(entry.rule), [entry.rule]);
  const phases = sortPhases(entry.amounts ?? []).length;
  const signed = entry.direction === 'expense' ? -amountAt(entry, now) : amountAt(entry, now);
  const category = categories.find((c) => c.id === entry.categoryId);
  // Über den Baum, nicht über den Pfad-String: ein Kategoriename darf selbst
  // ein „ / " enthalten („Haus / Wohnung").
  const parentPath = category?.parentId ? pathOf(categories, category.parentId) : '';
  const cls = (token: string) => `tok tok-${token} ${openToken === token ? 'open' : ''}`;

  return (
    <div
      className={`row-item entry-row ${selected ? 'selected' : ''} ${entry.active === false ? 'dimmed' : ''}`}
      data-row={entry.id}
      tabIndex={0}
      onFocus={onSelect}
    >
      {renaming === null ? (
        <button type="button" className={cls('name')} data-token="name" title="Umbenennen"
          onClick={onRenameStart}>
          <span className="truncate">{entry.name}</span>
        </button>
      ) : (
        <input
          className="tok-input" autoFocus value={renaming} aria-label="Bezeichnung"
          onChange={(e) => onRenameChange(e.target.value)}
          onBlur={() => onRenameEnd(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); onRenameEnd(true); }
            if (e.key === 'Escape') { e.stopPropagation(); onRenameEnd(false); }
          }}
        />
      )}

      <button type="button" className={`${cls('amount')} ${signClass(signed)}`} data-token="amount"
        title="Betrag und Art ändern" onClick={() => onToken('amount')}>
        {moneySigned(signed)}
        {phases > 1 && <sup className="tok-badge">{phases}</sup>}
      </button>

      <button type="button" className={cls('rule')} data-token="rule"
        title="Wiederholung und Ausnahmen ändern" onClick={() => onToken('rule')}>
        <span className="truncate">
          {parts.rhythmShort}
          {parts.exceptionsShort && <span className="tok-sub"> · {parts.exceptionsShort}</span>}
        </span>
      </button>

      <button type="button" className={`${cls('category')} ${category ? '' : 'tok-empty'}`} data-token="category"
        title={`${category ? pathOf(categories, category.id) : 'ohne Kategorie'} — ändern`}
        onClick={() => onToken('category')}>
        <span className="dot" style={{ background: category?.color ?? NO_CATEGORY_COLOR }} />
        {/*
          * Der Pfad der Oberkategorien wird zuerst gekürzt, der Name der
          * Kategorie selbst bleibt stehen — er trägt die Aussage.
          */}
        {parentPath && <span className="cat-parent">{parentPath} /</span>}
        <span className="cat-leaf">{category ? category.name : 'ohne Kategorie'}</span>
      </button>

      <span className="row-actions">
        <button type="button" className="btn icon ghost" onClick={onToggleActive}
          title={entry.active === false ? 'Aktivieren' : 'Stilllegen'}
          style={entry.active === false ? undefined : { color: 'var(--pos)' }}>
          <IconPower />
        </button>
        <button type="button" className="btn icon ghost" onClick={onDuplicate} title="Duplizieren">
          <IconCopy />
        </button>
        <button type="button" className={`btn icon ghost tok ${openToken === 'more' ? 'open' : ''}`}
          data-token="more" title="Laufzeit, Notiz, Löschen" onClick={() => onToken('more')}>
          <IconMore />
        </button>
      </span>

      {/*
        * Immer sichtbar, nicht erst bei Auswahl: eine Zeile, die beim
        * Anklicken erscheint, verschiebt alles darunter — der Klick, der sie
        * auslöst, verliert dann sein Ziel zwischen Drücken und Loslassen.
        */}
      <div className="row-meta truncate">
        {entry.direction === 'income' ? 'Einnahme' : 'Ausgabe'}
        {' · '}ab {day(entry.startDate)}{entry.endDate ? ` bis ${day(entry.endDate)}` : ', unbefristet'}
        {entry.active === false && ' · stillgelegt'}
        {phases > 1 && ` · ${phases} Betragsphasen, aktuell ${money(Math.abs(signed))}`}
        {entry.note ? ` · ${entry.note}` : ''}
      </div>
    </div>
  );
}
