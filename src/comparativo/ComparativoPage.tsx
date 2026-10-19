import { useEffect, useMemo, useState } from 'react';
import ArgosLogo from '../components/ArgosLogo';
import {
  CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

// Página pública e independiente del dashboard: no usa App, AuthContext ni repository.
// URL: /comparativo?actores=Nombre A|Nombre B&periodo=30   (periodo: 7 | 30 | 90)

interface DayPoint {
  fecha: string;
  positivas: number;
  negativas: number;
  neutras: number;
  sinCalificar: number;
  totales: number;
  balance: number;
  balanceAcumulado: number;
}
interface BreakdownItem {
  nombre: string;
  positivas: number;
  negativas: number;
  neutras: number;
  totales: number;
}
interface Nota {
  fecha: string;
  titulo: string;
  medio: string;
  reportero: string;
  tema: string;
  tipo: string;
  resumen: string;
  link: string | null;
}
interface ActorSeries {
  actor: string;
  notasPositivas: Nota[];
  notasNegativas: Nota[];
  temasPositivos: BreakdownItem[];
  temasNegativos: BreakdownItem[];
  mediosTop: BreakdownItem[];
  totales: { positivas: number; negativas: number; neutras: number; sinCalificar: number; totales: number; balance: number };
  serie: DayPoint[];
}
interface ComparativoData {
  dias: number;
  startDate: string;
  endDate: string;
  actores: ActorSeries[];
  noEncontrados: Array<{ solicitado: string; sugerencias: string[] }>;
}

const PERIODOS = [
  { dias: 7, label: '7d', aria: 'Últimos 7 días' },
  { dias: 30, label: '30d', aria: 'Últimos 30 días' },
  { dias: 90, label: '90d', aria: 'Últimos 90 días' },
];
// Actor colors come from the Arg.Os logo: teal, pink, blue (+ amber as 4th).
const ACTOR_COLORS = ['#00A5A5', '#D81B60', '#0E71AF', '#B8860B']; // paleta del logo Arg.Os
const SENT_COLORS = { positivas: '#16a34a', negativas: '#dc2626', neutras: '#64748b', totales: '#0E71AF' };
const nf = new Intl.NumberFormat('es-MX');

const CARD = 'rounded-3xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 shadow-sm shadow-slate-900/[0.03]';
const MUTED = 'text-slate-500 dark:text-slate-400';

function readUrl() {
  const p = new URLSearchParams(window.location.search);
  const actores = (p.get('actores') || '').split('|').map(s => s.trim()).filter(Boolean);
  const raw = Number(p.get('periodo'));
  const periodo = [7, 30, 90].includes(raw) ? raw : 30;
  return { actores, periodo };
}

const fmtDay = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};
const fmtFull = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};
const pct = (n: number, total: number) => (total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '—');

function ActorDot({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} aria-hidden="true" />;
}

function ChartCard({ title, explain, children, tall }: {
  title: string; explain: string; children: React.ReactNode; tall?: boolean;
}) {
  return (
    <section className={`${CARD} p-4 sm:p-6`}>
      <h2 className="text-base sm:text-lg font-bold tracking-tight">{title}</h2>
      <p className={`text-sm ${MUTED} mt-0.5 mb-4`}>{explain}</p>
      <div className={tall ? 'h-72 sm:h-96' : 'h-64 sm:h-80'}>{children}</div>
    </section>
  );
}

type LineDef = { key: string; name: string; color: string; dash?: string };

function LinesChart({ data, lines, dark, zeroLine, width = 3.5 }: {
  data: Array<Record<string, number | string>>;
  lines: LineDef[];
  dark: boolean;
  zeroLine?: boolean;
  width?: number;
}) {
  const ink = dark ? '#e2e8f0' : '#334155';
  const tick = { fontSize: 12, fill: dark ? '#cbd5e1' : '#475569' };
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.3} />
        <XAxis dataKey="fecha" tickFormatter={fmtDay} tick={tick} stroke="#94a3b8" minTickGap={24} />
        <YAxis tick={tick} stroke="#94a3b8" allowDecimals={false} width={44} />
        {zeroLine && <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1.5} />}
        <Tooltip
          labelFormatter={(v) => fmtFull(String(v))}
          contentStyle={{
            background: dark ? '#0f172a' : '#ffffff',
            border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`,
            borderRadius: 12, fontSize: 13,
          }}
          labelStyle={{ color: dark ? '#f1f5f9' : '#0f172a', fontWeight: 700 }}
          itemStyle={{ color: ink }}
        />
        <Legend
          wrapperStyle={{ fontSize: 13, paddingTop: 8 }}
          formatter={(v) => <span style={{ color: ink, fontWeight: 600 }}>{v}</span>}
        />
        {lines.map(l => (
          <Line key={l.key} type="monotone" dataKey={l.key} name={l.name}
            stroke={l.color} strokeWidth={width} strokeDasharray={l.dash} strokeLinecap="round"
            dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Barra apilada positivas / neutras / negativas (proporcional al total) */
function SentimentBar({ p, n, g, className = 'h-2' }: { p: number; n: number; g: number; className?: string }) {
  const total = p + n + g;
  if (total === 0) return <div className={`${className} rounded-full bg-slate-200 dark:bg-slate-800`} />;
  return (
    <div className={`${className} flex overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800`}
      role="img" aria-label={`${p} positivas, ${n} neutras, ${g} negativas`}>
      <div style={{ width: `${(p / total) * 100}%`, background: SENT_COLORS.positivas }} />
      <div style={{ width: `${(n / total) * 100}%`, background: '#94a3b8' }} />
      <div style={{ width: `${(g / total) * 100}%`, background: SENT_COLORS.negativas }} />
    </div>
  );
}

function SummaryTable({ actores }: { actores: ActorSeries[] }) {
  const hasSin = actores.some(a => a.totales.sinCalificar > 0);
  const maxBal = Math.max(...actores.map(a => a.totales.balance));
  const minBal = Math.min(...actores.map(a => a.totales.balance));
  const th = 'px-3 py-2 text-right font-semibold whitespace-nowrap';
  const td = 'px-3 py-3 text-right tabular-nums';
  return (
    <section className={`${CARD} overflow-hidden`}>
      <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3">
        <h2 className="text-base sm:text-lg font-bold tracking-tight">Resumen del periodo</h2>
        <p className={`text-sm ${MUTED} mt-0.5`}>
          Notas de cada actor según su tono. Balance = neutras + positivas − negativas: más alto, mejor cobertura.
          {hasSin && ' Las notas sin calificar cuentan en el total, no en el balance.'}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm sm:text-base">
          <thead className={`text-xs ${MUTED} border-y border-slate-200 dark:border-slate-800`}>
            <tr>
              <th scope="col" className="px-4 sm:px-6 py-2 text-left font-semibold">Actor</th>
              <th scope="col" className={th}>Positivas</th>
              <th scope="col" className={th}>Neutras</th>
              <th scope="col" className={th}>Negativas</th>
              {hasSin && <th scope="col" className={th}>Sin calificar</th>}
              <th scope="col" className={th}>Totales</th>
              <th scope="col" className={th}>% negativas</th>
              <th scope="col" className={`${th} sm:pr-6`}>Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {actores.map((a, i) => {
              const t = a.totales;
              const best = t.balance === maxBal && maxBal !== minBal;
              return (
                <tr key={a.actor}>
                  <th scope="row" className="px-4 sm:px-6 py-3 text-left font-semibold">
                    <span className="inline-flex items-center gap-2"><ActorDot color={ACTOR_COLORS[i % ACTOR_COLORS.length]} />{a.actor}</span>
                  </th>
                  <td className={`${td} text-slate-600 dark:text-slate-300`}>{nf.format(t.positivas)}</td>
                  <td className={`${td} text-slate-600 dark:text-slate-300`}>{nf.format(t.neutras)}</td>
                  <td className={`${td} text-slate-600 dark:text-slate-300`}>{nf.format(t.negativas)}</td>
                  {hasSin && <td className={`${td} ${MUTED}`}>{nf.format(t.sinCalificar)}</td>}
                  <td className={`${td} font-semibold`}>{nf.format(t.totales)}</td>
                  <td className={td}>{pct(t.negativas, t.totales)}</td>
                  <td className={`${td} sm:pr-6 font-bold text-slate-600 dark:text-slate-300`}>
                    <span className="inline-flex items-center justify-end gap-1.5">
                      {best && (
                        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-amber-400 stroke-amber-500" strokeWidth="1.5" strokeLinejoin="round" role="img" aria-label="Balance más alto">
                          <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8L12 2.5z" />
                        </svg>
                      )}
                      {nf.format(t.balance)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Lista con barras horizontales: una métrica (temas) o mezcla de sentimiento (medios) */
function RankList({ title, subtitle, items, mode, empty }: {
  title: string;
  subtitle: string;
  items: BreakdownItem[];
  mode: 'positivas' | 'negativas' | 'mezcla';
  empty: string;
}) {
  const value = (i: BreakdownItem) => (mode === 'mezcla' ? i.totales : i[mode]);
  const max = Math.max(1, ...items.map(value));
  const color = mode === 'positivas' ? SENT_COLORS.positivas : SENT_COLORS.negativas;
  return (
    <div className="min-w-0">
      <h4 className="text-sm font-bold">{title}</h4>
      <p className={`text-xs ${MUTED} mb-3`}>{subtitle}</p>
      {items.length === 0 ? (
        <p className={`text-sm ${MUTED}`}>{empty}</p>
      ) : (
        <ol className="space-y-2.5">
          {items.map(i => (
            <li key={i.nombre}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate" title={i.nombre}>{i.nombre}</span>
                <span className="tabular-nums font-semibold shrink-0">{nf.format(value(i))}</span>
              </div>
              {mode === 'mezcla' ? (
                <div className="mt-1" style={{ width: `${(i.totales / max) * 100}%`, minWidth: '12%' }}>
                  <SentimentBar p={i.positivas} n={i.neutras} g={i.negativas} />
                </div>
              ) : (
                <div className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full" style={{ width: `${(value(i) / max) * 100}%`, background: color }} />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function NotesList({ title, explain, notas, tone }: {
  title: string; explain: string; notas: Nota[]; tone: 'pos' | 'neg';
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const accent = tone === 'pos' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400';
  const shortDate = (iso: string) => {
    const [, m, d] = iso.split('-');
    return d && m ? `${d}/${m}` : iso;
  };
  return (
    <details className="group min-w-0 rounded-xl border border-slate-200 dark:border-slate-800">
      <summary className="flex cursor-pointer select-none list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className={`block text-sm font-bold ${accent}`}>{title} <span className="tabular-nums">({notas.length})</span></span>
          <span className={`block text-xs ${MUTED}`}>{explain}</span>
        </span>
        <span aria-hidden="true" className={`${MUTED} transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none`}>›</span>
      </summary>
      <div className="px-2 py-2 border-t border-slate-100 dark:border-slate-800">
        {notas.length === 0 ? (
          <p className={`px-2 py-1 text-sm ${MUTED}`}>Sin notas en este periodo.</p>
        ) : (
          <ol className="space-y-0.5">
            {notas.map((n, i) => {
              const meta = [n.fecha && fmtFull(n.fecha), n.medio, n.reportero, n.tema, n.tipo].filter(Boolean);
              const showResumen = n.resumen && n.resumen !== n.titulo;
              const open = openIdx === i;
              return (
                <li key={`${n.fecha}-${i}`} className="group/row rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 focus-within:bg-slate-50 dark:focus-within:bg-slate-800/60">
                  {/* Fila compacta: fecha · título en una línea · medio. Pasar el cursor, enfocar o tocar abre el detalle. */}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={open}
                    onClick={() => setOpenIdx(open ? null : i)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenIdx(open ? null : i); }
                    }}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  >
                    <span className={`w-11 shrink-0 text-xs tabular-nums ${MUTED}`}>{n.fecha ? shortDate(n.fecha) : '—'}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{n.titulo}</span>
                    {n.medio && <span className={`hidden max-w-[8rem] shrink-0 truncate text-xs sm:block ${MUTED}`}>{n.medio}</span>}
                  </div>
                  <div
                    className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none group-hover/row:grid-rows-[1fr] group-focus-within/row:grid-rows-[1fr] ${
                      open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="space-y-1.5 px-2.5 pb-3 pl-[4.25rem] pr-3">
                        {n.link ? (
                          <a href={n.link} target="_blank" rel="noopener noreferrer"
                            className="block text-sm font-semibold leading-snug hover:underline underline-offset-2">
                            {n.titulo} <span aria-hidden="true" className={MUTED}>↗</span>
                            <span className="sr-only"> (abre en otra pestaña)</span>
                          </a>
                        ) : (
                          <p className="text-sm font-semibold leading-snug">{n.titulo}</p>
                        )}
                        <p className={`text-xs ${MUTED}`}>{meta.join(' · ')}</p>
                        {showResumen && <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{n.resumen}</p>}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </details>
  );
}

function ActorDetail({ actor, color, dark }: { actor: ActorSeries; color: string; dark: boolean }) {
  return (
    <section className={`${CARD} overflow-hidden`} aria-label={`Detalle de ${actor.actor}`}>
      <div className="p-4 sm:p-6 space-y-8">
        <div>
          <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight inline-flex items-center gap-3">
            <ActorDot color={color} />{actor.actor}
          </h3>
        </div>

        <div>
          <h4 className="text-base font-bold">Cobertura mediática desagregada</h4>
          <p className={`text-sm ${MUTED} mt-0.5 mb-4`}>Notas por día según su tono; "Totales" suma todas las del día.</p>
          <div className="h-72 sm:h-80">
            <LinesChart dark={dark} width={3} data={actor.serie as unknown as Array<Record<string, number | string>>} lines={[
              { key: 'positivas', name: 'Positivas', color: SENT_COLORS.positivas },
              { key: 'negativas', name: 'Negativas', color: SENT_COLORS.negativas },
              { key: 'neutras', name: 'Neutras', color: SENT_COLORS.neutras, dash: '6 5' },
              { key: 'totales', name: 'Totales', color: SENT_COLORS.totales },
            ]} />
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3 pt-6 border-t border-slate-200 dark:border-slate-800">
          <RankList title="Temas con más cobertura positiva" subtitle="Temas donde más lo mencionan bien" mode="positivas"
            items={actor.temasPositivos} empty="Sin notas positivas con tema en este periodo." />
          <RankList title="Temas con más cobertura negativa" subtitle="Temas donde más lo critican" mode="negativas"
            items={actor.temasNegativos} empty="Sin notas negativas con tema en este periodo." />
          <div className="md:col-span-2 xl:col-span-1">
            <RankList title="Medios que más lo cubren" subtitle="Verde positiva · gris neutra · rojo negativa" mode="mezcla"
              items={actor.mediosTop} empty="Sin medios registrados en este periodo." />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 items-start pt-6 border-t border-slate-200 dark:border-slate-800">
          <NotesList tone="pos" title="Últimas 10 notas positivas" explain="Las más recientes del periodo; el título abre la nota." notas={actor.notasPositivas} />
          <NotesList tone="neg" title="Últimas 10 notas negativas" explain="Las más recientes del periodo; el título abre la nota." notas={actor.notasNegativas} />
        </div>
      </div>
    </section>
  );
}

/** Temas en miniatura para la tarjeta: los 3 principales de un tono, separados por comas */
function MiniTopics({ items, tone }: { items: BreakdownItem[]; tone: 'pos' | 'neg' }) {
  const names = items.slice(0, 3).map(i => i.nombre);
  const accent = tone === 'pos' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400';
  return (
    <p className="text-xs leading-snug flex gap-1.5" title={names.join(', ')}>
      <span className={`${accent} font-bold shrink-0`} aria-label={tone === 'pos' ? 'Temas positivos' : 'Temas negativos'}>
        {tone === 'pos' ? '▲' : '▼'}
      </span>
      <span className={`${names.length ? 'text-slate-700 dark:text-slate-200' : MUTED} line-clamp-2`}>
        {names.length ? names.join(', ') : 'Sin temas'}
      </span>
    </p>
  );
}

export default function ComparativoPage() {
  const [{ actores, periodo }, setQuery] = useState(readUrl);
  const [data, setData] = useState<ComparativoData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    const root = document.documentElement;
    // Short color transition so the light/dark switch isn't a brightness jump
    root.classList.add('cmp-theme-fade');
    window.setTimeout(() => root.classList.remove('cmp-theme-fade'), 250);
    root.classList.toggle('dark', next);
    root.style.colorScheme = next ? 'dark' : 'light';
    try { localStorage.setItem('cmp_theme', next ? 'dark' : 'light'); } catch { /* sin almacenamiento */ }
  };

  useEffect(() => {
    const onPop = () => setQuery(readUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const actoresKey = actores.join('|');
  useEffect(() => {
    if (actores.length < 2 || actores.length > 4) {
      setData(null);
      setError('Indica de 2 a 4 actores en la URL, separados por "|". Ejemplo: /comparativo?actores=Actor Uno|Actor Dos');
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ actores: actoresKey, periodo: String(periodo) });
    fetch(`/api/postgres/comparativo?${qs}`, { signal: ctrl.signal })
      .then(async r => {
        const json = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(json.error || `Error ${r.status}`);
        return json.data as ComparativoData;
      })
      .then(setData)
      .catch(e => { if (e.name !== 'AbortError') { setData(null); setError(e.message); } })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [actoresKey, periodo]);

  const setPeriodo = (dias: number) => {
    const p = new URLSearchParams(window.location.search);
    p.set('periodo', String(dias));
    window.history.pushState(null, '', `${window.location.pathname}?${p}`);
    setQuery(readUrl());
  };

  // One row per day with a column per actor, for the comparative charts
  const merged = useMemo(() => {
    if (!data || data.actores.length === 0) return { balance: [], acumulado: [] };
    const base = data.actores[0].serie;
    const row = (field: 'balance' | 'balanceAcumulado') =>
      base.map((d, i) => {
        const r: Record<string, number | string> = { fecha: d.fecha };
        data.actores.forEach((a, j) => { r["a" + j] = a.serie[i][field]; });
        return r;
      });
    return { balance: row('balance'), acumulado: row('balanceAcumulado') };
  }, [data]);

  const actorLines = (data?.actores || []).map((a, i) => ({
    key: "a" + i, name: a.actor, color: ACTOR_COLORS[i % ACTOR_COLORS.length],
  }));

  const pressable = 'transition-[background-color,color,transform] duration-100 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <header className="sticky top-0 z-20 border-b border-slate-200/70 dark:border-slate-800/70 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <ArgosLogo className="h-6" />
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-4" role="group" aria-label="Periodo">
              {PERIODOS.map(p => (
                <button key={p.dias} onClick={() => setPeriodo(p.dias)} aria-pressed={periodo === p.dias} aria-label={p.aria}
                  className={`py-1.5 text-sm font-bold tabular-nums border-b-2 ${pressable} ${
                    periodo === p.dias
                      ? 'border-[#00A5A5] text-slate-900 dark:text-slate-100'
                      : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <button onClick={toggleTheme} aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              title={dark ? 'Tema claro' : 'Tema oscuro'}
              className={`h-9 w-9 grid place-items-center rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 ${pressable}`}>
              <span aria-hidden="true">{dark ? '☀' : '☾'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-8 pb-16 space-y-8">
        <div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-[-0.025em] leading-tight">Comparativo de cobertura mediática</h1>
          {data && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="text-sm font-semibold tabular-nums rounded-full bg-slate-200/70 dark:bg-slate-800 px-3 py-1">
                Del {fmtFull(data.startDate)} al {fmtFull(data.endDate)}
              </p>
              <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
                {data.actores.map((a, i) => (
                  <li key={a.actor} className="inline-flex items-center gap-2 text-sm font-semibold">
                    <ActorDot color={ACTOR_COLORS[i % ACTOR_COLORS.length]} />{a.actor}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {error && (
          <div role="alert" className="rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-800 dark:text-rose-200">
            {error}
          </div>
        )}
        {loading && <p role="status" className={`text-sm ${MUTED}`}>Cargando…</p>}

        {data && data.noEncontrados.length > 0 && (
          <div role="alert" className="rounded-xl border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-900 dark:text-amber-200 space-y-2">
            {data.noEncontrados.map(n => (
              <div key={n.solicitado}>
                <p>No se encontró el actor <strong>«{n.solicitado}»</strong>. El nombre debe coincidir con el de la base de datos.</p>
                {n.sugerencias.length > 0 && (
                  <p className="mt-1">Nombres parecidos: {n.sugerencias.map(s => <code key={s} className="mr-2 px-1 rounded bg-amber-100 dark:bg-amber-900/50">{s}</code>)}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {data && data.actores.length === 1 && (
          <div role="status" className={`${CARD} p-4 text-sm text-slate-600 dark:text-slate-300`}>
            Solo se encontró un actor ({data.actores[0].actor}). Corrige el otro nombre para ver el comparativo.
          </div>
        )}

        {data && data.actores.length >= 2 && (() => {
          const grand = data.actores.reduce((acc, a) => acc + a.totales.totales, 0);
          const colsClass = data.actores.length === 2 ? 'sm:grid-cols-2'
            : data.actores.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4';
          return (
            <div className={`space-y-8 transition-opacity duration-200 ${loading ? 'opacity-50' : ''}`}>
              <div className={`grid gap-3 ${colsClass}`}>
                {data.actores.map((a, i) => (
                  <div key={a.actor} className={`${CARD} p-4 sm:p-5 flex flex-col`}>
                    <p className="text-sm font-bold leading-tight flex items-start gap-2">
                      <span className="mt-1"><ActorDot color={ACTOR_COLORS[i % ACTOR_COLORS.length]} /></span>
                      <span>{a.actor}</span>
                    </p>
                    <div className="mt-2.5 space-y-1.5">
                      <MiniTopics items={a.temasPositivos} tone="pos" />
                      <MiniTopics items={a.temasNegativos} tone="neg" />
                    </div>
                    <p className="mt-3 text-5xl font-extrabold tabular-nums tracking-tight" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{nf.format(a.totales.totales)}</p>
                    <p className={`text-xs ${MUTED}`}>notas · {pct(a.totales.totales, grand)} de la conversación</p>
                    <div className="mt-3"><SentimentBar p={a.totales.positivas} n={a.totales.neutras + a.totales.sinCalificar} g={a.totales.negativas} className="h-2.5" /></div>
                    <p className="mt-2 text-sm flex flex-wrap gap-x-3 tabular-nums font-semibold">
                      <span className="text-green-700 dark:text-green-400">▲ {nf.format(a.totales.positivas)}</span>
                      <span className="text-slate-600 dark:text-slate-300">● {nf.format(a.totales.neutras)}</span>
                      <span className="text-red-700 dark:text-red-400">▼ {nf.format(a.totales.negativas)}</span>
                    </p>
                    <p className="mt-2 text-sm">Balance <strong className="tabular-nums">{nf.format(a.totales.balance)}</strong></p>
                  </div>
                ))}
              </div>

              {grand === 0 && (
                <p className={`${CARD} p-4 text-sm text-slate-600 dark:text-slate-300`}>
                  Ningún actor tiene notas en este periodo. Prueba con un periodo más largo.
                </p>
              )}

              <SummaryTable actores={data.actores} />

              <ChartCard tall title="Balance de cobertura mediática"
                explain="Resultado de cada día (neutras + positivas − negativas). Más arriba, mejor cobertura ese día.">
                <LinesChart data={merged.balance} lines={actorLines} dark={dark} zeroLine />
              </ChartCard>
              <ChartCard tall title="Balance acumulado de cobertura mediática"
                explain="Suma día a día del balance. La línea que sube más rápido va ganando terreno.">
                <LinesChart data={merged.acumulado} lines={actorLines} dark={dark} zeroLine />
              </ChartCard>

              <h2 className="pt-2 text-xl font-extrabold tracking-tight">Detalle por actor</h2>
              {data.actores.map((a, i) => (
                <ActorDetail key={a.actor} actor={a} color={ACTOR_COLORS[i % ACTOR_COLORS.length]} dark={dark} />
              ))}

              <p className={`text-xs ${MUTED}`}>
                El último día ({fmtFull(data.endDate)}) puede estar incompleto: las notas de hoy se siguen cargando.
              </p>
            </div>
          );
        })()}
      </main>
    </div>
  );
}
