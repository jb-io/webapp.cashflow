/** Kategorie: der Baum als Liste, ein Tippen ordnet zu. */
import { flattenTree } from '../../../core/categories.ts';
import { NO_CATEGORY_COLOR } from '../../format.ts';
import type { Category, Entry } from '../../../core/types.ts';
import type { ApplyToEntry } from './AmountEditor.tsx';

interface Props {
  entry: Entry;
  categories: Category[];
  apply: ApplyToEntry;
  close: () => void;
}

export default function CategoryEditor({ entry, categories, apply, close }: Props) {
  const choose = (id: string | null) => {
    apply((draft) => { draft.categoryId = id; });
    close();
  };

  return (
    <>
      <h3>Kategorie</h3>
      <div className="pick-list">
        <button type="button" className={entry.categoryId ? '' : 'on'} onClick={() => choose(null)}>
          <span className="dot" style={{ background: NO_CATEGORY_COLOR }} />
          ohne Kategorie
        </button>
        {flattenTree(categories).map(({ category, depth }) => (
          <button key={category.id} type="button"
            className={entry.categoryId === category.id ? 'on' : ''}
            style={{ paddingLeft: 10 + depth * 18 }}
            onClick={() => choose(category.id)}>
            <span className="dot" style={{ background: category.color }} />
            {category.name}
          </button>
        ))}
      </div>
    </>
  );
}
