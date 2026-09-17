/**
 * Tab "Verlauf": Kennzahlen, Saldo-Chart, Monatsbalken je Kategorie
 * und die Buchungstabelle.
 */
import { flattenTree, descendantIds, pathOf, rootIdOf } from '../../src/core/categories.js';
import { formatMonthDE } from '../../src/core/dateUtils.js';
import { categoryChip, escapeHtml, money, moneyCell, date as fmtDate, monthLabel } from './format.js';
import { viewRangeHtml, wireViewRange } from './viewRange.js';

/** Chart-Instanzen, Filter und Gruppierung überleben das Neurendern des Tabs. */
let balanceChart = null;
let monthChart = null;
let categoryFilter = 'all';
let groupByRoot = false;

export function renderForecastTab(root, ctx) {
  const { stats, forecast, months, state } = ctx;
  const byId = new Map(state.categories.map((c) => [c.id, c]));

  // Ein Filter auf eine Oberkategorie schließt ihre Unterkategorien ein.
  const filterIds = categoryFilter === 'all' || categoryFilter === '_none'
    ? null
    : descendantIds(state.categories, categoryFilter);
  const visible = categoryFilter === 'all'
    ? forecast.transactions
    : forecast.transactions.filter((tx) => (filterIds
      ? tx.categoryId && filterIds.has(tx.categoryId)
      : tx.categoryId == null));

  root.innerHTML = `
    <div class="panel">
      <h2>Zeitraum</h2>
      ${viewRangeHtml(ctx)}
    </div>

    <div class="panel">
      <div class="row" style="justify-content:space-between;margin-bottom:8px">
        <h2 style="margin:0">Kennzahlen ${escapeHtml(formatMonthDE(ctx.view.from))} – ${escapeHtml(formatMonthDE(ctx.view.to))}</h2>
        <span class="hint">${forecast.transactions.length} Buchungen</span>
      </div>
      <div class="stats">
        <div class="stat">
          <div class="label">Startsaldo</div>
          <div class="value">${money(stats.opening)}</div>
          <div class="meta">${fmtDate(forecast.from)}</div>
        </div>
        <div class="stat">
          <div class="label">Tiefstand</div>
          <div class="value ${stats.min.balance < 0 ? 'amount-negative' : ''}">${money(stats.min.balance)}</div>
          <div class="meta">${fmtDate(stats.min.date)}</div>
        </div>
        <div class="stat">
          <div class="label">Höchststand</div>
          <div class="value amount-positive">${money(stats.max.balance)}</div>
          <div class="meta">${fmtDate(stats.max.date)}</div>
        </div>
        <div class="stat">
          <div class="label">Endsaldo</div>
          <div class="value">${money(stats.closing)}</div>
          <div class="meta">${fmtDate(forecast.to)}</div>
        </div>
        <div class="stat">
          <div class="label">Zugewinn / Verlust</div>
          <div class="value ${stats.delta < 0 ? 'amount-negative' : 'amount-positive'}">${money(stats.delta)}</div>
          <div class="meta">+${money(stats.totalIncome)} / −${money(stats.totalExpense)}</div>
        </div>
      </div>
      ${stats.belowZero ? `<p class="warn">⚠ Konto rutscht am ${fmtDate(stats.belowZero.date)} ins Minus (${money(stats.belowZero.balance)}).</p>` : ''}
    </div>

    <div class="panel">
      <h2>Kontoverlauf</h2>
      <div class="chart-box"><canvas id="chart-balance"></canvas></div>
    </div>

    <div class="panel">
      <div class="row" style="justify-content:space-between;margin-bottom:8px">
        <h2 style="margin:0">Monatssaldo nach Kategorie</h2>
        <label class="chip" style="margin:0"><input type="checkbox" id="group-root" ${groupByRoot ? 'checked' : ''}> nur Oberkategorien</label>
      </div>
      <div class="chart-box"><canvas id="chart-months"></canvas></div>
    </div>

    <div class="panel">
      <div class="row" style="justify-content:space-between;margin-bottom:8px">
        <h2 style="margin:0">Buchungen</h2>
        <div class="field">
          <label>Kategorie filtern</label>
          <select id="cat-filter">
            <option value="all">alle</option>
            ${flattenTree(state.categories).map(({ category, depth }) =>
              `<option value="${category.id}" ${categoryFilter === category.id ? 'selected' : ''}>${'\u00a0\u00a0'.repeat(depth)}${escapeHtml(category.name)}</option>`).join('')}
            <option value="_none" ${categoryFilter === '_none' ? 'selected' : ''}>ohne Kategorie</option>
          </select>
        </div>
      </div>
      ${visible.length ? `
        <div class="scroll">
          <table>
            <thead><tr><th>Datum</th><th>Bezeichnung</th><th>Kategorie</th><th class="num">Betrag</th><th class="num">Saldo</th></tr></thead>
            <tbody>
              ${visible.map((tx) => `
                <tr>
                  <td>${fmtDate(tx.date)}</td>
                  <td>${escapeHtml(tx.name)}</td>
                  <td>${tx.categoryId
                    ? categoryChip({ ...byId.get(tx.categoryId), name: pathOf(state.categories, tx.categoryId) })
                    : categoryChip(null)}</td>
                  <td class="num">${moneyCell(tx.amount)}</td>
                  <td class="num">${tx.balance < 0 ? `<span class="amount-negative">${money(tx.balance)}</span>` : money(tx.balance)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`
      : '<p class="empty">Keine Buchungen im gewählten Zeitraum.</p>'}
    </div>
  `;

  root.querySelector('#cat-filter').addEventListener('change', (event) => {
    categoryFilter = event.target.value;
    ctx.actions.render();
  });

  wireViewRange(root, ctx);

  root.querySelector('#group-root').addEventListener('change', (event) => {
    groupByRoot = event.target.checked;
    ctx.actions.render();
  });

  drawBalanceChart(root, ctx);
  drawMonthChart(root, ctx, byId);
}

/** Saldo-Linie mit hervorgehobenem Tief- und Höchststand. */
function drawBalanceChart(root, ctx) {
  const canvas = root.querySelector('#chart-balance');
  const points = ctx.forecast.balancePoints;
  balanceChart?.destroy();

  // Datum allein reicht nicht: an einem Tag können mehrere Buchungen liegen,
  // von denen nur eine den Extremwert trägt.
  const isMin = (point) => point.date === ctx.stats.min.date && point.balance === ctx.stats.min.balance;
  const isMax = (point) => point.date === ctx.stats.max.date && point.balance === ctx.stats.max.balance;
  const highlight = (point) => isMin(point) || isMax(point);

  balanceChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: points.map((p) => fmtDate(p.date)),
      datasets: [{
        label: 'Saldo',
        data: points.map((p) => p.balance),
        borderColor: '#3a6ea5',
        backgroundColor: 'rgba(58,110,165,.12)',
        fill: true,
        stepped: true,
        pointRadius: points.map((p) => (highlight(p) ? 5 : 0)),
        pointBackgroundColor: points.map((p) => (isMin(p) ? '#c0453c' : '#2f8f56')),
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (item) => money(item.parsed.y) } },
      },
      scales: {
        x: { ticks: { maxTicksLimit: 12, autoSkip: true } },
        y: { ticks: { callback: (value) => money(value) } },
      },
    },
  });
}

/** Gestapelte Monatsbalken je Kategorie (Einnahmen positiv, Ausgaben negativ). */
function drawMonthChart(root, ctx, byId) {
  const canvas = root.querySelector('#chart-months');
  monthChart?.destroy();

  // Je nach Schalter auf die Oberkategorie zusammenfassen oder fein aufschlüsseln.
  const bucketOf = (key) => (groupByRoot && key !== '_none'
    ? rootIdOf(ctx.state.categories, key) ?? key
    : key);

  const sums = new Map();   // bucket -> Werte je Monat
  ctx.months.forEach((month, index) => {
    for (const [key, value] of Object.entries(month.byCategory)) {
      const bucket = bucketOf(key);
      if (!sums.has(bucket)) sums.set(bucket, new Array(ctx.months.length).fill(0));
      sums.get(bucket)[index] += value;
    }
  });

  const order = [...ctx.state.categories.map((c) => c.id), '_none'].filter((key) => sums.has(key));

  monthChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ctx.months.map((m) => monthLabel(m.month)),
      datasets: order.map((key) => ({
        label: key === '_none' ? 'ohne Kategorie' : pathOf(ctx.state.categories, key) || key,
        data: sums.get(key).map((v) => Math.round(v * 100) / 100),
        backgroundColor: key === '_none' ? '#9aa4b0' : byId.get(key)?.color ?? '#9aa4b0',
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { tooltip: { callbacks: { label: (item) => `${item.dataset.label}: ${money(item.parsed.y)}` } } },
      scales: {
        x: { stacked: true },
        y: { stacked: true, ticks: { callback: (value) => money(value) } },
      },
    },
  });
}
