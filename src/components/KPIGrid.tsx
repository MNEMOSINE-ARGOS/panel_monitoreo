import React from 'react';
import { KPIStats } from '../types';

interface KPIGridProps {
  stats: KPIStats;
}

// Paleta Arg.Os: positivo = teal, negativo = rosa. Los números grandes usan el color de marca;
// el texto pequeño se queda en neutros para mantener contraste.
const TEAL = '#00A5A5';
const PINK = '#D81B60';

const sentimentLabel = (score: number) => {
  if (score >= 40) return 'Reputación fuerte';
  if (score >= 10) return 'Reputación favorable';
  if (score >= -10) return 'Reputación neutral';
  if (score >= -30) return 'Bajo observación';
  return 'Riesgo reputacional';
};

const n = (v: number | undefined) => (v || 0).toLocaleString('es-MX');

function Cell({ id, label, children, note }: { id?: string; label: string; children: React.ReactNode; note: React.ReactNode }) {
  return (
    <div id={id} className="bg-white dark:bg-slate-900 p-5 sm:p-6 flex flex-col gap-1.5 min-w-0">
      <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-[2.5rem] leading-none font-semibold tracking-[-0.035em] tabular-nums">{children}</dd>
      <dd className="text-sm text-slate-500 dark:text-slate-400 mt-1">{note}</dd>
    </div>
  );
}

export const KPIGrid: React.FC<KPIGridProps> = ({ stats }) => {
  const score = stats.netSentimentScore;
  const scoreText = `${score > 0 ? '+' : ''}${score}%`;

  return (
    <section aria-label="Indicadores clave">
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden rounded-3xl border border-slate-200/70 dark:border-slate-800/70 bg-slate-200/70 dark:bg-slate-800/70 shadow-sm shadow-slate-900/[0.03]">
        <Cell id="kpi-card-total-menciones" label="Menciones" note={`${n(stats.mediosUnicos)} medios`}>
          {n(stats.totalMenciones)}
        </Cell>

        <Cell
          id="kpi-card-net-sentiment"
          label="Sentimiento neto"
          note={
            <span className="block">
              <span className="block mb-2.5">{sentimentLabel(score)}</span>
              <span
                className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                role="img"
                aria-label={`${stats.positivePct}% positivas, ${stats.neutralPct}% neutrales, ${stats.negativePct}% negativas`}
              >
                <span style={{ width: `${stats.positivePct}%`, background: TEAL }} />
                <span style={{ width: `${stats.neutralPct}%` }} className="bg-slate-300 dark:bg-slate-600" />
                <span style={{ width: `${stats.negativePct}%`, background: PINK }} />
              </span>
            </span>
          }
        >
          <span style={{ color: score >= 0 ? TEAL : PINK }}>{scoreText}</span>
        </Cell>

        <Cell id="kpi-card-positivas" label="Positivas" note={`${stats.positivePct}% del total`}>
          <span style={{ color: TEAL }}>{n(stats.positivas)}</span>
        </Cell>

        <Cell
          id="kpi-card-negativas"
          label="Negativas"
          note={`${stats.negativePct}% del total · ${n(stats.neutrales)} neutrales`}
        >
          <span style={{ color: PINK }}>{n(stats.negativas)}</span>
        </Cell>
      </dl>
    </section>
  );
};
