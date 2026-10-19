import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import {
  PoliticalTimelinePoint,
  PoliticalThemeBreakdown,
  MediaStanceBreakdown,
  ActorInvolvementBreakdown,
  PerspectiveDeepDive,
  FilterState
} from '../types';
import { useTheme } from '../context/ThemeContext';
import {
  Activity,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Flame,
  Scale,
  Landmark,
  Building2,
  Newspaper,
  Users,
  Tag,
  BarChart3,
  Calendar,
  Layers,
  ArrowRight,
  Info,
  CheckCircle2,
  HelpCircle,
  Award,
  Download,
  RefreshCw
} from 'lucide-react';

export type PerspectiveMode = 'actores' | 'medios' | 'temas';

interface PerspectiveEntitySummary {
  name: string;
  total: number;
  pos: number;
  neu: number;
  neg: number;
  netSentiment: number;
}

interface PoliticalAnalysisChartsProps {
  mode: PerspectiveMode;
  deepDive: PerspectiveDeepDive;
  allEntities?: PerspectiveEntitySummary[];
  dateRange?: { preset: string; start: string; end: string };
  filters?: FilterState;
  onSelectEntity?: (name: string) => void;
  onNavigateToGlobal?: () => void;
}

const COLOR_POS = '#10B981'; // Emerald positiva
const COLOR_NEU = '#94A3B8'; // Slate neutral
const COLOR_NEG = '#EF4444'; // Rose alerta/negativa
const COLOR_NET = '#06B6D4'; // Cyan línea neta
const PALETTE = ['#06B6D4', '#8B5CF6', '#F59E0B', '#EC4899', '#10B981', '#3B82F6', '#F97316', '#14B8A6'];

export const PoliticalAnalysisCharts: React.FC<PoliticalAnalysisChartsProps> = ({
  mode,
  deepDive,
  allEntities = [],
  dateRange,
  filters,
  onSelectEntity,
  onNavigateToGlobal
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [viewScope, setViewScope] = useState<'entity' | 'macro'>('entity');
  const [metricFilter, setMetricFilter] = useState<'all' | 'critical' | 'positive'>('all');

  // Compute calculated metrics
  const total = deepDive.total || 1;
  const posPct = Math.round((deepDive.pos / total) * 100);
  const negPct = Math.round((deepDive.neg / total) * 100);
  const neuPct = 100 - posPct - negPct;
  const netScore = deepDive.netSentiment;

  // Macro rankings for comparison
  const macroRankings = useMemo(() => {
    if (!allEntities || allEntities.length === 0) return { best: [], worst: [], highestVol: [] };
    const sortedByNet = [...allEntities].sort((a, b) => b.netSentiment - a.netSentiment);
    const sortedByNeg = [...allEntities].sort((a, b) => b.neg - a.neg);
    const sortedByVol = [...allEntities].sort((a, b) => b.total - a.total);

    return {
      best: sortedByNet.slice(0, 6),
      worst: sortedByNeg.slice(0, 6),
      highestVol: sortedByVol.slice(0, 8)
    };
  }, [allEntities]);

  // Timeline formatted data
  const formattedTimeline = useMemo(() => {
    const list = deepDive.timeline || [];
    return list.map((item) => {
      const parts = item.fecha.split('-');
      const shortFecha = parts.length === 3 ? `${parts[2]}/${parts[1]}` : item.fecha;
      return {
        ...item,
        shortFecha
      };
    });
  }, [deepDive.timeline]);

  // Tooltip custom style
  const tooltipStyle = {
    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    borderColor: isDark ? 'rgba(51, 65, 85, 0.8)' : 'rgba(226, 232, 240, 0.8)',
    borderRadius: '12px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
    color: isDark ? '#f8fafc' : '#0f172a',
    fontSize: '12px',
    backdropFilter: 'blur(8px)',
    padding: '10px 14px'
  };

  return (
    <div className="space-y-6">
      {/* View Switcher: Análisis de Entidad vs Panorama Político Macro */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-xl shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
            <Landmark className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Inteligencia Política & Análisis Gubernamental
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                {mode === 'actores' && 'Módulo 1: Actores'}
                {mode === 'medios' && 'Módulo 2: Medios'}
                {mode === 'temas' && 'Módulo 3: Temas'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Métricas reactivas al periodo ({dateRange?.preset || 'histórico'}) y filtros de cobertura seleccionados
            </p>
          </div>
        </div>

        {/* Scope Toggle: Entidad vs Macro */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewScope('entity')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewScope === 'entity'
                ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Perfil: {deepDive.name}</span>
          </button>

          <button
            type="button"
            onClick={() => setViewScope('macro')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewScope === 'macro'
                ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Panorama Comparativo ({allEntities.length})</span>
          </button>
        </div>
      </div>

      {viewScope === 'entity' ? (
        <>
          {/* Top KPI Cards: Indicadores Clave de Gobernabilidad y Clima Político */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Card 1: Balance Político / Favorabilidad Neta */}
            <div className="p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {mode === 'actores' && 'Balance Político Neto'}
                  {mode === 'medios' && 'Sesgo Editorial Neto'}
                  {mode === 'temas' && 'Consenso / Aceptación'}
                </span>
                <span
                  className={`p-1.5 rounded-lg text-xs font-bold ${
                    netScore >= 20
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : netScore <= -10
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {netScore >= 0 ? `+${netScore}%` : `${netScore}%`}
                </span>
              </div>
              <div className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-1">
                {netScore >= 0 ? `+${netScore}` : netScore} pts
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {netScore >= 30
                  ? 'Fuerte capital político y cobertura predominantemente favorable'
                  : netScore >= 0
                  ? 'Balance político estable con margen favorable moderado'
                  : 'Desgaste político y presión crítica en medios'}
              </p>
            </div>

            {/* Card 2: Tasa de Riesgo Político / Cobertura de Alerta */}
            <div className="p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-rose-500/20 bg-rose-500/5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {mode === 'actores' && 'Riesgo / Desgaste'}
                  {mode === 'medios' && 'Dureza Editorial'}
                  {mode === 'temas' && 'Conflictividad Social'}
                </span>
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 font-mono">
                  {negPct}%
                </span>
              </div>
              <div className="text-2xl font-black font-mono text-rose-700 dark:text-rose-400 mt-1">
                {deepDive.neg.toLocaleString()}{' '}
                <span className="text-xs font-normal text-rose-600/80">notas</span>
              </div>
              <p className="text-[11px] text-rose-600/90 dark:text-rose-400/90 mt-1">
                {negPct > 25
                  ? 'Alerta crítica: foco rojo que requiere contención o aclaración'
                  : negPct > 10
                  ? 'Nivel de crítica moderada dentro del margen habitual'
                  : 'Bajo nivel de conflicto o señalamientos negativos'}
              </p>
            </div>

            {/* Card 3: Cobertura Institucional / Favorable */}
            <div className="p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-emerald-500/20 bg-emerald-500/5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {mode === 'actores' && 'Logros / Afinidad'}
                  {mode === 'medios' && 'Cobertura Institucional'}
                  {mode === 'temas' && 'Opinión Favorable'}
                </span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {posPct}%
                </span>
              </div>
              <div className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                {deepDive.pos.toLocaleString()}{' '}
                <span className="text-xs font-normal text-emerald-600/80">notas</span>
              </div>
              <p className="text-[11px] text-emerald-600/90 dark:text-emerald-400/90 mt-1">
                Impactos positivos capitalizables en comunicación y posicionamiento
              </p>
            </div>

            {/* Card 4: Volumen e Intensidad en Medios */}
            <div className="p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Volumen Total
                </span>
                <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 font-mono">
                  100%
                </span>
              </div>
              <div className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-1">
                {deepDive.total.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-500">notas</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {mode === 'actores' && `${neuPct}% de cobertura neutral o meramente informativa`}
                {mode === 'medios' && `${neuPct}% de cobertura neutral informativa`}
                {mode === 'temas' && `${neuPct}% de notas informativas sin sesgo`}
              </p>
            </div>
          </div>

          {/* Gráfico 1: Evolución Temporal del Clima Político y Coyuntura */}
          <div className="p-5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-500" />
                  {mode === 'actores' && `Evolución Temporal del Clima Político: ${deepDive.name}`}
                  {mode === 'medios' && `Curva de Línea Editorial en el Tiempo: ${deepDive.name}`}
                  {mode === 'temas' && `Ciclo de Vida y Curva de Coyuntura: ${deepDive.name}`}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Barras de volumen apilado por sentimiento y línea de Balance Político Neto día a día
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" /> Positivas
                </span>
                <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-xs bg-slate-400" /> Neutrales
                </span>
                <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" /> Alertas (Crítica)
                </span>
                <span className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400 font-semibold">
                  <span className="w-3 h-0.5 bg-cyan-500 rounded-full" /> Balance Neto
                </span>
              </div>
            </div>

            {formattedTimeline.length > 0 ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={formattedTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} opacity={0.5} />
                    <XAxis
                      dataKey="shortFecha"
                      stroke={isDark ? '#94a3b8' : '#64748b'}
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke={isDark ? '#94a3b8' : '#64748b'}
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[-100, 100]}
                      stroke="#06b6d4"
                      fontSize={10}
                      tickLine={false}
                      unit="%"
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(val: any, name: any) => {
                        if (name === 'netSentiment') return [`${val}%`, 'Balance Neto'];
                        if (name === 'pos') return [val, 'Positivas'];
                        if (name === 'neu') return [val, 'Neutrales'];
                        if (name === 'neg') return [val, 'Alertas / Negativas'];
                        return [val, name];
                      }}
                    />
                    <Bar yAxisId="left" dataKey="pos" stackId="a" fill={COLOR_POS} radius={[0, 0, 0, 0]} />
                    <Bar yAxisId="left" dataKey="neu" stackId="a" fill={COLOR_NEU} radius={[0, 0, 0, 0]} />
                    <Bar yAxisId="left" dataKey="neg" stackId="a" fill={COLOR_NEG} radius={[3, 3, 0, 0]} />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="netSentiment"
                      stroke={COLOR_NET}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: COLOR_NET }}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                No hay serie temporal suficiente en este rango de fechas para generar la curva.
              </div>
            )}
          </div>

          {/* Gráfico 2 & Gráfico 3: Matriz de Ejes de Gobierno y Radar de Presión Mediática */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Gráfico 2: Matriz de Incidencia en Políticas Públicas y Ejes de Gobierno */}
            <div className="p-5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
              <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Tag className="w-4 h-4 text-cyan-500" />
                  {mode === 'actores' && 'Incidencia por Ejes de Gobierno y Temas'}
                  {mode === 'medios' && 'Temas de Gobierno más Fiscalizados'}
                  {mode === 'temas' && 'Subtemas y Vertientes de la Coyuntura'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Desglose temático con balance de favorabilidad y crítica pública
                </p>
              </div>

              {deepDive.politicalThemes && deepDive.politicalThemes.length > 0 ? (
                <div className="space-y-3">
                  {deepDive.politicalThemes.map((th) => {
                    const thTotal = th.total || 1;
                    const posP = Math.round((th.pos / thTotal) * 100);
                    const negP = Math.round((th.neg / thTotal) * 100);
                    const neuP = 100 - posP - negP;

                    return (
                      <div key={th.theme} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                            {th.theme}
                          </span>
                          <div className="flex items-center gap-2 font-mono">
                            <span className="text-slate-400 text-[11px]">{th.total} notas</span>
                            <span
                              className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                                th.netSentiment >= 20
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : th.netSentiment <= -15
                                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {th.netSentiment >= 0 ? `+${th.netSentiment}%` : `${th.netSentiment}%`}
                            </span>
                          </div>
                        </div>

                        {/* Stacked sentiment bar for this theme */}
                        <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-700">
                          <div style={{ width: `${posP}%` }} className="bg-emerald-500" title={`Positivas: ${posP}%`} />
                          <div style={{ width: `${neuP}%` }} className="bg-slate-400" title={`Neutrales: ${neuP}%`} />
                          <div style={{ width: `${negP}%` }} className="bg-rose-500" title={`Negativas: ${negP}%`} />
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span className="text-emerald-600 dark:text-emerald-400">+{th.pos} fav</span>
                          <span>{th.neu} neu</span>
                          <span className="text-rose-600 dark:text-rose-400">-{th.neg} alerta</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  Sin desglose temático registrado en este periodo.
                </div>
              )}
            </div>

            {/* Gráfico 3: Radar de Presión Mediática & Postura Editorial (o Actores Involucrados) */}
            <div className="p-5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
              <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  {mode === 'actores' ? (
                    <>
                      <Newspaper className="w-4 h-4 text-cyan-500" />
                      Radar de Presión Mediática & Sesgo por Medio
                    </>
                  ) : mode === 'medios' ? (
                    <>
                      <Users className="w-4 h-4 text-cyan-500" />
                      Tratamiento a Figuras y Actores Políticos
                    </>
                  ) : (
                    <>
                      <Users className="w-4 h-4 text-cyan-500" />
                      Actores Políticos Protagonistas en el Tema
                    </>
                  )}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {mode === 'actores' && 'Clasificación de medios por tono: afín, balanceado o crítico de fiscalización'}
                  {mode === 'medios' && 'Cómo trata este medio informativo a los principales gobernantes y funcionarios'}
                  {mode === 'temas' && 'Figuras gubernamentales y de oposición que absorben el debate público'}
                </p>
              </div>

              {mode === 'actores' ? (
                deepDive.mediaStance && deepDive.mediaStance.length > 0 ? (
                  <div className="space-y-3">
                    {deepDive.mediaStance.map((m) => {
                      const mTotal = m.total || 1;
                      const posP = Math.round((m.pos / mTotal) * 100);
                      const negP = Math.round((m.neg / mTotal) * 100);
                      const neuP = 100 - posP - negP;

                      return (
                        <div key={m.medio} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 truncate max-w-[200px]">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  m.stance === 'afín'
                                    ? 'bg-emerald-500'
                                    : m.stance === 'crítico'
                                    ? 'bg-rose-500'
                                    : 'bg-slate-400'
                                }`}
                              />
                              <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                                {m.medio}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 font-mono">
                              <span className="text-slate-400 text-[11px]">{m.total} notas</span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                  m.stance === 'afín'
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                    : m.stance === 'crítico'
                                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {m.stance} ({m.netSentiment >= 0 ? `+${m.netSentiment}%` : `${m.netSentiment}%`})
                              </span>
                            </div>
                          </div>

                          <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-700">
                            <div style={{ width: `${posP}%` }} className="bg-emerald-500" title={`Positivas: ${posP}%`} />
                            <div style={{ width: `${neuP}%` }} className="bg-slate-400" title={`Neutrales: ${neuP}%`} />
                            <div style={{ width: `${negP}%` }} className="bg-rose-500" title={`Negativas: ${negP}%`} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400">
                    Sin cobertura de medios registrada en este filtro.
                  </div>
                )
              ) : (
                /* For Medios or Temas: Actors Involved Breakdown */
                deepDive.actorsInvolved && deepDive.actorsInvolved.length > 0 ? (
                  <div className="space-y-3">
                    {deepDive.actorsInvolved.map((a) => {
                      const aTotal = a.total || 1;
                      const posP = Math.round((a.pos / aTotal) * 100);
                      const negP = Math.round((a.neg / aTotal) * 100);
                      const neuP = 100 - posP - negP;

                      return (
                        <div key={a.actor} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                              {a.actor}
                            </span>
                            <div className="flex items-center gap-2 font-mono">
                              <span className="text-slate-400 text-[11px]">{a.total} notas</span>
                              <span
                                className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                                  a.netSentiment >= 20
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : a.netSentiment <= -15
                                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {a.netSentiment >= 0 ? `+${a.netSentiment}%` : `${a.netSentiment}%`}
                              </span>
                            </div>
                          </div>

                          <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-700">
                            <div style={{ width: `${posP}%` }} className="bg-emerald-500" title={`Positivas: ${posP}%`} />
                            <div style={{ width: `${neuP}%` }} className="bg-slate-400" title={`Neutrales: ${neuP}%`} />
                            <div style={{ width: `${negP}%` }} className="bg-rose-500" title={`Negativas: ${negP}%`} />
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span className="text-emerald-600 dark:text-emerald-400">+{a.pos} fav</span>
                            <span>{a.neu} neu</span>
                            <span className="text-rose-600 dark:text-rose-400">-{a.neg} alerta</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400">
                    Sin actores políticos vinculados en este periodo.
                  </div>
                )
              )}
            </div>
          </div>
        </>
      ) : (
        /* Modo Macro: Panorama Comparativo de todo el Módulo bajo los filtros actuales */
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Macro Chart 1: Top con Mayor Capital Político / Favorabilidad */}
            <div className="p-5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
              <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-500" />
                  {mode === 'actores' && 'Top Actores con Mayor Capital Político Neto'}
                  {mode === 'medios' && 'Top Medios con Mayor Cobertura Favorable'}
                  {mode === 'temas' && 'Temas de Agenda con Mayor Aprobación / Consenso'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ordenado por balance neto (%Positivas - %Negativas)
                </p>
              </div>

              <div className="space-y-2.5">
                {macroRankings.best.map((ent, idx) => (
                  <button
                    key={ent.name}
                    type="button"
                    onClick={() => onSelectEntity && onSelectEntity(ent.name)}
                    className="w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/50 transition-all cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-center font-mono">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {ent.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 font-mono shrink-0 text-xs">
                      <span className="text-slate-400 text-[11px]">{ent.total} notas</span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                        +{ent.netSentiment}%
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Macro Chart 2: Top con Mayor Riesgo / Alertas Políticas */}
            <div className="p-5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-rose-500/20 bg-rose-500/5 shadow-xs space-y-4">
              <div className="pb-3 border-b border-rose-200/60 dark:border-rose-900/40">
                <h4 className="text-sm font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-500" />
                  {mode === 'actores' && 'Top Actores con Mayor Exposición a Crisis / Alertas'}
                  {mode === 'medios' && 'Medios con Mayor Intensidad Crítica hacia el Gobierno'}
                  {mode === 'temas' && 'Temas Críticos con Mayor Conflictividad Social'}
                </h4>
                <p className="text-xs text-rose-600/80 dark:text-rose-400/80">
                  Ordenado por volumen absoluto de notas negativas y señalamientos
                </p>
              </div>

              <div className="space-y-2.5">
                {macroRankings.worst.map((ent, idx) => (
                  <button
                    key={ent.name}
                    type="button"
                    onClick={() => onSelectEntity && onSelectEntity(ent.name)}
                    className="w-full text-left p-3 rounded-xl bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 border border-rose-200/60 dark:border-rose-800/50 transition-all cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="w-5 h-5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-center font-mono">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {ent.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 font-mono shrink-0 text-xs">
                      <span className="text-slate-400 text-[11px]">{ent.total} notas</span>
                      <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold">
                        {ent.neg} alertas
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Macro Chart 3: Mayor Cobertura y Share of Voice */}
          <div className="p-5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
            <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-500" />
                Líderes de Exposición Mediática (Top 8 por Volumen en los Filtros Seleccionados)
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Distribución comparativa de sentimiento entre las entidades con mayor presencia
              </p>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={macroRankings.highestVol} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} opacity={0.5} />
                  <XAxis type="number" stroke={isDark ? '#94a3b8' : '#64748b'} fontSize={11} tickLine={false} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke={isDark ? '#94a3b8' : '#64748b'}
                    fontSize={11}
                    tickLine={false}
                    width={130}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="pos" stackId="a" fill={COLOR_POS} name="Positivas" />
                  <Bar dataKey="neu" stackId="a" fill={COLOR_NEU} name="Neutrales" />
                  <Bar dataKey="neg" stackId="a" fill={COLOR_NEG} name="Alertas / Negativas" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
