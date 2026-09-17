/**
 * Monatssaldo nach Kategorie als gestapelte Balken: Einnahmen nach oben,
 * Ausgaben nach unten, Nulllinie als gemeinsame Basis.
 *
 * Ab neun Kategorien wird nicht weitergefärbt, sondern gebündelt — mehr Töne
 * lassen sich nicht mehr sicher unterscheiden. Die Legende ist immer da, die
 * Buchungsliste darunter ist die zugehörige Tabellenansicht.
 */
import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  BarElement, CategoryScale, Chart, Legend, LinearScale, Tooltip,
} from 'chart.js';

import { rootIdOf, pathOf } from '../../core/categories.js';
import { money, moneyShort, monthTick, NO_CATEGORY_COLOR } from '../format.js';
import { chartTheme, useThemeTick } from './theme.js';

Chart.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const MAX_SERIES = 8;

/** @returns {{key,label,color,values:number[]}[]} gebündelt und sortiert */
export function monthlySeries(months, categories, groupByRoot) {
  const sums = new Map();
  months.forEach((month, index) => {
    for (const [key, value] of Object.entries(month.byCategory)) {
      const bucket = groupByRoot && key !== '_none' ? (rootIdOf(categories, key) ?? key) : key;
      if (!sums.has(bucket)) sums.set(bucket, new Array(months.length).fill(0));
      sums.get(bucket)[index] += value;
    }
  });

  const series = [...sums.entries()].map(([key, values]) => {
    const category = categories.find((c) => c.id === key);
    return {
      key,
      label: key === '_none' ? 'ohne Kategorie' : (groupByRoot ? category?.name : pathOf(categories, key)) || key,
      color: category?.color ?? NO_CATEGORY_COLOR,
      values,
      weight: values.reduce((sum, v) => sum + Math.abs(v), 0),
    };
  }).sort((a, b) => b.weight - a.weight);

  if (series.length <= MAX_SERIES) return series;

  const rest = series.slice(MAX_SERIES - 1);
  const folded = {
    key: '_rest',
    label: `Übrige (${rest.length})`,
    color: NO_CATEGORY_COLOR,
    values: months.map((_, i) => rest.reduce((sum, s) => sum + s.values[i], 0)),
  };
  return [...series.slice(0, MAX_SERIES - 1), folded];
}

export default function MonthlyChart({ months, categories, groupByRoot }) {
  const tick = useThemeTick();
  const series = useMemo(
    () => monthlySeries(months, categories, groupByRoot),
    [months, categories, groupByRoot],
  );

  const { data, options } = useMemo(() => {
    const theme = chartTheme();
    return {
      data: {
        labels: months.map((m) => monthTick(m.month)),
        datasets: series.map((s) => ({
          label: s.label,
          data: s.values.map((v) => Math.round(v * 100) / 100),
          backgroundColor: s.color,
          // 2px Fläche zwischen den Segmenten, damit Stapel lesbar bleiben
          borderColor: theme.surface,
          borderWidth: { top: 2, bottom: 2, left: 0, right: 0 },
          borderRadius: 4,
          borderSkipped: false,
          maxBarThickness: 44,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'nearest', intersect: true },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.text,
            padding: 10,
            callbacks: { label: (item) => `${item.dataset.label}: ${money(item.parsed.y)}` },
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            border: { color: theme.grid },
            ticks: { color: theme.faint, maxRotation: 0, autoSkip: true, font: { size: 11 } },
          },
          y: {
            stacked: true,
            grid: { color: theme.grid, drawTicks: false },
            border: { display: false },
            ticks: { color: theme.faint, callback: (value) => moneyShort(value), font: { size: 11 }, padding: 6 },
          },
        },
      },
    };
  }, [months, series, tick]);

  return (
    <>
      <div className="chart-box">
        <Bar data={data} options={options} />
      </div>
      <div className="legend">
        {series.map((s) => (
          <span key={s.key}>
            <span className="dot" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </>
  );
}
