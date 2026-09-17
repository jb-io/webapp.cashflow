/**
 * Kontoverlauf als Stufenlinie — der Saldo springt mit jeder Buchung und
 * verläuft dazwischen waagerecht; eine gerade Verbindung würde Werte
 * behaupten, die es nie gab.
 *
 * Eine Reihe, also keine Legende (der Titel benennt sie). Punkte sitzen nur
 * auf Tief- und Höchststand, jeweils zusätzlich beschriftet — Farbe allein
 * trägt die Aussage nicht.
 */
import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  CategoryScale, Chart, Filler, LinearScale, LineElement, PointElement, Tooltip,
} from 'chart.js';

import { day, money, moneyShort } from '../format.ts';
import { chartTheme, useThemeTick, withAlpha } from './theme.ts';
import type { BalancePoint, Forecast, Stats } from '../../core/types.ts';

interface Props { forecast: Forecast; stats: Stats; }

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

export default function BalanceChart({ forecast, stats }: Props) {
  const tick = useThemeTick();

  const { data, options } = useMemo(() => {
    const theme = chartTheme();
    const points = forecast.balancePoints;

    const isMin = (p: BalancePoint) => p.date === stats.min.date && p.balance === stats.min.balance;
    const isMax = (p: BalancePoint) => p.date === stats.max.date && p.balance === stats.max.balance;

    return {
      data: {
        labels: points.map((p) => day(p.date)),
        datasets: [{
          label: 'Saldo',
          data: points.map((p) => p.balance),
          borderColor: theme.accent,
          borderWidth: 2,
          backgroundColor: withAlpha(theme.accent, 0.12),
          fill: 'origin' as const,
          stepped: 'before' as const,
          pointRadius: points.map((p) => (isMin(p) || isMax(p) ? 5 : 0)),
          pointHoverRadius: points.map((p) => (isMin(p) || isMax(p) ? 7 : 4)),
          pointBackgroundColor: points.map((p) => (isMin(p) ? theme.neg : theme.pos)),
          pointBorderColor: theme.surface,
          pointBorderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.text,
            padding: 10,
            displayColors: false,
            callbacks: { label: (item: { parsed: { y: number } }) => `Saldo ${money(item.parsed.y)}` },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { color: theme.grid },
            ticks: { color: theme.faint, maxTicksLimit: 7, autoSkip: true, maxRotation: 0, font: { size: 11 } },
          },
          y: {
            grid: { color: theme.grid, drawTicks: false },
            border: { display: false },
            ticks: {
              color: theme.faint,
              callback: (value: string | number) => moneyShort(Number(value)),
              font: { size: 11 },
              padding: 6,
            },
          },
        },
      },
    };
  }, [forecast, stats, tick]);

  return (
    <div className="chart-box">
      {/* Chart.js-Optionen sind über die Rückrufe zu weit gefasst, um sie hier
          strukturell zu typisieren — die Werte darin sind oben geprüft. */}
      <Line data={data} options={options as never} />
    </div>
  );
}
