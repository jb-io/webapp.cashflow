/** Verlauf: Kennzahlen, Kontoverlauf, Monatssaldo und die Buchungsliste. */
import { useMemo, useState } from 'react';

import { descendantIds, pathOf } from '../../core/categories.ts';
import { useStore } from '../state/StateProvider.tsx';
import { day, money, moneySigned, month, signClass, NO_CATEGORY_COLOR } from '../format.ts';
import PeriodPicker from '../components/PeriodPicker.tsx';
import BalanceChart from '../charts/BalanceChart.tsx';
import MonthlyChart from '../charts/MonthlyChart.tsx';
import { IconEmpty, IconWarn } from '../components/Icons.tsx';

interface StatProps { label: string; value: string; meta?: string; tone?: string; }

export default function ForecastPage() {
  const { doc, view, forecast, months, stats } = useStore();
  const [filter, setFilter] = useState('all');
  const [groupByRoot, setGroupByRoot] = useState(false);

  const visible = useMemo(() => {
    if (filter === 'all') return forecast.transactions;
    if (filter === '_none') return forecast.transactions.filter((tx) => tx.categoryId == null);
    const ids = descendantIds(doc.categories, filter);
    return forecast.transactions.filter((tx) => tx.categoryId && ids.has(tx.categoryId));
  }, [forecast, filter, doc.categories]);

  return (
    <main className="content">
      <div className="page-head">
        <h1>Verlauf</h1>
        <span className="spacer" />
        <span className="small muted">{month(view.from)} – {month(view.to)}</span>
      </div>

      <div className="stats">
        <Stat label="Startsaldo" value={money(stats.opening)} meta={day(forecast.from)} />
        <Stat label="Tiefstand" value={money(stats.min.balance)} meta={day(stats.min.date)}
          tone={stats.min.balance < 0 ? 'neg' : undefined} />
        <Stat label="Höchststand" value={money(stats.max.balance)} meta={day(stats.max.date)} />
        <Stat label="Endsaldo" value={money(stats.closing)} meta={day(forecast.to)} />
        <Stat label="Ergebnis" value={moneySigned(stats.delta)} tone={signClass(stats.delta)}
          meta={`+${money(stats.totalIncome)} / −${money(stats.totalExpense)}`} />
      </div>

      {stats.belowZero && (
        <p className="banner">
          <IconWarn />
          Das Konto rutscht am {day(stats.belowZero.date)} ins Minus ({money(stats.belowZero.balance)}).
        </p>
      )}

      <PeriodPicker />

      <section className="card">
        <div className="card-head">
          <h2>Kontoverlauf</h2>
          <span className="spacer" />
          <span className="small muted num">{forecast.transactions.length} Buchungen</span>
        </div>
        <div className="card-body">
          {forecast.transactions.length
            ? <BalanceChart forecast={forecast} stats={stats} />
            : <Empty text="Keine Buchungen im gewählten Zeitraum." />}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Monatssaldo nach Kategorie</h2>
          <span className="spacer" />
          <button type="button" className={`btn sm ${groupByRoot ? 'primary' : ''}`}
            onClick={() => setGroupByRoot((on) => !on)}>
            Nur Oberkategorien
          </button>
        </div>
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <MonthlyChart months={months} categories={doc.categories} groupByRoot={groupByRoot} />
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Buchungen</h2>
          <span className="spacer" />
          <div className="field" style={{ minWidth: 180 }}>
            <select aria-label="Kategorie filtern" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">Alle Kategorien</option>
              {doc.categories.map((category) => (
                <option key={category.id} value={category.id}>{pathOf(doc.categories, category.id)}</option>
              ))}
              <option value="_none">ohne Kategorie</option>
            </select>
          </div>
        </div>
        <div className="card-body tight">
          {visible.length ? (
            <div className="rows">
              {visible.map((tx, index) => {
                const category = doc.categories.find((c) => c.id === tx.categoryId);
                return (
                  <div className="row-item tx-row" key={`${tx.entryId}-${tx.date}-${index}`}>
                    <span className="tx-date num">{day(tx.date)}</span>
                    <span className="tx-name truncate">{tx.name}</span>
                    <span className="tx-cat truncate">
                      <span className="dot" style={{ background: category?.color ?? NO_CATEGORY_COLOR }} />
                      {category ? pathOf(doc.categories, category.id) : 'ohne Kategorie'}
                    </span>
                    <span className={`tx-amount ${signClass(tx.amount)}`}>{moneySigned(tx.amount)}</span>
                    <span className={`tx-balance ${tx.balance < 0 ? 'neg' : ''}`}>{money(tx.balance)}</span>
                  </div>
                );
              })}
            </div>
          ) : <Empty text="Keine Buchungen für diesen Filter." />}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value, meta, tone }: StatProps) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className={`value num ${tone ?? ''}`}>{value}</div>
      {meta && <div className="meta num">{meta}</div>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="empty"><IconEmpty /><p className="small">{text}</p></div>;
}
