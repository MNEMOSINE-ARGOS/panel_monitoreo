import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MediaRecord, Calificacion, FilterState, FilterOptionItem, PerspectiveDeepDive } from '../types';
import { repository } from '../services/repository';
import { PoliticalAnalysisCharts } from './PoliticalAnalysisCharts';
import { generatePerspectivePdf } from '../utils/generatePerspectivePdf';
import { getPresetDateRange } from '../utils/dateUtils';
import {
  Users,
  Newspaper,
  Tag,
  Search,
  ArrowRight,
  Smile,
  Meh,
  Frown,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  BarChart3,
  Calendar,
  Sparkles,
  ShieldCheck,
  Building2,
  RefreshCw,
  MapPin,
  Compass,
  Layers,
  FileText,
  Activity,
  Download,
  CheckCircle2
} from 'lucide-react';
import { GeoCategoryFilterButtons } from './GeoCategoryFilterButtons';
import { FacebookToggle } from './FacebookToggle';

export type PerspectiveMode = 'actores' | 'medios' | 'temas';

interface PerspectiveEntity {
  name: string;
  total: number;
  pos: number;
  neu: number;
  neg: number;
  netSentiment: number;
}

interface PerspectiveViewsProps {
  initialMode?: PerspectiveMode;
  initialDateRange?: { preset: string; start: string; end: string };
  onSelectEntityFilter: (
    type: 'actor' | 'medio' | 'tema',
    name: string,
    dateRange?: { preset: string; start: string; end: string }
  ) => void;
  onOpenRecord: (record: MediaRecord) => void;
  filters?: FilterState;
  onFilterChange?: (updater: (prev: FilterState) => FilterState) => void;
  availableEstados?: Array<string | FilterOptionItem>;
  availableMunicipios?: Array<string | FilterOptionItem>;
  availableCategorias?: Array<string | FilterOptionItem>;
  incluirFacebook?: boolean;
  onToggleFacebook?: () => void;
}

export const PerspectiveViews: React.FC<PerspectiveViewsProps> = ({
  initialMode = 'actores',
  initialDateRange,
  onSelectEntityFilter,
  onOpenRecord,
  filters,
  onFilterChange,
  availableEstados = [],
  availableMunicipios = [],
  availableCategorias = [],
  incluirFacebook,
  onToggleFacebook
}) => {
  const [activeMode, setActiveMode] = useState<PerspectiveMode>(initialMode);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntityName, setSelectedEntityName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDeepDive, setLoadingDeepDive] = useState(false);

  // Date range state for 3-perspectives reading
  const [dateRange, setDateRange] = useState<{
    preset: 'all' | 'today' | '7d' | '30d' | '60d' | '90d' | 'custom';
    start: string;
    end: string;
  }>({
    preset: (initialDateRange?.preset as any) || 'all',
    start: initialDateRange?.start || '',
    end: initialDateRange?.end || ''
  });

  // Perspective summary data
  const [data, setData] = useState<{
    actores: PerspectiveEntity[];
    medios: PerspectiveEntity[];
    temas: PerspectiveEntity[];
  }>({
    actores: [],
    medios: [],
    temas: []
  });

  // Deep dive data for selected entity
  const [deepDive, setDeepDive] = useState<PerspectiveDeepDive | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'charts' | 'notes'>('charts');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);

  const handleExportPoliticalPdf = async () => {
    if (!deepDive) return;

    setGeneratingPdf(true);
    setPdfSuccess(false);
    try {
      await generatePerspectivePdf({
        deepDive,
        entityName: deepDive.name,
        mode: activeMode,
        dateRange: dateRange.preset !== 'all' ? dateRange : undefined,
        filters
      });
      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 4000);
    } catch (err) {
      console.error('Error al generar PDF de análisis político:', err);
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Preset handler for date periods
  const handleDatePreset = (preset: 'all' | 'today' | '7d' | '30d' | '60d' | '90d' | 'custom') => {
    if (preset === 'custom') {
      setDateRange((prev) => ({ ...prev, preset: 'custom' }));
      return;
    }
    const { start, end } = getPresetDateRange(preset);

    setDateRange({
      preset,
      start,
      end
    });
  };

  // Load summaries on mount or whenever dateRange or extra filters change
  useEffect(() => {
    let isMounted = true;
    const loadSummaries = async () => {
      setLoading(true);
      try {
        const startParam = dateRange.preset === 'all' ? undefined : (dateRange.start || undefined);
        const endParam = dateRange.preset === 'all' ? undefined : (dateRange.end || undefined);
        const res = await repository.fetchPerspectives(
          false,
          startParam,
          endParam,
          filters?.estados,
          filters?.municipios,
          filters?.categorias
        );
        if (res && isMounted) {
          setData({
            actores: res.actores || [],
            medios: res.medios || [],
            temas: res.temas || []
          });
          // Auto-select first entity of current mode if none selected or if previous entity not in new list
          const currentList = res[activeMode] || [];
          if (currentList.length > 0) {
            setSelectedEntityName((prev) => {
              if (prev && currentList.some((e: PerspectiveEntity) => e.name === prev)) {
                return prev;
              }
              return currentList[0].name;
            });
          } else {
            setSelectedEntityName(null);
            setDeepDive(null);
          }
        }
      } catch (err) {
        console.error('Error fetching perspectives:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadSummaries();
    return () => {
      isMounted = false;
    };
  }, [
    dateRange.preset,
    dateRange.start,
    dateRange.end,
    filters?.estados,
    filters?.municipios,
    filters?.categorias
  ]);

  // Synchronize initialMode prop with activeMode state
  useEffect(() => {
    if (initialMode && initialMode !== activeMode) {
      setActiveMode(initialMode);
    }
  }, [initialMode]);

  // When activeMode changes, select the top entity in that mode if available
  useEffect(() => {
    const list = data[activeMode] || [];
    if (list.length > 0) {
      setSelectedEntityName(list[0].name);
    } else {
      setSelectedEntityName(null);
      setDeepDive(null);
    }
    setSearchTerm('');
  }, [activeMode, data]);

  // Fetch deep dive when selectedEntityName, activeMode, dateRange, or extra filters change
  useEffect(() => {
    if (!selectedEntityName) return;

    let isMounted = true;
    const fetchDetail = async () => {
      setLoadingDeepDive(true);
      try {
        const typeMap: Record<PerspectiveMode, 'actor' | 'medio' | 'tema'> = {
          actores: 'actor',
          medios: 'medio',
          temas: 'tema'
        };
        const startParam = dateRange.preset === 'all' ? undefined : (dateRange.start || undefined);
        const endParam = dateRange.preset === 'all' ? undefined : (dateRange.end || undefined);
        const detail = await repository.fetchEntityDeepDive(
          typeMap[activeMode],
          selectedEntityName,
          startParam,
          endParam,
          filters?.estados,
          filters?.municipios,
          filters?.categorias
        );
        if (detail && isMounted) {
          setDeepDive(detail);
        }
      } catch (err) {
        console.error('Error fetching deep dive:', err);
      } finally {
        if (isMounted) setLoadingDeepDive(false);
      }
    };

    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [
    selectedEntityName,
    activeMode,
    dateRange.preset,
    dateRange.start,
    dateRange.end,
    filters?.estados,
    filters?.municipios,
    filters?.categorias
  ]);

  // Current entity list filtered by search
  const currentEntities = useMemo(() => {
    const list = data[activeMode] || [];
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter((e) => e.name.toLowerCase().includes(term));
  }, [data, activeMode, searchTerm]);

  const getSentimentBadge = (calif?: string) => {
    const c = (calif || '').toLowerCase();
    if (c.includes('positiv')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
          <Smile className="w-3 h-3" /> Positiva
        </span>
      );
    }
    if (c.includes('negativ')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
          <Frown className="w-3 h-3" /> Negativa
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-600 dark:text-slate-300 border border-slate-500/30">
        <Meh className="w-3 h-3" /> Neutral
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header & 3-Way Mode Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-xs font-bold uppercase tracking-wider border border-cyan-500/20">
              3 Procesos de Lectura Especializada
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {activeMode === 'actores' && '1. Lectura por Actores Monitoreados'}
            {activeMode === 'medios' && '2. Lectura por Medios de Comunicación'}
            {activeMode === 'temas' && '3. Lectura por Temas y Agenda Pública'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {activeMode === 'actores' && 'Seguimiento reputacional individual, balance de opinión, medios que lo cubren y sus notas más recientes.'}
            {activeMode === 'medios' && 'Análisis de línea editorial, reporteros más activos, volumen de notas y tono informativo del medio.'}
            {activeMode === 'temas' && 'Monitoreo de coyuntura y agenda pública, actores involucrados y medios con mayor cobertura.'}
          </p>
        </div>

        {/* 3 Modes Switcher Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shrink-0 self-start md:self-auto">
          <button
            onClick={() => setActiveMode('actores')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeMode === 'actores'
                ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>1. Por Actores</span>
          </button>

          <button
            onClick={() => setActiveMode('medios')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeMode === 'medios'
                ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Newspaper className="w-4 h-4" />
            <span>2. Por Medios</span>
          </button>

          <button
            onClick={() => setActiveMode('temas')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeMode === 'temas'
                ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>3. Por Temas</span>
          </button>
        </div>
      </div>

      {/* Date Range / Period Filter & Cobertura Filter Bar */}
      <div className="relative z-30 flex flex-col gap-3.5 p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-xl shadow-xs">
        {/* Row 1: Date Period / Preset Filter */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Periodo o Rango de Fechas
                </span>
                {dateRange.preset !== 'all' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-semibold border border-cyan-500/30">
                    Filtro Temporal Activo
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {dateRange.preset === 'all' && 'Analizando todo el histórico de notas (122,264+)'}
                {dateRange.preset === 'today' && `Mostrando notas registradas hoy (${dateRange.end})`}
                {dateRange.preset === '7d' && `Últimos 7 días (${dateRange.start} al ${dateRange.end})`}
                {dateRange.preset === '30d' && `Últimos 30 días (${dateRange.start} al ${dateRange.end})`}
                {dateRange.preset === '60d' && `Últimos 60 días (${dateRange.start} al ${dateRange.end})`}
                {dateRange.preset === '90d' && `Últimos 90 días (${dateRange.start} al ${dateRange.end})`}
                {dateRange.preset === 'custom' && (dateRange.start || dateRange.end ? `Desde ${dateRange.start || 'inicio'} hasta ${dateRange.end || 'hoy'}` : 'Seleccione fechas específicas')}
              </p>
            </div>
          </div>

          {/* Date presets & Custom inputs */}
          <div className="flex flex-wrap items-center gap-1.5 self-start md:self-auto">
            {(['all', 'today', '7d', '30d', '60d', '90d'] as const).map((p) => {
              const labels: Record<string, string> = {
                all: 'Todo',
                today: 'Hoy',
                '7d': '7 Días',
                '30d': '30 Días',
                '60d': '60 Días',
                '90d': '90 Días'
              };
              const isActive = dateRange.preset === p;
              return (
                <button
                  key={p}
                  onClick={() => handleDatePreset(p)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                    isActive
                      ? 'bg-cyan-600 text-white border-cyan-500 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-cyan-500/40'
                  }`}
                >
                  {labels[p]}
                </button>
              );
            })}

            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-700">
              <span className="text-[11px] text-slate-400 font-medium">Desde</span>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange((prev) => ({ ...prev, preset: 'custom', start: e.target.value }))}
                className="px-2 py-1 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              <span className="text-[11px] text-slate-400 font-medium">Hasta</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, preset: 'custom', end: e.target.value }))}
                className="px-2 py-1 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              {dateRange.preset !== 'all' && (
                <button
                  onClick={() => handleDatePreset('all')}
                  className="px-2.5 py-1 text-xs rounded-xl text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Restablecer a todo el histórico"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Cobertura & Categoría Filter Buttons: Estados, Municipios, Categorías */}
        {filters && onFilterChange && (
          <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Filtros de Cobertura y Categoría:
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                (Acota {activeMode === 'actores' ? 'los actores' : activeMode === 'medios' ? 'los medios' : 'los temas'} y sus notas)
              </span>
            </div>

            <GeoCategoryFilterButtons
              filters={filters}
              onFilterChange={onFilterChange}
              availableEstados={availableEstados}
              availableMunicipios={availableMunicipios}
              availableCategorias={availableCategorias}
              layout="horizontal"
            />
          </div>
        )}
      </div>

      {/* Main 2-Column Layout: Sidebar of Entities + Selected Entity Deep Dive */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Entity Directory (4 columns on lg) */}
        <div className="lg:col-span-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 p-4 backdrop-blur-xl shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {activeMode === 'actores' && 'Directorio de Actores'}
              {activeMode === 'medios' && 'Directorio de Medios'}
              {activeMode === 'temas' && 'Directorio de Temas'}
            </span>
            <span className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
              {currentEntities.length} registros
            </span>
          </div>

          {/* Search in Directory */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Filtrar ${activeMode}...`}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Entity List */}
          <div className="overflow-y-auto max-h-[580px] space-y-1.5 pr-1 scrollbar-thin">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-cyan-500" />
                <span>Consultando 122,264 notas...</span>
              </div>
            ) : currentEntities.length > 0 ? (
              currentEntities.map((ent) => {
                const isSelected = selectedEntityName === ent.name;
                const posPct = ent.total > 0 ? Math.round((ent.pos / ent.total) * 100) : 0;
                const negPct = ent.total > 0 ? Math.round((ent.neg / ent.total) * 100) : 0;
                const neuPct = 100 - posPct - negPct;

                return (
                  <button
                    key={ent.name}
                    onClick={() => setSelectedEntityName(ent.name)}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-50/70 dark:bg-cyan-950/40 shadow-xs'
                        : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-bold truncate ${isSelected ? 'text-cyan-700 dark:text-cyan-300' : 'text-slate-800 dark:text-slate-200'}`}>
                        {ent.name}
                      </span>
                      <span className="text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                        {ent.total.toLocaleString()} notas
                      </span>
                    </div>

                    {/* Sentiment Balance bar */}
                    <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
                      <div style={{ width: `${posPct}%` }} className="bg-emerald-500" title={`Positivas: ${posPct}%`} />
                      <div style={{ width: `${neuPct}%` }} className="bg-slate-400/60" title={`Neutrales: ${neuPct}%`} />
                      <div style={{ width: `${negPct}%` }} className="bg-rose-500" title={`Negativas: ${negPct}%`} />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">+{ent.pos} pos</span>
                      <span className="font-mono text-slate-500">{ent.neu} neu</span>
                      <span className="text-rose-600 dark:text-rose-400 font-medium">-{ent.neg} neg</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No se encontraron coincidencias para &ldquo;{searchTerm}&rdquo;
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Entity Deep Dive Profile & Feed (8 columns on lg) */}
        <div className="lg:col-span-8 space-y-5">
          {loadingDeepDive ? (
            <div className="p-12 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 text-center flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-500" />
              <p className="text-xs text-slate-500 font-medium">Analizando perfil detallado en PostgreSQL...</p>
            </div>
          ) : deepDive ? (
            <>
              {/* Profile Card Header */}
              <div className="p-6 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-xl shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center justify-center font-bold text-lg">
                      {deepDive.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                        {activeMode === 'actores' && 'Actor Monitoreado'}
                        {activeMode === 'medios' && 'Medio de Comunicación'}
                        {activeMode === 'temas' && 'Tema / Asunto Público'}
                      </span>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                        {deepDive.name}
                      </h3>
                    </div>
                  </div>

                  {/* Actions: Generar PDF y Ver en Monitor Global */}
                  <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto no-print-pdf">
                    {onToggleFacebook && (
                      <FacebookToggle active={Boolean(incluirFacebook)} onToggle={onToggleFacebook} />
                    )}
                    <button
                      type="button"
                      disabled={generatingPdf}
                      onClick={handleExportPoliticalPdf}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        pdfSuccess
                          ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
                          : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-cyan-500/20'
                      }`}
                      title="Descargar reporte en PDF exactamente como se visualiza este módulo"
                    >
                      {generatingPdf ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Generando PDF...</span>
                        </>
                      ) : pdfSuccess ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                          <span>¡Reporte Descargado!</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Generar Reporte PDF</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        const typeMap: Record<PerspectiveMode, 'actor' | 'medio' | 'tema'> = {
                          actores: 'actor',
                          medios: 'medio',
                          temas: 'tema'
                        };
                        onSelectEntityFilter(
                          typeMap[activeMode],
                          deepDive.name,
                          dateRange.preset !== 'all' ? dateRange : undefined
                        );
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                    >
                      <span>Ver en Monitor Global</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Sub-Navigation Tabs: Gráficos de Análisis Político vs Expediente de Notas */}
                <div className="no-print-pdf flex flex-wrap items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <button
                    type="button"
                    onClick={() => setActiveDetailTab('charts')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeDetailTab === 'charts'
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>📊 Gráficos de Análisis Político & Gubernamental</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveDetailTab('notes')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeDetailTab === 'notes'
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>📰 Expediente de Notas ({deepDive.recentNotes.length})</span>
                  </button>
                </div>

                {/* Tab 1: Gráficos de Análisis Político & Gubernamental */}
                {activeDetailTab === 'charts' ? (
                  <div className="space-y-6">
                    <PoliticalAnalysisCharts
                      mode={activeMode}
                      deepDive={deepDive}
                      allEntities={data[activeMode]}
                      dateRange={dateRange}
                      filters={filters}
                      onSelectEntity={(name) => setSelectedEntityName(name)}
                      onNavigateToGlobal={() => {
                        const typeMap: Record<PerspectiveMode, 'actor' | 'medio' | 'tema'> = {
                          actores: 'actor',
                          medios: 'medio',
                          temas: 'tema'
                        };
                        onSelectEntityFilter(
                          typeMap[activeMode],
                          deepDive.name,
                          dateRange.preset !== 'all' ? dateRange : undefined
                        );
                      }}
                    />

                    {/* Quick Preview of Recent Notes with shortcut to full dossier */}
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Últimas Notas Registradas de {deepDive.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveDetailTab('notes')}
                          className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          Ver todas las {deepDive.recentNotes.length} notas <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {deepDive.recentNotes.slice(0, 4).map((note) => (
                          <div
                            key={note.id}
                            onClick={() => onOpenRecord(note)}
                            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 hover:border-cyan-500/50 transition-all cursor-pointer space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-1 text-[11px]">
                              <div className="flex items-center gap-1.5 truncate">
                                {getSentimentBadge(note.calificacion)}
                                <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{note.medio}</span>
                              </div>
                              <span className="text-slate-400 font-mono text-[10px] shrink-0">{note.fecha}</span>
                            </div>
                            <h5 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                              {note.titulo || note.resumen}
                            </h5>
                            <div className="flex items-center justify-between pt-0.5 text-[10px]">
                              <span className="text-slate-500 dark:text-slate-400 truncate">
                                {note.reportero && note.reportero.toLowerCase() !== 'redacción' ? note.reportero : ''}
                              </span>
                              {note.link && (
                                <a
                                  href={note.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 font-bold text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 hover:underline shrink-0"
                                  title="Abrir nota original en el portal"
                                >
                                  <span>Ver nota</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Tab 2: Expediente de Notas & Ficha Detallada */
                  <div className="space-y-5">
                    {/* KPI Metrics for this Entity */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50">
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                          Total Notas
                        </span>
                        <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                          {deepDive.total.toLocaleString()}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20">
                        <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 block mb-1">
                          Positivas
                        </span>
                        <span className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
                          {deepDive.pos.toLocaleString()}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50">
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                          Neutrales
                        </span>
                        <span className="text-xl font-bold font-mono text-slate-700 dark:text-slate-300">
                          {deepDive.neu.toLocaleString()}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20">
                        <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 block mb-1">
                          Negativas (Riesgo)
                        </span>
                        <span className="text-xl font-bold font-mono text-rose-700 dark:text-rose-400">
                          {deepDive.neg.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Secondary breakdown tags */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      {/* Secondary 1 */}
                      <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {activeMode === 'actores' && 'Temas Predominantes'}
                          {activeMode === 'medios' && 'Temas más Cubiertos'}
                          {activeMode === 'temas' && 'Actores más Mencionados'}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {deepDive.secondary.length > 0 ? (
                            deepDive.secondary.map((s) => (
                              <span
                                key={s.label}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300"
                              >
                                <span>{s.label}</span>
                                <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                                  {s.count}
                                </span>
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">Sin datos registrados</span>
                          )}
                        </div>
                      </div>

                      {/* Secondary 2 */}
                      <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {activeMode === 'actores' && 'Medios con Mayor Cobertura'}
                          {activeMode === 'medios' && 'Reporteros más Activos'}
                          {activeMode === 'temas' && 'Medios con Mayor Difusión'}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {deepDive.extra.length > 0 ? (
                            deepDive.extra.map((e) => (
                              <span
                                key={e.label}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300"
                              >
                                <span>{e.label}</span>
                                <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                                  {e.count}
                                </span>
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">Sin datos registrados</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Feed of Recent Notes for this Entity */}
                    <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Notas Recientes de {deepDive.name} ({deepDive.recentNotes.length})
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Ordenado por fecha más reciente
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {deepDive.recentNotes.map((note) => (
                          <div
                            key={note.id}
                            onClick={() => onOpenRecord(note)}
                            className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800/70 hover:border-cyan-500/50 hover:bg-white dark:hover:bg-slate-800/70 transition-all cursor-pointer shadow-xs space-y-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                {getSentimentBadge(note.calificacion)}
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                  {note.medio}
                                </span>
                                {note.tema && (
                                  <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-[10px] font-bold">
                                    {note.tema}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>{note.fecha}</span>
                              </div>
                            </div>

                            <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                              {note.titulo || note.resumen}
                            </h4>

                            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                              {note.resumen}
                            </p>

                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                              <span>Reportero: <strong className="text-slate-600 dark:text-slate-300 font-semibold">{note.reportero}</strong></span>
                              <div className="flex items-center gap-2.5">
                                {note.link && (
                                  <a
                                    href={note.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-semibold text-xs transition-colors"
                                    title="Abrir enlace original de la nota"
                                  >
                                    <span>Ver nota</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                                <span className="text-slate-500 dark:text-slate-400 font-semibold hover:text-cyan-600 dark:hover:text-cyan-400 hover:underline flex items-center gap-1">
                                  Ver ficha completa <ChevronRight className="w-3.5 h-3.5" />
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-12 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 text-center text-xs text-slate-400">
              Seleccione una entidad del directorio para ver su lectura especializada.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
