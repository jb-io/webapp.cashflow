/** Kategorie: der Baum als Liste, ein Tippen ordnet zu. */
import { flattenTree } from '../../../core/categories.js';
import { NO_CATEGORY_COLOR } from '../../format.js';

export default function CategoryEditor({ entry, categories, apply, close }) {
  const choose = (id) => {
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
