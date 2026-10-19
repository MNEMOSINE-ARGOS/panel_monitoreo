import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { MediaRecord, FilterOptionItem, FilterState } from '../types';
import { useTheme } from '../context/ThemeContext';
import { repository } from '../services/repository';
import { getOperationalTodayDate } from '../utils/dateUtils';
import {
  BarChart3,
  PieChart as PieIcon,
  LineChart as LineIcon,
  Users2,
  Sparkles,
  TrendingUp,
  Info,
  Calendar,
  Layers,
  Activity,
  AlertTriangle,
  AlignLeft,
  ListOrdered,
  Scale,
  ExternalLink,
  Maximize2,
  LayoutGrid
} from 'lucide-react';
import { ActorTrendComparisonModal } from './ActorTrendComparisonModal';

interface ChartsSectionProps {
  records: MediaRecord[];
  selectedActores?: string[];
  allAvailableActores?: Array<string | FilterOptionItem>;
  onUpdateSelectedActores?: (actores: string[]) => void;
  dateRange?: FilterState['dateRange'];
  filters?: FilterState;
}

// Accessible high-contrast analytical palette
const COLOR_POSITIVA = '#10B981'; // Emerald brillante
const COLOR_NEUTRAL = '#94A3B8';  // Gris azulado
const COLOR_NEGATIVA = '#EF4444'; // Rojo carmín / Alerta intensa
const PIE_PALETTE = ['#0ea5e9', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f97316'];
const ACTOR_PALETTE = ['#06B6D4', '#8B5CF6', '#F59E0B', '#EC4899', '#10B981', '#3B82F6', '#F97316', '#14B8A6'];

export interface TemporalDataPoint {
  fecha: string;
  displayFecha: string;
  shortFecha: string;
  Positivas: number;
  Neutrales: number;
  Negativas: number;
  total: number;
  posPct: number;
  neuPct: number;
  negPct: number;
  netSentiment: number;
  isToday: boolean;
  // Porcentajes suavizados (promedio móvil ponderado por volumen) para ver la tendencia sin picos bruscos
  posTrend?: number;
  neuTrend?: number;
  negTrend?: number;
}

// Promedio móvil centrado, ponderado por el número de notas de cada día: los días con pocas notas
// pesan poco, así un día con 1 nota (100 %) no dispara la línea. Ventana: 3 a 7 días según la cantidad de puntos.
export function withSmoothedTrend<T extends TemporalDataPoint>(points: T[]): T[] {
  const n = points.length;
  if (n < 3) {
    return points.map((p) => ({ ...p, posTrend: p.posPct, neuTrend: p.neuPct, negTrend: p.negPct }));
  }
  const win = Math.min(7, Math.max(3, Math.round(n / 6) | 1));
  const half = Math.floor(win / 2);
  return points.map((p, i) => {
    let pos = 0, neu = 0, neg = 0, tot = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(n - 1, i + half); j++) {
      pos += points[j].Positivas;
      neu += points[j].Neutrales;
      neg += points[j].Negativas;
      tot += points[j].total;
    }
    const pct = (v: number) => (tot > 0 ? Number(((v / tot) * 100).toFixed(1)) : 0);
    return { ...p, posTrend: pct(pos), neuTrend: pct(neu), negTrend: pct(neg) };
  });
}

// Truncates date string YYYY-MM-DD to Monday of that week (ISO week start)
export function getWeekStartKey(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return dateStr;
  const date = new Date(y, m - 1, d);
  const day = date.getDay(); // 0 is Sun, 1 is Mon...
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  const wy = date.getFullYear();
  const wm = String(date.getMonth() + 1).padStart(2, '0');
  const wd = String(date.getDate()).padStart(2, '0');
  return `${wy}-${wm}-${wd}`;
}

export const ChartsSection: React.FC<ChartsSectionProps> = ({
  records,
  selectedActores = [],
  allAvailableActores = [],
  onUpdateSelectedActores,
  dateRange,
  filters
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [chartDimension, setChartDimension] = useState<'temas' | 'actores'>('temas');
  const [showVolumeBars, setShowVolumeBars] = useState<boolean>(true);
  const [smoothTrend, setSmoothTrend] = useState<boolean>(true);
  const [selectedActorView, setSelectedActorView] = useState<string>('all');
  const [comparativeMetric, setComparativeMetric] = useState<'net' | 'positive' | 'volume'>('net');
  const [isCompareModalOpen, setIsCompareModalOpen] = useState<boolean>(false);

  // Multi-actor support for Themes breakdown & separation
  const [selectedTemaActor, setSelectedTemaActor] = useState<string>('all');
  const [temaStackMode, setTemaStackMode] = useState<'sentiment' | 'actor'>('sentiment');

  // Share of Voice (SOV) Controls
  const [sovDimension, setSovDimension] = useState<'medios' | 'temas'>('medios');
  const [sovViewMode, setSovViewMode] = useState<'both' | 'pie' | 'bars'>('both');
  const [sovChartType, setSovChartType] = useState<'pie' | 'donut'>('pie');

  // Tendencia Acumulada de Sentimiento Controls
  const [cumulativeGranularity, setCumulativeGranularity] = useState<'week' | 'day'>('week');
  const [cumulativeChartType, setCumulativeChartType] = useState<'lines' | 'areas'>('lines');
  const [cumulativeActorView, setCumulativeActorView] = useState<string>('all');

  // Detect active actors explicitly filtered or selected (2 or more enables multi-actor mode)
  const activeSelectedActores = useMemo(() => {
    if (selectedActores && selectedActores.length > 0) {
      return selectedActores.filter(a => a && a.trim() && a.toLowerCase() !== 'sin actor');
    }
    // Auto-detect if records belong to a small set of distinct actors (2 to 4)
    const set = new Set<string>();
    records.forEach(r => {
      const a = r.actor ? r.actor.trim() : '';
      if (a && a.toLowerCase() !== 'sin actor') set.add(a);
    });
    if (set.size >= 2 && set.size <= 4) {
      return Array.from(set);
    }
    return [];
  }, [selectedActores, records]);

  const isMultiActorMode = activeSelectedActores.length >= 2;

  // Available actors for separating Themes (either from explicit selection or top actors in dataset)
  const availableTemaActores = useMemo(() => {
    if (activeSelectedActores.length > 0) {
      return activeSelectedActores;
    }
    const counts: Record<string, number> = {};
    records.forEach(r => {
      const a = (r.actor || '').trim();
      if (a && a.toLowerCase() !== 'sin actor') {
        counts[a] = (counts[a] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);
  }, [activeSelectedActores, records]);

  // Reset selected actor view if the active actor is no longer filtered
  React.useEffect(() => {
    if (selectedActorView !== 'all' && !activeSelectedActores.includes(selectedActorView)) {
      setSelectedActorView('all');
    }
  }, [activeSelectedActores, selectedActorView]);

  React.useEffect(() => {
    if (selectedTemaActor !== 'all' && !availableTemaActores.includes(selectedTemaActor)) {
      setSelectedTemaActor('all');
    }
  }, [availableTemaActores, selectedTemaActor]);

  // Records for individual single-actor chart if clicked on a specific actor tab
  const singleActorRecords = useMemo(() => {
    if (isMultiActorMode && selectedActorView !== 'all') {
      return records.filter(r => (r.actor || '').trim() === selectedActorView);
    }
    return records;
  }, [isMultiActorMode, selectedActorView, records]);

  // 1. Data for Top 10 Actores with Sentiment Breakdown (Excludes 'Sin actor')
  const topActoresData = useMemo(() => {
    const actorMap: Record<string, { actor: string; Positivas: number; Neutrales: number; Negativas: number; total: number }> = {};

    records.forEach(r => {
      const act = r.actor ? r.actor.trim() : '';
      if (!act || act.toLowerCase() === 'sin actor') return;
      if (!actorMap[act]) {
        actorMap[act] = { actor: act, Positivas: 0, Neutrales: 0, Negativas: 0, total: 0 };
      }
      if (r.calificacion === 'Positiva') actorMap[act].Positivas += 1;
      else if (r.calificacion === 'Negativa') actorMap[act].Negativas += 1;
      else actorMap[act].Neutrales += 1;
      actorMap[act].total += 1;
    });

    return Object.values(actorMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [records]);

  // 1b. Data for Top 10 Temas with Sentiment & Actor Breakdown (Can be filtered by specific actor or consolidated)
  const topTemasData = useMemo(() => {
    const targetRecords = selectedTemaActor !== 'all'
      ? records.filter(r => (r.actor || '').trim() === selectedTemaActor)
      : records;

    const temaMap: Record<string, {
      actor: string;
      Positivas: number;
      Neutrales: number;
      Negativas: number;
      total: number;
      actorCounts: Record<string, number>;
      [key: string]: any;
    }> = {};

    targetRecords.forEach(r => {
      const tema = (r.tema || r.categoria || 'GENERAL').trim();
      if (!temaMap[tema]) {
        temaMap[tema] = {
          actor: tema,
          Positivas: 0,
          Neutrales: 0,
          Negativas: 0,
          total: 0,
          actorCounts: {}
        };
      }
      if (r.calificacion === 'Positiva') temaMap[tema].Positivas += 1;
      else if (r.calificacion === 'Negativa') temaMap[tema].Negativas += 1;
      else temaMap[tema].Neutrales += 1;
      temaMap[tema].total += 1;

      const act = (r.actor || '').trim();
      if (act && act.toLowerCase() !== 'sin actor') {
        temaMap[tema].actorCounts[act] = (temaMap[tema].actorCounts[act] || 0) + 1;
      }
    });

    const list = Object.values(temaMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Populate dynamic Recharts keys for stacking by actor
    list.forEach(item => {
      availableTemaActores.forEach((act, idx) => {
        item[`actor_vol_${idx}`] = item.actorCounts[act] || 0;
      });
    });

    return list;
  }, [records, selectedTemaActor, availableTemaActores]);

  const activeBarData = chartDimension === 'actores' ? topActoresData : topTemasData;

  // 2. Data for Temporal Sentiment Trends (Combo Chart: Volume Bars + Straight Trend Lines for Single Actor or Global)
  const temporalTrendData = useMemo<TemporalDataPoint[]>(() => {
    const dateMap: Record<string, { Positivas: number; Neutrales: number; Negativas: number; total: number }> = {};

    singleActorRecords.forEach(r => {
      const f = r.fecha ? r.fecha.trim() : 'Sin fecha';
      if (!f || f === 'Sin fecha') return;
      if (!dateMap[f]) {
        dateMap[f] = { Positivas: 0, Neutrales: 0, Negativas: 0, total: 0 };
      }
      if (r.calificacion === 'Positiva') dateMap[f].Positivas += 1;
      else if (r.calificacion === 'Negativa') dateMap[f].Negativas += 1;
      else dateMap[f].Neutrales += 1;
      dateMap[f].total += 1;
    });

    // Detect current date to identify "Día en progreso"
    const todayISO = getOperationalTodayDate();
    const localToday = todayISO;

    const sortedDates = Object.keys(dateMap).sort((a, b) => a.localeCompare(b));
    const lastDate = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : '';

    return withSmoothedTrend(sortedDates.map(f => {
      const stats = dateMap[f];
      const total = stats.total;
      const posPct = total > 0 ? Number(((stats.Positivas / total) * 100).toFixed(1)) : 0;
      const neuPct = total > 0 ? Number(((stats.Neutrales / total) * 100).toFixed(1)) : 0;
      const negPct = total > 0 ? Number(((stats.Negativas / total) * 100).toFixed(1)) : 0;
      const netSentiment = Number((posPct - negPct).toFixed(1));

      // Es el día en curso (hoy)
      const isToday = f === todayISO || f === localToday || (f === lastDate && lastDate >= localToday);

      const parts = f.split('-');
      const shortFecha = parts.length === 3 ? `${parts[2]}/${parts[1]}` : f;
      let displayFecha = f;
      if (parts.length === 3) {
        const d = new Date(`${f}T12:00:00`);
        if (!isNaN(d.getTime())) {
          displayFecha = d.toLocaleDateString('es-MX', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          });
        }
      }

      return {
        fecha: f,
        displayFecha,
        shortFecha,
        Positivas: stats.Positivas,
        Neutrales: stats.Neutrales,
        Negativas: stats.Negativas,
        total,
        posPct,
        neuPct,
        negPct,
        netSentiment,
        isToday
      };
    }));
  }, [singleActorRecords]);

  // 2b. Map of Individual Actors' Intact Personal Trend Datasets (Zero Mixing, Zero Stacking)
  const actorPersonalTrendMap = useMemo(() => {
    if (!isMultiActorMode) return {};

    const todayISO = getOperationalTodayDate();
    const localToday = todayISO;

    const map: Record<string, {
      actor: string;
      color: string;
      total: number;
      pos: number;
      neu: number;
      neg: number;
      posPct: number;
      neuPct: number;
      negPct: number;
      netSentiment: number;
      trendData: TemporalDataPoint[];
    }> = {};

    activeSelectedActores.forEach((actor, idx) => {
      const color = ACTOR_PALETTE[idx % ACTOR_PALETTE.length];
      const actorNotes = records.filter(r => (r.actor || '').trim() === actor);
      const dateMap: Record<string, { Positivas: number; Neutrales: number; Negativas: number; total: number }> = {};
      let pos = 0, neu = 0, neg = 0;

      actorNotes.forEach(r => {
        if (r.calificacion === 'Positiva') pos++;
        else if (r.calificacion === 'Negativa') neg++;
        else neu++;

        const f = r.fecha ? r.fecha.trim() : 'Sin fecha';
        if (!f || f === 'Sin fecha') return;
        if (!dateMap[f]) {
          dateMap[f] = { Positivas: 0, Neutrales: 0, Negativas: 0, total: 0 };
        }
        if (r.calificacion === 'Positiva') dateMap[f].Positivas += 1;
        else if (r.calificacion === 'Negativa') dateMap[f].Negativas += 1;
        else dateMap[f].Neutrales += 1;
        dateMap[f].total += 1;
      });

      const total = actorNotes.length;
      const posPct = total > 0 ? Number(((pos / total) * 100).toFixed(1)) : 0;
      const neuPct = total > 0 ? Number(((neu / total) * 100).toFixed(1)) : 0;
      const negPct = total > 0 ? Number(((neg / total) * 100).toFixed(1)) : 0;
      const netSentiment = Number((posPct - negPct).toFixed(1));

      const sortedDates = Object.keys(dateMap).sort((a, b) => a.localeCompare(b));
      const lastDate = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : '';

      const trendData: TemporalDataPoint[] = withSmoothedTrend(sortedDates.map(f => {
        const stats = dateMap[f];
        const tot = stats.total;
        const pPct = tot > 0 ? Number(((stats.Positivas / tot) * 100).toFixed(1)) : 0;
        const nPct = tot > 0 ? Number(((stats.Neutrales / tot) * 100).toFixed(1)) : 0;
        const aPct = tot > 0 ? Number(((stats.Negativas / tot) * 100).toFixed(1)) : 0;
        const net = Number((pPct - aPct).toFixed(1));

        const isToday = f === todayISO || f === localToday || (f === lastDate && lastDate >= localToday);
        const parts = f.split('-');
        const shortFecha = parts.length === 3 ? `${parts[2]}/${parts[1]}` : f;
        let displayFecha = f;
        if (parts.length === 3) {
          const d = new Date(`${f}T12:00:00`);
          if (!isNaN(d.getTime())) {
            displayFecha = d.toLocaleDateString('es-MX', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            });
          }
        }

        return {
          fecha: f,
          displayFecha,
          shortFecha,
          Positivas: stats.Positivas,
          Neutrales: stats.Neutrales,
          Negativas: stats.Negativas,
          total: tot,
          posPct: pPct,
          neuPct: nPct,
          negPct: aPct,
          netSentiment: net,
          isToday
        };
      }));

      map[actor] = {
        actor,
        color,
        total,
        pos,
        neu,
        neg,
        posPct,
        neuPct,
        negPct,
        netSentiment,
        trendData
      };
    });

    return map;
  }, [isMultiActorMode, activeSelectedActores, records]);

  // 2b. Multi-Actor Independent Trend Data (Each actor has their own independent trend points and metrics)
  const multiActorTrendData = useMemo(() => {
    if (!isMultiActorMode) return [];

    const todayISO = getOperationalTodayDate();
    const localToday = todayISO;

    // Map: date -> actor -> stats
    const dateActorMap: Record<string, Record<string, { Positivas: number; Neutrales: number; Negativas: number; total: number }>> = {};

    records.forEach(r => {
      const f = r.fecha ? r.fecha.trim() : '';
      if (!f || f === 'Sin fecha') return;
      const act = r.actor ? r.actor.trim() : '';
      if (!activeSelectedActores.includes(act)) return;

      if (!dateActorMap[f]) {
        dateActorMap[f] = {};
        activeSelectedActores.forEach(a => {
          dateActorMap[f][a] = { Positivas: 0, Neutrales: 0, Negativas: 0, total: 0 };
        });
      }

      if (!dateActorMap[f][act]) {
        dateActorMap[f][act] = { Positivas: 0, Neutrales: 0, Negativas: 0, total: 0 };
      }

      if (r.calificacion === 'Positiva') dateActorMap[f][act].Positivas += 1;
      else if (r.calificacion === 'Negativa') dateActorMap[f][act].Negativas += 1;
      else dateActorMap[f][act].Neutrales += 1;
      dateActorMap[f][act].total += 1;
    });

    const sortedDates = Object.keys(dateActorMap).sort((a, b) => a.localeCompare(b));
    const lastDate = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : '';

    return sortedDates.map(f => {
      const isToday = f === todayISO || f === localToday || (f === lastDate && lastDate >= localToday);
      const parts = f.split('-');
      const shortFecha = parts.length === 3 ? `${parts[2]}/${parts[1]}` : f;
      let displayFecha = f;
      if (parts.length === 3) {
        const d = new Date(`${f}T12:00:00`);
        if (!isNaN(d.getTime())) {
          displayFecha = d.toLocaleDateString('es-MX', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          });
        }
      }

      const point: any = {
        fecha: f,
        displayFecha,
        shortFecha,
        isToday,
        total: 0,
        actorStats: {}
      };

      activeSelectedActores.forEach((actor, idx) => {
        const s = dateActorMap[f][actor] || { Positivas: 0, Neutrales: 0, Negativas: 0, total: 0 };
        const tot = s.total;
        point.total += tot;
        const posPct = tot > 0 ? Number(((s.Positivas / tot) * 100).toFixed(1)) : 0;
        const neuPct = tot > 0 ? Number(((s.Neutrales / tot) * 100).toFixed(1)) : 0;
        const negPct = tot > 0 ? Number(((s.Negativas / tot) * 100).toFixed(1)) : 0;
        const netSentiment = Number((posPct - negPct).toFixed(1));

        point.actorStats[actor] = {
          Positivas: s.Positivas,
          Neutrales: s.Neutrales,
          Negativas: s.Negativas,
          total: tot,
          posPct,
          neuPct,
          negPct,
          netSentiment
        };

        // Independent keys for Recharts
        point[`vol_${idx}`] = tot;
        point[`net_${idx}`] = tot > 0 ? netSentiment : null;
        point[`posPct_${idx}`] = tot > 0 ? posPct : null;
      });

      return point;
    });
  }, [isMultiActorMode, records, activeSelectedActores]);

  // 2c. Tendencia Acumulada de Sentimiento: los totales salen del servidor (todas las notas que
  // coinciden con los filtros). `records` solo trae las 3,000 más recientes, así que sirve únicamente
  // como respaldo mientras carga o si el servidor falla.
  const [serverCumulative, setServerCumulative] = useState<Array<{
    semana_inicio: string; pos_semana: number; neg_semana: number; total_semana: number;
  }> | null>(null);

  useEffect(() => {
    if (!filters) { setServerCumulative(null); return; }
    let cancelled = false;
    const scoped = cumulativeActorView !== 'all' ? { ...filters, actores: [cumulativeActorView] } : filters;
    const timer = setTimeout(() => {
      repository.fetchCumulativeTrends(scoped, cumulativeGranularity).then((rows) => {
        if (!cancelled) setServerCumulative(rows.length > 0 ? rows : null);
      });
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [filters, cumulativeActorView, cumulativeGranularity]);

  const cumulativeTrendData = useMemo(() => {
    const periodMap: Record<string, { Positivas: number; Neutrales: number; Negativas: number; total: number }> = {};

    if (serverCumulative) {
      serverCumulative.forEach((row) => {
        const pos = Number(row.pos_semana) || 0;
        const neg = Number(row.neg_semana) || 0;
        const total = Number(row.total_semana) || 0;
        periodMap[row.semana_inicio] = { Positivas: pos, Negativas: neg, Neutrales: Math.max(0, total - pos - neg), total };
      });
    } else {
      const targetRecords = cumulativeActorView !== 'all'
        ? records.filter(r => (r.actor || '').trim() === cumulativeActorView)
        : records;

      targetRecords.forEach(r => {
        const f = r.fecha ? r.fecha.trim() : '';
        if (!f || f === 'Sin fecha' || f.length < 10) return;

        const key = cumulativeGranularity === 'week' ? getWeekStartKey(f) : f;
        if (!periodMap[key]) {
          periodMap[key] = { Positivas: 0, Neutrales: 0, Negativas: 0, total: 0 };
        }
        if (r.calificacion === 'Positiva') periodMap[key].Positivas += 1;
        else if (r.calificacion === 'Negativa') periodMap[key].Negativas += 1;
        else periodMap[key].Neutrales += 1;
        periodMap[key].total += 1;
      });
    }

    const sortedKeys = Object.keys(periodMap).sort((a, b) => a.localeCompare(b));
    let pos_acumulado = 0;
    let neu_acumulado = 0;
    let neg_acumulado = 0;
    let total_acumulado = 0;

    return sortedKeys.map(key => {
      const s = periodMap[key];
      pos_acumulado += s.Positivas;
      neu_acumulado += s.Neutrales;
      neg_acumulado += s.Negativas;
      total_acumulado += s.total;

      const parts = key.split('-');
      let displayPeriodo = key;
      let fullLabel = key;

      if (parts.length === 3) {
        if (cumulativeGranularity === 'week') {
          displayPeriodo = `Sem. ${parts[2]}/${parts[1]}`;
          const dStart = new Date(`${key}T12:00:00`);
          const dEnd = new Date(dStart.getTime() + 6 * 86400000);
          fullLabel = `Semana del ${dStart.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} al ${dEnd.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}`;
        } else {
          displayPeriodo = `${parts[2]}/${parts[1]}`;
          const d = new Date(`${key}T12:00:00`);
          fullLabel = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        }
      }

      return {
        periodo: key,
        displayPeriodo,
        fullLabel,
        pos_periodo: s.Positivas,
        neu_periodo: s.Neutrales,
        neg_periodo: s.Negativas,
        total_periodo: s.total,
        pos_acumulado,
        neu_acumulado,
        neg_acumulado,
        total_acumulado
      };
    });
  }, [serverCumulative, records, cumulativeActorView, cumulativeGranularity]);

  const latestCumulativeTotals = useMemo(() => {
    if (cumulativeTrendData.length === 0) {
      return { total_acumulado: 0, pos_acumulado: 0, neu_acumulado: 0, neg_acumulado: 0, posPct: 0, neuPct: 0, negPct: 0 };
    }
    const last = cumulativeTrendData[cumulativeTrendData.length - 1];
    const tot = last.total_acumulado || 1;
    return {
      total_acumulado: last.total_acumulado,
      pos_acumulado: last.pos_acumulado,
      neu_acumulado: last.neu_acumulado,
      neg_acumulado: last.neg_acumulado,
      posPct: Math.round((last.pos_acumulado / tot) * 100),
      neuPct: Math.round((last.neu_acumulado / tot) * 100),
      negPct: Math.round((last.neg_acumulado / tot) * 100)
    };
  }, [cumulativeTrendData]);

  // 3. Share of Voice (SOV) Medios & Temas Data with Detailed Metrics
  const totalSovUniverse = records.length || 1;

  // Complete sorted Medios list
  const sovMediosList = useMemo(() => {
    const medioMap: Record<string, number> = {};
    records.forEach(r => {
      const m = (r.medio || '').trim() || 'Otro';
      medioMap[m] = (medioMap[m] || 0) + 1;
    });

    return Object.entries(medioMap)
      .map(([name, value]) => {
        const pct = (value / totalSovUniverse) * 100;
        return {
          name,
          value,
          pct: Number(pct.toFixed(1)),
          pctRound: Math.round(pct)
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [records, totalSovUniverse]);

  // Complete sorted Temas list
  const sovTemasList = useMemo(() => {
    const temaMap: Record<string, number> = {};
    records.forEach(r => {
      const t = (r.tema || r.categoria || 'General').trim();
      temaMap[t] = (temaMap[t] || 0) + 1;
    });

    return Object.entries(temaMap)
      .map(([name, value]) => {
        const pct = (value / totalSovUniverse) * 100;
        return {
          name,
          value,
          pct: Number(pct.toFixed(1)),
          pctRound: Math.round(pct)
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [records, totalSovUniverse]);

  // Active full list for comparative bar breakdown
  const activeSovList = sovDimension === 'medios' ? sovMediosList : sovTemasList;
  const maxSovValue = activeSovList[0]?.value || 1;

  // Slices data for Pie Chart (Top 6 + "Otros")
  const shareOfVoicePieData = useMemo(() => {
    if (activeSovList.length > 7) {
      const top6 = activeSovList.slice(0, 6);
      const othersTotal = activeSovList.slice(6).reduce((acc, curr) => acc + curr.value, 0);
      const othersPct = (othersTotal / totalSovUniverse) * 100;
      return [
        ...top6,
        {
          name: sovDimension === 'medios' ? 'Otros Medios' : 'Otros Temas',
          value: othersTotal,
          pct: Number(othersPct.toFixed(1)),
          pctRound: Math.round(othersPct)
        }
      ];
    }
    return activeSovList;
  }, [activeSovList, sovDimension, totalSovUniverse]);

  // 4. Top 5 Reporteros
  const topReporterosData = useMemo(() => {
    const repMap: Record<string, { reportero: string; menciones: number; positivas: number; negativas: number }> = {};
    records.forEach(r => {
      const rep = r.reportero || 'Redacción';
      if (!repMap[rep]) {
        repMap[rep] = { reportero: rep, menciones: 0, positivas: 0, negativas: 0 };
      }
      repMap[rep].menciones += 1;
      if (r.calificacion === 'Positiva') repMap[rep].positivas += 1;
      if (r.calificacion === 'Negativa') repMap[rep].negativas += 1;
    });

    return Object.values(repMap)
      .sort((a, b) => b.menciones - a.menciones)
      .slice(0, 5);
  }, [records]);

  const customTooltipStyle = {
    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid rgba(226, 232, 240, 0.8)',
    borderRadius: '12px',
    padding: '10px 14px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
    color: isDark ? '#f8fafc' : '#0f172a',
    fontSize: '12px',
    backdropFilter: 'blur(8px)'
  };

  // Custom Dot Renderer with well-defined node markers and dashed halo for in-progress dates
  const renderLineDot = (color: string) => (dotProps: any) => {
    const { cx, cy, payload, key } = dotProps;
    if (cx == null || cy == null) return null;
    const isToday = payload?.isToday;

    if (isToday) {
      return (
        <g key={key || `dot-${cx}-${cy}`}>
          <circle
            cx={cx}
            cy={cy}
            r={6.5}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeDasharray="2.5 2.5"
            opacity={0.9}
          />
          <circle
            cx={cx}
            cy={cy}
            r={3}
            fill={color}
            fillOpacity={0.4}
            stroke={isDark ? '#0f172a' : '#ffffff'}
            strokeWidth={1.5}
          />
        </g>
      );
    }

    return (
      <circle
        key={key || `dot-${cx}-${cy}`}
        cx={cx}
        cy={cy}
        r={3.5}
        fill={color}
        stroke={isDark ? '#0f172a' : '#ffffff'}
        strokeWidth={1.5}
      />
    );
  };

  // Custom Analytical Tooltip for Multi-Actor Comparative Chart
  const renderComparativeTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;

    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/95 p-3.5 shadow-2xl backdrop-blur-md text-slate-100 min-w-[320px] max-w-[420px] z-50">
        {/* Header: Date + In-progress Indicator */}
        <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800">
          <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-200 capitalize">
            <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>{data.displayFecha}</span>
          </div>
          {data.isToday && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Día en progreso
            </span>
          )}
        </div>

        <div className="text-[11px] font-medium text-slate-400 mb-2">
          Progreso Independiente por Actor ({comparativeMetric === 'net' ? 'Balance Neto' : comparativeMetric === 'positive' ? '% Favorable' : 'Volumen'}):
        </div>

        {/* Detailed independent breakdown for each selected actor */}
        <div className="space-y-2">
          {activeSelectedActores.map((actor, idx) => {
            const color = ACTOR_PALETTE[idx % ACTOR_PALETTE.length];
            const stats = data.actorStats?.[actor] || { Positivas: 0, Neutrales: 0, Negativas: 0, total: 0, posPct: 0, neuPct: 0, negPct: 0, netSentiment: 0 };
            return (
              <div key={actor} className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="font-bold text-xs text-white truncate">{actor}</span>
                  </div>
                  <span className="font-mono text-xs font-semibold text-cyan-300 shrink-0">
                    {stats.total} notas
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 pt-1 border-t border-slate-700/40">
                  <span className="text-[#10B981] font-semibold">{stats.posPct}% Pos</span>
                  <span className="text-[#94A3B8]">{stats.neuPct}% Neu</span>
                  <span className="text-[#EF4444] font-semibold">{stats.negPct}% Alerta</span>
                  <span className={`font-bold ${stats.netSentiment >= 0 ? 'text-cyan-400' : 'text-amber-400'}`}>
                    Net: {stats.netSentiment >= 0 ? `+${stats.netSentiment}%` : `${stats.netSentiment}%`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
          <span>Total conjunto del día:</span>
          <span className="font-mono font-bold text-white">{data.total} notas</span>
        </div>
      </div>
    );
  };

  // Custom Analytical Tooltip for Combo Chart (Single Actor or Global)
  const renderTemporalTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data: TemporalDataPoint = payload[0]?.payload;
    if (!data) return null;

    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/95 p-3.5 shadow-2xl backdrop-blur-md text-slate-100 min-w-[300px] z-50">
        {/* Header: Date + In-progress Indicator */}
        <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800">
          <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-200 capitalize">
            <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>{data.displayFecha}</span>
          </div>
          {data.isToday && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Día en progreso
            </span>
          )}
        </div>

        {/* Required Headline String Format */}
        <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 mb-2.5 font-mono text-[11px] text-slate-200">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 leading-relaxed">
            <span className="text-cyan-400 font-bold">Total de Impactos: {data.total.toLocaleString()}</span>
            <span className="text-slate-600">|</span>
            <span className="text-[#10B981] font-semibold">Positivas: {data.posPct}%</span>
            <span className="text-slate-600">|</span>
            <span className="text-[#94A3B8] font-semibold">Neutrales: {data.neuPct}%</span>
            <span className="text-slate-600">|</span>
            <span className="text-[#EF4444] font-semibold">Alerta: {data.negPct}%</span>
          </div>
        </div>

        {/* Detailed Quantitative Breakdown */}
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#10B981]" />
              <span className="text-slate-300">Cobertura Positiva</span>
            </div>
            <div className="flex items-center gap-2 font-mono">
              <span className="text-slate-400">{data.Positivas.toLocaleString()} notas</span>
              <span className="font-bold text-[#10B981]">{data.posPct}%</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#94A3B8]" />
              <span className="text-slate-300">Cobertura Neutral</span>
            </div>
            <div className="flex items-center gap-2 font-mono">
              <span className="text-slate-400">{data.Neutrales.toLocaleString()} notas</span>
              <span className="font-bold text-[#94A3B8]">{data.neuPct}%</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#EF4444]" />
              <span className="text-slate-300">Alerta (Negativas)</span>
            </div>
            <div className="flex items-center gap-2 font-mono">
              <span className="text-slate-400">{data.Negativas.toLocaleString()} notas</span>
              <span className="font-bold text-[#EF4444]">{data.negPct}%</span>
            </div>
          </div>

          {/* Balance Neto */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Balance Neto (%Pos - %Alerta)</span>
            <span className={`font-mono font-bold ${data.netSentiment >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {data.netSentiment >= 0 ? `+${data.netSentiment}%` : `${data.netSentiment}%`}
            </span>
          </div>
        </div>

        {data.isToday && (
          <div className="mt-2.5 pt-2 border-t border-slate-800 text-[10px] text-amber-400/90 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>Día activo en monitoreo: los valores reflejan capturas hasta el momento.</span>
          </div>
        )}
      </div>
    );
  };

  // Custom Analytical Tooltip for Top 10 Temas / Actores Bar Chart
  const renderBarTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;

    const isTema = chartDimension === 'temas';
    const total = data.total || 0;
    const pos = data.Positivas || 0;
    const neu = data.Neutrales || 0;
    const neg = data.Negativas || 0;
    const posPct = total > 0 ? ((pos / total) * 100).toFixed(1) : '0';
    const neuPct = total > 0 ? ((neu / total) * 100).toFixed(1) : '0';
    const negPct = total > 0 ? ((neg / total) * 100).toFixed(1) : '0';

    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/95 p-3.5 shadow-2xl backdrop-blur-md text-slate-100 min-w-[280px] max-w-[360px] z-50">
        <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800">
          <span className="font-bold text-xs text-white uppercase tracking-wide truncate">
            {data.actor}
          </span>
          <span className="font-mono text-xs font-bold text-cyan-400 shrink-0">
            {total} notas
          </span>
        </div>

        {/* Sentiment Breakdown */}
        <div className="space-y-1.5 text-xs mb-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#10B981]" /> Positivas:
            </span>
            <span className="font-mono text-slate-200">
              {pos} <span className="text-[#10B981] font-semibold">({posPct}%)</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#94A3B8]" /> Neutrales:
            </span>
            <span className="font-mono text-slate-200">
              {neu} <span className="text-[#94A3B8] font-semibold">({neuPct}%)</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#EF4444]" /> Negativas:
            </span>
            <span className="font-mono text-slate-200">
              {neg} <span className="text-[#EF4444] font-semibold">({negPct}%)</span>
            </span>
          </div>
        </div>

        {/* Actor Breakdown (When in Temas view with multiple actors and not filtered to a single actor) */}
        {isTema && data.actorCounts && Object.keys(data.actorCounts).length > 0 && selectedTemaActor === 'all' && (
          <div className="pt-2 border-t border-slate-800">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Desglose por Actor:
            </p>
            <div className="space-y-1 text-[11px]">
              {availableTemaActores.map((act, idx) => {
                const count = data.actorCounts[act] || 0;
                if (count === 0) return null;
                const pct = total > 0 ? ((count / total) * 100).toFixed(0) : '0';
                const color = ACTOR_PALETTE[idx % ACTOR_PALETTE.length];
                return (
                  <div key={act} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-300 truncate max-w-[200px]">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="truncate">{act}</span>
                    </span>
                    <span className="font-mono font-semibold text-cyan-300 shrink-0">
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Custom Analytical Tooltip for Tendencia Acumulada de Sentimiento
  const renderCumulativeTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;

    const total = data.total_acumulado || 1;
    const posPct = ((data.pos_acumulado / total) * 100).toFixed(1);
    const neuPct = ((data.neu_acumulado / total) * 100).toFixed(1);
    const negPct = ((data.neg_acumulado / total) * 100).toFixed(1);

    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/95 p-3.5 shadow-2xl backdrop-blur-md text-slate-100 min-w-[300px] z-50">
        <div className="pb-2 mb-2 border-b border-slate-800">
          <span className="font-semibold text-xs text-cyan-400 capitalize">
            {data.fullLabel}
          </span>
        </div>

        {/* Incremental count for this period */}
        <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 mb-2.5 text-[11px] font-mono">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
            Nuevas notas registradas ({cumulativeGranularity === 'week' ? 'Semana' : 'Día'}):
          </div>
          <div className="flex items-center justify-between text-slate-200">
            <span className="text-white font-bold">Total: +{data.total_periodo}</span>
            <span className="text-[#10B981]">+{data.pos_periodo} pos</span>
            <span className="text-[#94A3B8]">+{data.neu_periodo} neu</span>
            <span className="text-[#EF4444]">+{data.neg_periodo} alerta</span>
          </div>
        </div>

        {/* Cumulative running totals */}
        <div className="space-y-1.5 text-xs">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
            Total Acumulado hasta la fecha:
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#10B981]" /> Positivas Acumuladas:
            </span>
            <span className="font-mono font-bold text-[#10B981]">
              {data.pos_acumulado.toLocaleString()} <span className="font-normal text-xs text-slate-400">({posPct}%)</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#94A3B8]" /> Neutrales Acumuladas:
            </span>
            <span className="font-mono font-bold text-[#94A3B8]">
              {data.neu_acumulado.toLocaleString()} <span className="font-normal text-xs text-slate-400">({neuPct}%)</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#EF4444]" /> Negativas (Alerta) Acum.:
            </span>
            <span className="font-mono font-bold text-[#EF4444]">
              {data.neg_acumulado.toLocaleString()} <span className="font-normal text-xs text-slate-400">({negPct}%)</span>
            </span>
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-semibold">
            <span className="text-white">Volumen Histórico Acumulado:</span>
            <span className="font-mono text-cyan-400 text-sm">
              {data.total_acumulado.toLocaleString()} notas
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div id="charts-section" className="space-y-6">
      {/* 1. Tendencia Acumulada de Sentimiento - Single Full Row (Arriba) */}
      <div className="w-full rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900/95 p-5 shadow-xs flex flex-col justify-between">
        <div>
          {/* Header with Title and Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span>Tendencia Acumulada de Sentimiento</span>
                {cumulativeActorView !== 'all' && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                    {cumulativeActorView}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {cumulativeActorView !== 'all'
                  ? `Crecimiento continuo acumulado semana tras semana de notas positivas, neutrales y alertas para ${cumulativeActorView}`
                  : 'Crecimiento acumulado continuo semana tras semana partiendo de cero hasta el máximo histórico'}
              </p>
            </div>

            {/* Controls: Granularidad (Semanal / Diario) y Modo (Líneas / Áreas) */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Granularidad Switcher */}
              <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setCumulativeGranularity('week')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    cumulativeGranularity === 'week'
                      ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Agrupación semanal (DATE_TRUNC week)"
                >
                  Semanal
                </button>
                <button
                  type="button"
                  onClick={() => setCumulativeGranularity('day')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    cumulativeGranularity === 'day'
                      ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Agrupación diaria acumulada"
                >
                  Diario
                </button>
              </div>

              {/* Chart Mode Switcher: Líneas vs Áreas */}
              <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setCumulativeChartType('lines')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    cumulativeChartType === 'lines'
                      ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Curvas independientes acumuladas"
                >
                  Líneas
                </button>
                <button
                  type="button"
                  onClick={() => setCumulativeChartType('areas')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    cumulativeChartType === 'areas'
                      ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Áreas apiladas de volumen acumulado"
                >
                  Áreas
                </button>
              </div>
            </div>
          </div>

          {/* Quick Actor Selector if multiple actors exist */}
          {availableTemaActores.length >= 2 && (
            <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 mb-3 text-xs">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-1.5 flex items-center gap-1">
                <Users2 className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                <span>Actor:</span>
              </span>
              <button
                type="button"
                onClick={() => setCumulativeActorView('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  cumulativeActorView === 'all'
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                }`}
              >
                Todos ({availableTemaActores.length})
              </button>
              {availableTemaActores.map((actor, idx) => {
                const color = ACTOR_PALETTE[idx % ACTOR_PALETTE.length];
                const isCurrent = cumulativeActorView === actor;
                return (
                  <button
                    key={actor}
                    type="button"
                    onClick={() => setCumulativeActorView(actor)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs border border-slate-300 dark:border-slate-600'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="truncate max-w-[130px] sm:max-w-none">{actor}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Cumulative KPI Highlights bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 mb-3 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                <span className="w-3 h-0.5 bg-[#06B6D4] inline-block rounded-full" />
                <span className="font-semibold text-slate-900 dark:text-white">
                  Total Acumulado: {latestCumulativeTotals.total_acumulado.toLocaleString()}
                </span>
              </span>
              <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] inline-block" />
                <span>Positivas Acum.:</span>
                <span className="font-mono font-bold text-[#10B981]">
                  {latestCumulativeTotals.pos_acumulado.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-400">({latestCumulativeTotals.posPct}%)</span>
              </span>
              <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-[#94A3B8] inline-block" />
                <span>Neutrales Acum.:</span>
                <span className="font-mono font-bold text-[#94A3B8]">
                  {latestCumulativeTotals.neu_acumulado.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-400">({latestCumulativeTotals.neuPct}%)</span>
              </span>
              <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] inline-block" />
                <span>Alertas Acum.:</span>
                <span className="font-mono font-bold text-[#EF4444]">
                  {latestCumulativeTotals.neg_acumulado.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-400">({latestCumulativeTotals.negPct}%)</span>
              </span>
            </div>

            <div className="text-[11px] text-slate-400 font-mono">
              Inicia en 0 &rarr; Máximo: {latestCumulativeTotals.total_acumulado.toLocaleString()} notas
            </div>
          </div>

          {/* Chart Rendering */}
          <div className="h-80 w-full min-h-[300px]">
            {cumulativeTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                {cumulativeChartType === 'areas' ? (
                  <AreaChart
                    data={cumulativeTrendData}
                    margin={{ top: 15, right: 20, left: -10, bottom: 25 }}
                  >
                    <defs>
                      <linearGradient id="cumPosGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="cumNeuGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#94A3B8" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#94A3B8" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="cumNegGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={isDark ? 'rgba(51, 65, 85, 0.45)' : 'rgba(226, 232, 240, 0.85)'}
                    />
                    <XAxis
                      dataKey="displayPeriodo"
                      tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }}
                      axisLine={{ stroke: isDark ? '#475569' : '#cbd5e1' }}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }}
                      axisLine={{ stroke: isDark ? '#475569' : '#cbd5e1' }}
                      tickLine={false}
                      allowDecimals={false}
                      domain={[0, 'auto']}
                      tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                    />
                    <Tooltip content={renderCumulativeTooltip} cursor={{ stroke: isDark ? '#475569' : '#cbd5e1', strokeDasharray: '4 4' }} />
                    <Area type="monotone" dataKey="pos_acumulado" stackId="cum" name="Positivas Acumuladas" stroke="#10B981" fill="url(#cumPosGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="neu_acumulado" stackId="cum" name="Neutrales Acumuladas" stroke="#94A3B8" fill="url(#cumNeuGrad)" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="neg_acumulado" stackId="cum" name="Alertas Acumuladas" stroke="#EF4444" fill="url(#cumNegGrad)" strokeWidth={2} />
                    <Line type="monotone" dataKey="total_acumulado" name="Total Acumulado" stroke="#06B6D4" strokeWidth={2.5} dot={false} strokeDasharray="3 3" />
                  </AreaChart>
                ) : (
                  <ComposedChart
                    data={cumulativeTrendData}
                    margin={{ top: 15, right: 20, left: -10, bottom: 25 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={isDark ? 'rgba(51, 65, 85, 0.45)' : 'rgba(226, 232, 240, 0.85)'}
                    />
                    <XAxis
                      dataKey="displayPeriodo"
                      tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }}
                      axisLine={{ stroke: isDark ? '#475569' : '#cbd5e1' }}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }}
                      axisLine={{ stroke: isDark ? '#475569' : '#cbd5e1' }}
                      tickLine={false}
                      allowDecimals={false}
                      domain={[0, 'auto']}
                      tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                    />
                    <Tooltip content={renderCumulativeTooltip} cursor={{ stroke: isDark ? '#475569' : '#cbd5e1', strokeDasharray: '4 4' }} />
                    <Line type="monotone" dataKey="total_acumulado" name="Total Acumulado" stroke="#06B6D4" strokeWidth={2.5} dot={{ r: 2.5, fill: '#06B6D4' }} />
                    <Line type="monotone" dataKey="pos_acumulado" name="Positivas Acumuladas" stroke="#10B981" strokeWidth={2.5} dot={{ r: 2.5, fill: '#10B981' }} />
                    <Line type="monotone" dataKey="neu_acumulado" name="Neutrales Acumuladas" stroke="#94A3B8" strokeWidth={1.5} dot={{ r: 2, fill: '#94A3B8' }} />
                    <Line type="monotone" dataKey="neg_acumulado" name="Alertas Acumuladas" stroke="#EF4444" strokeWidth={2.5} dot={{ r: 2.5, fill: '#EF4444' }} />
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                Sin datos acumulativos para el periodo seleccionado
              </div>
            )}
          </div>
        </div>

        {/* Footer info strip */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
          <span>
            Conteo acumulativo continuo semana tras semana &bull; Base cero al primer registro del periodo
          </span>
          <div className="flex items-center gap-3">
            <span className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
              {cumulativeTrendData.length} intervalos ({cumulativeGranularity === 'week' ? 'semanales' : 'diarios'}) acumulados
            </span>
          </div>
        </div>
      </div>

      {/* 2. Tendencia Diaria de Sentimiento (Combo Chart) - Single Full Row (Abajo) */}
      <div className="w-full rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900/95 p-5 shadow-xs flex flex-col justify-between">
          <div>
            {/* Header: Title, Actor Mode Indicator & Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-500" />
                  {isMultiActorMode && selectedActorView === 'all'
                    ? 'Tendencias Personales por Actor'
                    : selectedActorView !== 'all'
                    ? `Tendencia Personal: ${selectedActorView}`
                    : 'Tendencia Diaria de Sentimiento'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isMultiActorMode && selectedActorView === 'all'
                    ? 'Tendencias personales independientes preservadas intactas por cada actor (sin acumular ni apilar)'
                    : selectedActorView !== 'all'
                    ? 'Evolución analítica independiente y exclusiva para este actor'
                    : 'Gráfico Combinado: volumen diario apilado y porcentaje analítico por sentimiento'}
                </p>
              </div>

              {/* Controls: Open Comparison Modal + Volume Toggle */}
              <div className="flex flex-wrap items-center gap-2">
                {isMultiActorMode && (
                  <button
                    type="button"
                    onClick={() => setIsCompareModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs shadow-md shadow-cyan-500/20 hover:shadow-cyan-500/30 transition-all cursor-pointer"
                    title="Abrir análisis comparativo detallado en ventana independiente"
                  >
                    <Scale className="w-3.5 h-3.5 text-cyan-200" />
                    <span>Abrir Comparativa en Ventana ({activeSelectedActores.length})</span>
                    <ExternalLink className="w-3 h-3 text-cyan-200" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSmoothTrend(!smoothTrend)}
                  aria-pressed={smoothTrend}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    smoothTrend
                      ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                  }`}
                  title="Suaviza las líneas con un promedio móvil ponderado por volumen para ver la tendencia; el detalle diario real sigue en el tooltip y las barras"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Suavizar tendencia</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowVolumeBars(!showVolumeBars)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    showVolumeBars
                      ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                  }`}
                  title="Alternar visibilidad de barras de volumen en el fondo"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Volumen de Fondo</span>
                </button>
              </div>
            </div>

            {/* Quick Actor Selector Tabs (When multiple actors are selected) */}
            {isMultiActorMode && (
              <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 mb-3 text-xs">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-1.5 flex items-center gap-1">
                  <Users2 className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                  <span>Actores:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedActorView('all')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    selectedActorView === 'all'
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Ver Gráficos Separados ({activeSelectedActores.length})</span>
                </button>
                {activeSelectedActores.map((actor, idx) => {
                  const color = ACTOR_PALETTE[idx % ACTOR_PALETTE.length];
                  const isCurrent = selectedActorView === actor;
                  return (
                    <button
                      key={actor}
                      type="button"
                      onClick={() => setSelectedActorView(actor)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs border border-slate-300 dark:border-slate-600'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="truncate max-w-[130px] sm:max-w-none">{actor}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setIsCompareModalOpen(true)}
                  className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 font-semibold cursor-pointer transition-colors"
                  title="Comparar las curvas y métricas en una ventana independiente"
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>Comparar en Ventana</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Analytical Legend Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 mb-3 text-xs">
              <div className="flex flex-wrap items-center gap-3.5">
                <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                  <span className="w-3 h-0.5 bg-[#10B981] inline-block rounded-full" />
                  <span className="w-2 h-2 rounded-full bg-[#10B981] inline-block -ml-1" />
                  <span>% Positiva</span>
                </span>
                <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                  <span className="w-3 h-0.5 bg-[#94A3B8] inline-block rounded-full" />
                  <span className="w-2 h-2 rounded-full bg-[#94A3B8] inline-block -ml-1" />
                  <span>% Neutral</span>
                </span>
                <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                  <span className="w-3 h-0.5 bg-[#EF4444] inline-block rounded-full" />
                  <span className="w-2 h-2 rounded-full bg-[#EF4444] inline-block -ml-1" />
                  <span>% Alerta</span>
                </span>
                {showVolumeBars && (
                  <span className="flex items-center gap-1.5 text-slate-400 font-normal">
                    <span className="w-2.5 h-2.5 rounded-xs bg-slate-400/30 border border-slate-400/50 inline-block" />
                    <span>Barras: Volumen Diario</span>
                  </span>
                )}
              </div>

              {/* Indicator for Current Day In Progress */}
              <div className="flex items-center gap-1.5 text-[11px] text-amber-500 dark:text-amber-400/90 font-medium">
                <span className="w-2 h-2 rounded-full border border-dashed border-amber-400 bg-amber-400/30 animate-pulse" />
                <span>Día en progreso (Dashed / Parcial)</span>
              </div>
            </div>

            {/* Chart Area: Independent charts per actor when multi-actor, or single chart */}
            <div className={isMultiActorMode && selectedActorView === 'all' ? 'w-full' : 'h-80 w-full min-h-[300px]'}>
              {isMultiActorMode && selectedActorView === 'all' ? (
                /* Separate Independent Charts for Each Selected Actor (Personal trends completely intact) */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeSelectedActores.map((actor) => {
                    const actorData = actorPersonalTrendMap[actor];
                    if (!actorData) return null;
                    return (
                      <div
                        key={actor}
                        className="p-3.5 sm:p-4 rounded-xl border border-slate-200/90 dark:border-slate-800/90 bg-slate-50/70 dark:bg-slate-900/60 flex flex-col justify-between space-y-2.5 transition-all shadow-xs hover:border-slate-300 dark:hover:border-slate-700"
                      >
                        {/* Actor Header with Badges */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/70 dark:border-slate-800">
                          <div className="flex items-center gap-2 truncate">
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: actorData.color }} />
                            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate" title={actor}>
                              {actor}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap text-xs">
                            <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {actorData.total.toLocaleString()} notas
                            </span>
                            <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-md ${
                              actorData.netSentiment >= 0
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                            }`}>
                              Net: {actorData.netSentiment >= 0 ? `+${actorData.netSentiment}%` : `${actorData.netSentiment}%`}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedActorView(actor)}
                              className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                              title="Ver solo este actor en tamaño completo"
                            >
                              Ampliar
                            </button>
                          </div>
                        </div>

                        {/* Personal Sentiment Breakdown mini-legend */}
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 px-1">
                          <span className="text-[#10B981] font-semibold">{actorData.posPct}% Pos</span>
                          <span className="text-[#94A3B8]">{actorData.neuPct}% Neu</span>
                          <span className="text-[#EF4444] font-semibold">{actorData.negPct}% Alerta</span>
                        </div>

                        {/* Dedicated ComposedChart (Volume bars + % Pos, % Neu, % Neg lines) */}
                        <div className="h-56 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={actorData.trendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                              <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                                stroke={isDark ? 'rgba(51, 65, 85, 0.45)' : 'rgba(226, 232, 240, 0.85)'}
                              />
                              <XAxis
                                dataKey="fecha"
                                tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 9 }}
                                axisLine={{ stroke: isDark ? '#475569' : '#cbd5e1' }}
                                tickLine={false}
                                tickFormatter={(val: string) => {
                                  const parts = val.split('-');
                                  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : val;
                                }}
                              />
                              <YAxis
                                yAxisId="volume"
                                orientation="left"
                                tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 9 }}
                                axisLine={{ stroke: isDark ? '#334155' : '#cbd5e1' }}
                                tickLine={false}
                                allowDecimals={false}
                              />
                              <YAxis
                                yAxisId="percent"
                                orientation="right"
                                domain={[0, 100]}
                                tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 9 }}
                                axisLine={{ stroke: isDark ? '#475569' : '#cbd5e1' }}
                                tickLine={false}
                                unit="%"
                              />
                              <Tooltip content={renderTemporalTooltip} cursor={{ stroke: isDark ? '#475569' : '#cbd5e1', strokeDasharray: '4 4' }} />

                              {showVolumeBars && (
                                <>
                                  <Bar yAxisId="volume" dataKey="Positivas" name="Vol. Positiva" stackId="vol" fill="#10B981" fillOpacity={isDark ? 0.25 : 0.2} maxBarSize={20} />
                                  <Bar yAxisId="volume" dataKey="Neutrales" name="Vol. Neutral" stackId="vol" fill="#94A3B8" fillOpacity={isDark ? 0.2 : 0.15} maxBarSize={20} />
                                  <Bar yAxisId="volume" dataKey="Negativas" name="Vol. Alerta" stackId="vol" fill="#EF4444" fillOpacity={isDark ? 0.25 : 0.2} maxBarSize={20} radius={[2, 2, 0, 0]} />
                                </>
                              )}

                              <Line yAxisId="percent" type={smoothTrend ? 'monotone' : 'linear'} dataKey={smoothTrend ? 'posTrend' : 'posPct'} name="% Positiva" stroke="#10B981" strokeWidth={2} dot={renderLineDot('#10B981')} />
                              <Line yAxisId="percent" type={smoothTrend ? 'monotone' : 'linear'} dataKey={smoothTrend ? 'neuTrend' : 'neuPct'} name="% Neutral" stroke="#94A3B8" strokeWidth={1.5} dot={renderLineDot('#94A3B8')} />
                              <Line yAxisId="percent" type={smoothTrend ? 'monotone' : 'linear'} dataKey={smoothTrend ? 'negTrend' : 'negPct'} name="% Alerta" stroke="#EF4444" strokeWidth={2} dot={renderLineDot('#EF4444')} />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Footer of Card */}
                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                          <span>Tendencia individual intacta</span>
                          <button
                            type="button"
                            onClick={() => setIsCompareModalOpen(true)}
                            className="text-cyan-600 dark:text-cyan-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Scale className="w-3 h-3" />
                            Comparar en ventana
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : temporalTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={temporalTrendData}
                    margin={{ top: 15, right: 15, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={isDark ? 'rgba(51, 65, 85, 0.45)' : 'rgba(226, 232, 240, 0.85)'}
                    />
                    <XAxis
                      dataKey="fecha"
                      tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }}
                      axisLine={{ stroke: isDark ? '#475569' : '#cbd5e1', strokeWidth: 1.5 }}
                      tickLine={{ stroke: isDark ? '#475569' : '#cbd5e1' }}
                      tickFormatter={(val: string) => {
                        const parts = val.split('-');
                        return parts.length === 3 ? `${parts[2]}/${parts[1]}` : val;
                      }}
                    />
                    {/* Left Y-Axis: Daily Mention Volume */}
                    <YAxis
                      yAxisId="volume"
                      orientation="left"
                      tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 10 }}
                      axisLine={{ stroke: isDark ? '#334155' : '#cbd5e1' }}
                      tickLine={false}
                      allowDecimals={false}
                      tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                    />
                    {/* Right Y-Axis: Percentage of Sentiment (0% - 100%) */}
                    <YAxis
                      yAxisId="percent"
                      orientation="right"
                      domain={[0, 100]}
                      tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }}
                      axisLine={{ stroke: isDark ? '#475569' : '#cbd5e1' }}
                      tickLine={false}
                      unit="%"
                    />
                    <Tooltip content={renderTemporalTooltip} cursor={{ stroke: isDark ? '#475569' : '#cbd5e1', strokeDasharray: '4 4' }} />

                    {/* Stacked Vertical Bars for Mention Volume in the Background */}
                    {showVolumeBars && (
                      <>
                        <Bar
                          yAxisId="volume"
                          dataKey="Positivas"
                          name="Vol. Positiva"
                          stackId="volume"
                          maxBarSize={28}
                        >
                          {temporalTrendData.map((entry, index) => (
                            <Cell
                              key={`cell-vol-pos-${index}`}
                              fill="#10B981"
                              fillOpacity={entry.isToday ? 0.12 : isDark ? 0.25 : 0.2}
                              stroke={entry.isToday ? '#10B981' : 'transparent'}
                              strokeWidth={entry.isToday ? 1 : 0}
                              strokeDasharray={entry.isToday ? '3 3' : undefined}
                            />
                          ))}
                        </Bar>
                        <Bar
                          yAxisId="volume"
                          dataKey="Neutrales"
                          name="Vol. Neutral"
                          stackId="volume"
                          maxBarSize={28}
                        >
                          {temporalTrendData.map((entry, index) => (
                            <Cell
                              key={`cell-vol-neu-${index}`}
                              fill="#94A3B8"
                              fillOpacity={entry.isToday ? 0.1 : isDark ? 0.2 : 0.16}
                              stroke={entry.isToday ? '#94A3B8' : 'transparent'}
                              strokeWidth={entry.isToday ? 1 : 0}
                              strokeDasharray={entry.isToday ? '3 3' : undefined}
                            />
                          ))}
                        </Bar>
                        <Bar
                          yAxisId="volume"
                          dataKey="Negativas"
                          name="Vol. Alerta"
                          stackId="volume"
                          maxBarSize={28}
                          radius={[3, 3, 0, 0]}
                        >
                          {temporalTrendData.map((entry, index) => (
                            <Cell
                              key={`cell-vol-neg-${index}`}
                              fill="#EF4444"
                              fillOpacity={entry.isToday ? 0.12 : isDark ? 0.25 : 0.2}
                              stroke={entry.isToday ? '#EF4444' : 'transparent'}
                              strokeWidth={entry.isToday ? 1 : 0}
                              strokeDasharray={entry.isToday ? '3 3' : undefined}
                            />
                          ))}
                        </Bar>
                      </>
                    )}

                    {/* Superimposed Straight Percentage Lines (Linear, No Spline/Curving) */}
                    <Line
                      yAxisId="percent"
                      type={smoothTrend ? 'monotone' : 'linear'}
                      dataKey={smoothTrend ? 'posTrend' : 'posPct'}
                      name="% Positiva"
                      stroke="#10B981"
                      strokeWidth={2.5}
                      dot={renderLineDot('#10B981')}
                      activeDot={{ r: 5, stroke: '#10B981', strokeWidth: 2, fill: isDark ? '#0f172a' : '#ffffff' }}
                    />
                    <Line
                      yAxisId="percent"
                      type={smoothTrend ? 'monotone' : 'linear'}
                      dataKey={smoothTrend ? 'neuTrend' : 'neuPct'}
                      name="% Neutral"
                      stroke="#94A3B8"
                      strokeWidth={2}
                      dot={renderLineDot('#94A3B8')}
                      activeDot={{ r: 5, stroke: '#94A3B8', strokeWidth: 2, fill: isDark ? '#0f172a' : '#ffffff' }}
                    />
                    <Line
                      yAxisId="percent"
                      type={smoothTrend ? 'monotone' : 'linear'}
                      dataKey={smoothTrend ? 'negTrend' : 'negPct'}
                      name="% Alerta"
                      stroke="#EF4444"
                      strokeWidth={2.5}
                      dot={renderLineDot('#EF4444')}
                      activeDot={{ r: 5, stroke: '#EF4444', strokeWidth: 2, fill: isDark ? '#0f172a' : '#ffffff' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">
                  Sin datos temporales
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
            <span>
              {isMultiActorMode && selectedActorView === 'all'
                ? `Gráficos independientes por actor | Tendencias personales intactas (sin acumular ni apilar)`
                : selectedActorView !== 'all'
                ? `Tendencia individual intacta de ${selectedActorView}`
                : 'Eje Izquierdo: Volumen Total de Notas | Eje Derecho: Porcentajes de Sentimiento (Líneas Rectas)'}
            </span>
            <div className="flex items-center gap-3">
              {isMultiActorMode && (
                <button
                  type="button"
                  onClick={() => setIsCompareModalOpen(true)}
                  className="font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Scale className="w-3 h-3" />
                  Abrir Comparativa en Ventana Independiente
                </button>
              )}
              <span className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
                {isMultiActorMode && selectedActorView === 'all'
                  ? `${activeSelectedActores.length} actores con tendencias individuales intactas`
                  : `${temporalTrendData.length} cortes temporales analizados`}
              </span>
            </div>
          </div>
        </div>

      {/* 3. Top 10 Temas y Categorías - Single Full Row (al igual que las tendencias temporales) */}
      <div className="w-full rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900/95 p-5 shadow-xs">
        <div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-500" />
                {chartDimension === 'temas'
                  ? selectedTemaActor !== 'all'
                    ? `Top 10 Temas: ${selectedTemaActor}`
                    : 'Top 10 Temas y Categorías'
                  : 'Top 10 Actores Monitoreados'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {chartDimension === 'temas'
                  ? selectedTemaActor !== 'all'
                    ? `Agenda temática y volumen exclusivo para ${selectedTemaActor}`
                    : temaStackMode === 'actor'
                    ? 'Volumen desglosado por actor en cada tema (sin englobar)'
                    : 'Volumen de menciones agrupado por sentimiento'
                  : 'Volumen de menciones agrupado por sentimiento'}
              </p>
            </div>

            {/* Primary Dimension Switcher: Temas (Default) and Actores */}
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setChartDimension('temas')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  chartDimension === 'temas'
                    ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Ver Top 10 Temas y Categorías"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Temas</span>
              </button>
              <button
                type="button"
                onClick={() => setChartDimension('actores')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  chartDimension === 'actores'
                    ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Ver Top 10 Actores Monitoreados"
              >
                <Users2 className="w-3.5 h-3.5" />
                <span>Actores</span>
              </button>
            </div>
          </div>

          {/* Quick Actor Selector Buttons to Separate Themes by Actor */}
          {chartDimension === 'temas' && availableTemaActores.length >= 2 && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 mb-3 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-1.5 flex items-center gap-1">
                  <Users2 className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                  <span>Separar por Actor:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTemaActor('all')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    selectedTemaActor === 'all'
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                  }`}
                >
                  Todos ({availableTemaActores.length})
                </button>
                {availableTemaActores.map((actor, idx) => {
                  const color = ACTOR_PALETTE[idx % ACTOR_PALETTE.length];
                  const isCurrent = selectedTemaActor === actor;
                  return (
                    <button
                      key={actor}
                      type="button"
                      onClick={() => setSelectedTemaActor(actor)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs border border-slate-300 dark:border-slate-600'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="truncate max-w-[130px] sm:max-w-none">{actor}</span>
                    </button>
                  );
                })}
              </div>

              {/* Stacking mode switcher when 'Todos' is selected */}
              {selectedTemaActor === 'all' && (
                <div className="flex items-center p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-900/60 text-[11px] ml-auto">
                  <button
                    type="button"
                    onClick={() => setTemaStackMode('sentiment')}
                    className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                      temaStackMode === 'sentiment'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                    }`}
                    title="Ver barras divididas por sentimiento"
                  >
                    Por Sentimiento
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemaStackMode('actor')}
                    className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                      temaStackMode === 'actor'
                        ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                    }`}
                    title="Ver barras divididas por cada actor con su color"
                  >
                    Por Actor
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Dynamic Legend */}
          <div className="flex flex-wrap items-center gap-3.5 text-xs mb-3">
            {chartDimension === 'temas' && selectedTemaActor === 'all' && temaStackMode === 'actor' ? (
              availableTemaActores.map((actor, idx) => {
                const color = ACTOR_PALETTE[idx % ACTOR_PALETTE.length];
                return (
                  <span key={actor} className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: color }} />
                    <span className="truncate max-w-[150px]">{actor}</span>
                  </span>
                );
              })
            ) : (
              <>
                <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Positivas
                </span>
                <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" /> Neutrales
                </span>
                <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Negativas
                </span>
              </>
            )}
          </div>
        </div>

        <div className="h-80 w-full min-h-[300px]">
          {activeBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={activeBarData}
                maxBarSize={48}
                barCategoryGap="20%"
                margin={{ top: 15, right: 15, left: -15, bottom: 40 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.8)'}
                />
                <XAxis
                  dataKey="actor"
                  tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }}
                  tickFormatter={(val: string) => (val && val.length > 20 ? `${val.slice(0, 18)}…` : val)}
                  axisLine={{ stroke: isDark ? '#475569' : '#cbd5e1', strokeWidth: 1.5 }}
                  tickLine={{ stroke: isDark ? '#475569' : '#cbd5e1' }}
                  angle={-15}
                  textAnchor="end"
                  interval={0}
                  height={48}
                />
                <YAxis
                  tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }}
                  axisLine={{ stroke: isDark ? '#475569' : '#cbd5e1' }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={renderBarTooltip} cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }} />

                {/* Render Stacked Bars by Actor when selected, otherwise by Sentiment */}
                {chartDimension === 'temas' && selectedTemaActor === 'all' && temaStackMode === 'actor' ? (
                  availableTemaActores.map((actor, idx) => (
                    <Bar
                      key={actor}
                      dataKey={`actor_vol_${idx}`}
                      name={actor}
                      stackId="tema_stack"
                      fill={ACTOR_PALETTE[idx % ACTOR_PALETTE.length]}
                      maxBarSize={48}
                      radius={idx === availableTemaActores.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))
                ) : (
                  <>
                    <Bar dataKey="Positivas" stackId="a" fill={COLOR_POSITIVA} maxBarSize={48} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Neutrales" stackId="a" fill={COLOR_NEUTRAL} maxBarSize={48} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Negativas" stackId="a" fill={COLOR_NEGATIVA} maxBarSize={48} radius={[4, 4, 0, 0]} />
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-slate-400">
              Sin datos que coincidan con los filtros
            </div>
          )}
        </div>
      </div>

      {/* 3. Lower Row: Share of Voice & Reporteros Clave (debajo de las tendencias y la top 10 temas) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Share of Voice (SOV) Medios / Temas */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900/95 p-5 shadow-xs flex flex-col justify-between">
          <div>
            {/* Header with Title and Dimension Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <PieIcon className="w-4 h-4 text-cyan-500" />
                  Share of Voice
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {sovDimension === 'medios' ? 'Distribución porcentual de cobertura por medio' : 'Distribución porcentual por eje temático'}
                </p>
              </div>

              {/* Dimension Switcher: Medios vs Temas */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg text-xs self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setSovDimension('medios')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    sovDimension === 'medios'
                      ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  Medios
                </button>
                <button
                  type="button"
                  onClick={() => setSovDimension('temas')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    sovDimension === 'temas'
                      ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  Temas
                </button>
              </div>
            </div>

            {/* View Mode Switcher: Ambos / Pastel / Comparativa */}
            <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100 dark:border-slate-800 text-[11px]">
              <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 p-0.5 rounded-md border border-slate-200/60 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setSovViewMode('both')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                    sovViewMode === 'both'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  title="Gráfico de Pastel + Comparativa"
                >
                  Dual
                </button>
                <button
                  type="button"
                  onClick={() => setSovViewMode('pie')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                    sovViewMode === 'pie'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  title="Solo Gráfico de Pastel"
                >
                  Pastel
                </button>
                <button
                  type="button"
                  onClick={() => setSovViewMode('bars')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                    sovViewMode === 'bars'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  title="Lista Comparativa como en la referencia"
                >
                  Comparativa
                </button>
              </div>

              {/* Pie vs Donut switcher when chart is visible */}
              {sovViewMode !== 'bars' && (
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <span className="text-[10px] hidden sm:inline">Diseño:</span>
                  <button
                    type="button"
                    onClick={() => setSovChartType('pie')}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
                      sovChartType === 'pie'
                        ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800'
                        : 'hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    Pastel
                  </button>
                  <button
                    type="button"
                    onClick={() => setSovChartType('donut')}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
                      sovChartType === 'donut'
                        ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800'
                        : 'hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    Dona
                  </button>
                </div>
              )}
            </div>

            {/* Content Display: Pie Chart */}
            {(sovViewMode === 'both' || sovViewMode === 'pie') && (
              <div className={`${sovViewMode === 'both' ? 'h-44' : 'h-64'} w-full min-h-[160px] relative transition-all`}>
                {shareOfVoicePieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={shareOfVoicePieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={sovChartType === 'donut' ? (sovViewMode === 'both' ? 34 : 46) : 0}
                        outerRadius={sovViewMode === 'both' ? 68 : 88}
                        paddingAngle={shareOfVoicePieData.length > 1 ? 1.5 : 0}
                        dataKey="value"
                        stroke={isDark ? '#0f172a' : '#ffffff'}
                        strokeWidth={2}
                      >
                        {shareOfVoicePieData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_PALETTE[index % PIE_PALETTE.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div style={customTooltipStyle}>
                                <p className="font-bold text-slate-900 dark:text-white mb-1 uppercase tracking-wide text-[11px]">{data.name}</p>
                                <div className="flex items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-300">
                                  <span>Volumen:</span>
                                  <span className="font-bold font-mono text-slate-900 dark:text-white">{data.value.toLocaleString()} notas</span>
                                </div>
                                <div className="flex items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                                  <span>Participación (SOV):</span>
                                  <span className="font-bold font-mono text-cyan-600 dark:text-cyan-400">{data.pct}%</span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-slate-400">
                    Sin datos
                  </div>
                )}
              </div>
            )}

            {/* Comparative Breakdown Table (Exact match to Reference Image) */}
            {(sovViewMode === 'both' || sovViewMode === 'bars') && (
              <div className={`${sovViewMode === 'both' ? 'mt-2 pt-2 border-t border-slate-100 dark:border-slate-800' : 'mt-1'}`}>
                {/* Image-Style Header */}
                <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-200 dark:border-slate-700/80">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    {sovDimension === 'medios' ? 'MEDIOS PRINCIPALES' : 'TEMAS PRINCIPALES'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {activeSovList.length} registrados
                  </span>
                </div>

                {/* Comparative Bars List */}
                <div className={`${sovViewMode === 'both' ? 'max-h-48' : 'max-h-[340px]'} overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 pr-1`}>
                  {activeSovList.length > 0 ? (
                    activeSovList.slice(0, sovViewMode === 'both' ? 7 : 18).map((item, idx) => (
                      <div
                        key={item.name}
                        className="py-1.5 flex items-center justify-between gap-2.5 text-xs hover:bg-slate-50/60 dark:hover:bg-slate-800/30 px-1 rounded transition-colors"
                      >
                        {/* Column 1: Name */}
                        <div className="w-24 sm:w-28 shrink-0 flex items-center gap-1.5 min-w-0">
                          {sovViewMode === 'both' && (
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: PIE_PALETTE[idx % PIE_PALETTE.length] }}
                            />
                          )}
                          <span
                            className="font-medium text-slate-800 dark:text-slate-200 uppercase truncate text-[11px]"
                            title={item.name}
                          >
                            {item.name}
                          </span>
                        </div>

                        {/* Column 2: Horizontal Bar (Proportional to Top Item, exactly as in image) */}
                        <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.max(5, Math.round((item.value / maxSovValue) * 100))}%`,
                              backgroundColor: sovViewMode === 'both'
                                ? PIE_PALETTE[idx % PIE_PALETTE.length]
                                : '#334155'
                            }}
                          />
                        </div>

                        {/* Column 3: Count */}
                        <span className="w-9 text-right text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                          {item.value}
                        </span>

                        {/* Column 4: Percentage */}
                        <span className="w-10 text-right font-bold text-slate-900 dark:text-white font-mono text-[11px]">
                          {item.pctRound}%
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center text-xs text-slate-400">
                      Sin registros para mostrar
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top Key Reporters */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900/95 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users2 className="w-4 h-4 text-cyan-500" />
                Reporteros Clave
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Periodistas con mayor impacto y seguimiento
            </p>

            <div className="space-y-3">
              {topReporterosData.map(rep => (
                <div
                  key={rep.reportero}
                  className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between"
                >
                  <div className="truncate mr-2">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {rep.reportero}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {rep.menciones} notas publicadas
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      +{rep.positivas}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400">
                      -{rep.negativas}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-cyan-500" />
            <span>Frecuencia y balance editorial en tiempo real</span>
          </div>
        </div>
      </div>

      {/* Ventana Independiente de Comparación de Tendencias (Modal) */}
      <ActorTrendComparisonModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        records={records}
        actores={activeSelectedActores}
        allAvailableActores={allAvailableActores}
        onUpdateActores={onUpdateSelectedActores}
        dateRange={dateRange}
        filters={filters}
      />
    </div>
  );
};
