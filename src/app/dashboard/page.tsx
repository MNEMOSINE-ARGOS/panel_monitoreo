"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Radio,
  FileSpreadsheet,
  Calendar,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  X,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import { MediaRecord, Calificacion, KPIStats, FilterState } from '../../types/index';

const PAGE_SIZE = 50;

export default function DashboardPage() {
  const [records, setRecords] = useState<MediaRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedRecord, setSelectedRecord] = useState<MediaRecord | null>(null);
  const [dataSource, setDataSource] = useState<'postgres' | 'sheets'>('postgres');
  const [activeEngine, setActiveEngine] = useState<string>('PostgreSQL 16+ (Fase 2)');
  const [totalInDb, setTotalInDb] = useState<number>(122264);

  // Filtros cruzados
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    actores: [],
    medios: [],
    temas: [],
    calificaciones: [],
    reporteros: [],
    dateRange: {
      preset: 'all',
      start: '',
      end: '',
    },
    sortField: 'fecha',
    sortDirection: 'desc',
  });

  // Dropdown UI toggles
  const [activeDropdown, setActiveDropdown] = useState<'actores' | 'medios' | 'reporteros' | null>(null);
  const [dropdownSearch, setDropdownSearch] = useState<string>('');

  // 1. CARGA DE DATOS DESDE LA API CON SOPORTE PARA POSTGRESQL (FASE 2) Y SHEETS (FASE 1)
  const fetchRecords = useCallback(async (isRefreshAction = false, overrideSource?: 'postgres' | 'sheets') => {
    if (isRefreshAction) setIsRefreshing(true);
    else setIsLoading(true);

    const sourceToUse = overrideSource || dataSource;

    try {
      const res = await fetch(`/api/records?source=${sourceToUse}&limit=1000&refresh=${isRefreshAction}`);
      if (res.ok) {
        const data = await res.json();
        const loaded: MediaRecord[] = data.records || data || [];
        setRecords(loaded);
        if (data.source) setActiveEngine(data.source);
        if (data.totalInDatabase) setTotalInDb(data.totalInDatabase);
        setSyncStatus(`Conectado a ${data.source || 'PostgreSQL'} • ${data.totalInDatabase ? data.totalInDatabase.toLocaleString() : loaded.length.toLocaleString()} notas en base de datos`);
      } else {
        // Fallback a export público si la API route estuviese en proceso
        const fallbackRes = await fetch(
          'https://docs.google.com/spreadsheets/d/18GrnU-Q1Ci44zuiMj2fxjW169mHnKlrIRlfB-8PcPI0/gviz/tq?tqx=out:csv&sheet=DATA'
        );
        if (fallbackRes.ok) {
          const csvText = await fallbackRes.text();
          const rows = csvText.split('\n').filter((l) => l.trim().length > 0);
          const mapped: MediaRecord[] = [];
          for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
            if (cols.length < 3) continue;
            const rawC = (cols[6] || 'Neutral').toUpperCase();
            const calif: Calificacion = rawC.includes('POS')
              ? 'Positiva'
              : rawC.includes('NEG')
              ? 'Negativa'
              : 'Neutral';

            mapped.push({
              id: cols[0] || `rec-${i}`,
              id_: cols[0] || `rec-${i}`,
              fecha: cols[1] || '',
              usuarioId: cols[2] || '',
              titulo: cols[3] || 'Sin título',
              dependencia: cols[4] || undefined,
              region: cols[5] || undefined,
              calificacion: calif,
              medio: cols[7] || 'Medio General',
              reportero: cols[8] || 'Redacción',
              actor: cols[10] || 'Entidad General',
              link: cols[13] || '#',
              resumen: cols[14] || cols[3] || 'Sin resumen',
            });
          }
          setRecords(mapped);
          setSyncStatus(`Sincronización fallback exitosa: ${mapped.length.toLocaleString()} registros procesados`);
        }
      }
    } catch (err) {
      console.error('Error al cargar notas de monitoreo:', err);
      setSyncStatus('Aviso: Operando con búfer de memoria local');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  }, [dataSource]);

  useEffect(() => {
    fetchRecords(false, dataSource);
  }, [fetchRecords, dataSource]);

  // 2. LOGICA DE FILTROS DINÁMICOS GLOBAL (Mapeo con new Set() sobre las 12,538+ filas completas)
  const uniqueActores = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < records.length; i++) {
      const act = records[i].actor;
      if (act && act.trim().length > 0 && act !== 'Entidad no especificada') {
        set.add(act.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [records]);

  const uniqueMedios = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < records.length; i++) {
      const m = records[i].medio;
      if (m && m.trim().length > 0) {
        set.add(m.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [records]);

  const uniqueReporteros = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < records.length; i++) {
      const rep = records[i].reportero;
      if (rep && rep.trim().length > 0 && rep !== 'Redacción') {
        set.add(rep.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [records]);

  // 3. OPTIMIZACIÓN DE RENDIMIENTO CON useMemo: FILTRADO CRUZADO INSTANTÁNEO
  const filteredRecords = useMemo(() => {
    let result = records;

    // Filtro por texto libre
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(
        (r) =>
          (r.actor && r.actor.toLowerCase().includes(q)) ||
          (r.medio && r.medio.toLowerCase().includes(q)) ||
          (r.resumen && r.resumen.toLowerCase().includes(q)) ||
          (r.titulo && r.titulo.toLowerCase().includes(q)) ||
          (r.reportero && r.reportero.toLowerCase().includes(q))
      );
    }

    // Filtro por Actores seleccionados
    if (filters.actores.length > 0) {
      const actorSet = new Set(filters.actores);
      result = result.filter((r) => actorSet.has(r.actor));
    }

    // Filtro por Medios seleccionados
    if (filters.medios.length > 0) {
      const medioSet = new Set(filters.medios);
      result = result.filter((r) => medioSet.has(r.medio));
    }

    // Filtro por Calificación reputacional
    if (filters.calificaciones.length > 0) {
      const califSet = new Set(filters.calificaciones);
      result = result.filter((r) => califSet.has(r.calificacion));
    }

    // Filtro por Reporteros seleccionados
    if (filters.reporteros.length > 0) {
      const repSet = new Set(filters.reporteros);
      result = result.filter((r) => repSet.has(r.reportero));
    }

    // Filtro por Fecha
    if (filters.dateRange.start) {
      result = result.filter((r) => r.fecha >= filters.dateRange.start);
    }
    if (filters.dateRange.end) {
      result = result.filter((r) => r.fecha <= filters.dateRange.end);
    }

    // Ordenamiento rápido
    const field = filters.sortField;
    const isDesc = filters.sortDirection === 'desc';
    return [...result].sort((a, b) => {
      const valA = a[field] ?? '';
      const valB = b[field] ?? '';
      if (valA < valB) return isDesc ? 1 : -1;
      if (valA > valB) return isDesc ? -1 : 1;
      return 0;
    });
  }, [records, filters]);

  // Reset de página al cambiar cualquier filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // 4. CÁLCULO DE KPIS Y NET SENTIMENT SCORE CON useMemo
  const stats: KPIStats = useMemo(() => {
    const total = filteredRecords.length;
    let pos = 0;
    let neu = 0;
    let neg = 0;
    const actoresSet = new Set<string>();
    const mediosSet = new Set<string>();
    const reporterosSet = new Set<string>();

    for (let i = 0; i < total; i++) {
      const r = filteredRecords[i];
      if (r.calificacion === 'Positiva') pos++;
      else if (r.calificacion === 'Negativa') neg++;
      else neu++;

      if (r.actor) actoresSet.add(r.actor);
      if (r.medio) mediosSet.add(r.medio);
      if (r.reportero) reporterosSet.add(r.reportero);
    }

    const positivePct = total > 0 ? Math.round((pos / total) * 100) : 0;
    const negativePct = total > 0 ? Math.round((neg / total) * 100) : 0;
    const neutralPct = total > 0 ? Math.round((neu / total) * 100) : 0;
    const netSentimentScore = positivePct - negativePct;

    return {
      totalMenciones: total,
      positivas: pos,
      neutrales: neu,
      negativas: neg,
      netSentimentScore,
      actoresUnicos: actoresSet.size,
      mediosUnicos: mediosSet.size,
      reporterosUnicos: reporterosSet.size,
      positivePct,
      negativePct,
      neutralPct,
    };
  }, [filteredRecords]);

  // Paginación de alta eficiencia para evitar saturación del DOM
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRecords.slice(start, start + PAGE_SIZE);
  }, [filteredRecords, currentPage]);

  // Handlers para filtros por botón
  const toggleCalificacion = (calif: Calificacion) => {
    setFilters((prev) => {
      const exists = prev.calificaciones.includes(calif);
      return {
        ...prev,
        calificaciones: exists
          ? prev.calificaciones.filter((c) => c !== calif)
          : [...prev.calificaciones, calif],
      };
    });
  };

  const toggleFilterItem = (type: 'actores' | 'medios' | 'reporteros', item: string) => {
    setFilters((prev) => {
      const list = prev[type];
      const exists = list.includes(item);
      return {
        ...prev,
        [type]: exists ? list.filter((i) => i !== item) : [...list, item],
      };
    });
  };

  const clearAllFilters = () => {
    setFilters({
      search: '',
      actores: [],
      medios: [],
      temas: [],
      calificaciones: [],
      reporteros: [],
      dateRange: { preset: 'all', start: '', end: '' },
      sortField: 'fecha',
      sortDirection: 'desc',
    });
    setActiveDropdown(null);
  };

  const hasActiveFilters =
    filters.search ||
    filters.actores.length > 0 ||
    filters.medios.length > 0 ||
    filters.reporteros.length > 0 ||
    filters.calificaciones.length > 0 ||
    filters.dateRange.start ||
    filters.dateRange.end;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Barra de navegación superior con membrete oficial exclusivo */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src="/membrete.png"
              alt="Logo Institucional"
              className="h-10 sm:h-12 w-auto object-contain brightness-105"
            />
            <div className="hidden md:block pl-4 border-l border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Plataforma de Monitoreo & BI
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-950/80 border border-cyan-600/40 text-cyan-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  PostgreSQL Activo
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {activeEngine} &bull; <strong className="text-cyan-400 font-semibold">{totalInDb.toLocaleString()} notas</strong> indexadas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Selector de fuente de datos: Postgres Fase 2 vs Sheets Fase 1 */}
            <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setDataSource('postgres')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  dataSource === 'postgres'
                    ? 'bg-cyan-500 text-white shadow-xs font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Fase 2: Postgres (122k)
              </button>
              <button
                type="button"
                onClick={() => setDataSource('sheets')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  dataSource === 'sheets'
                    ? 'bg-cyan-500 text-white shadow-xs font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Fase 1: Sheets (DATA)
              </button>
            </div>

            <button
              onClick={() => fetchRecords(true)}
              disabled={isRefreshing}
              id="refresh-button"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-700/80 bg-slate-800/60 hover:bg-slate-800 text-slate-200 hover:text-white transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
              <span className="hidden sm:inline">{isRefreshing ? 'Consultando...' : 'Actualizar'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Banner de estado de sincronización */}
      {syncStatus && (
        <div className="bg-cyan-950/60 border-b border-cyan-800/40 text-cyan-300 text-xs py-2 px-4 text-center animate-fadeIn flex items-center justify-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
          <span>{syncStatus}</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* KPI GRID (Cálculos optimizados de Net Sentiment Score y cobertura) */}
        <section className="grid grid-cols-2 lg:grid-cols-6 gap-3.5">
          {/* Total Cobertura */}
          <div className="col-span-2 sm:col-span-1 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Total Cobertura</span>
              <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {stats.totalMenciones.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              de {records.length.toLocaleString()} notas totales
            </div>
          </div>

          {/* Net Sentiment Score */}
          <div className="col-span-2 sm:col-span-1 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Net Sentiment</span>
              {stats.netSentimentScore >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-400" />
              )}
            </div>
            <div
              className={`text-2xl font-bold tracking-tight ${
                stats.netSentimentScore > 0
                  ? 'text-emerald-400'
                  : stats.netSentimentScore < 0
                  ? 'text-rose-400'
                  : 'text-amber-400'
              }`}
            >
              {stats.netSentimentScore > 0 ? `+${stats.netSentimentScore}%` : `${stats.netSentimentScore}%`}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">% Positivas &minus; % Negativas</div>
          </div>

          {/* Positivas */}
          <div className="rounded-2xl border border-emerald-950/60 bg-emerald-950/20 p-4 border-l-4 border-l-emerald-500">
            <div className="text-emerald-400 text-xs font-medium mb-1">Positivas</div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {stats.positivas.toLocaleString()}
            </div>
            <div className="text-[11px] text-emerald-400/80 mt-1">{stats.positivePct}% del total</div>
          </div>

          {/* Neutrales */}
          <div className="rounded-2xl border border-amber-950/60 bg-amber-950/20 p-4 border-l-4 border-l-amber-500">
            <div className="text-amber-400 text-xs font-medium mb-1">Neutrales</div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {stats.neutrales.toLocaleString()}
            </div>
            <div className="text-[11px] text-amber-400/80 mt-1">{stats.neutralPct}% del total</div>
          </div>

          {/* Negativas */}
          <div className="rounded-2xl border border-rose-950/60 bg-rose-950/20 p-4 border-l-4 border-l-rose-500">
            <div className="text-rose-400 text-xs font-medium mb-1">Negativas</div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {stats.negativas.toLocaleString()}
            </div>
            <div className="text-[11px] text-rose-400/80 mt-1">{stats.negativePct}% del total</div>
          </div>

          {/* Actores / Medios Activos */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
            <div className="text-slate-400 text-xs mb-1">Diversidad</div>
            <div className="text-lg font-bold text-slate-200">
              {stats.actoresUnicos} <span className="text-xs text-slate-500 font-normal">actores</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {stats.mediosUnicos} <span className="text-slate-500">medios</span> &bull; {stats.reporterosUnicos}{' '}
              <span className="text-slate-500">rep.</span>
            </div>
          </div>
        </section>

        {/* BARRA DE FILTROS REORGANIZADA SEGÚN EL ORDEN SOLICITADO */}
        {/* Orden estricto: 1. Actores | 2. Medios | 3. Reporteros | 4. Positivas | 5. Neutrales | 6. Negativas */}
        <section className="rounded-2xl border border-slate-800/80 bg-slate-900/80 backdrop-blur-xl p-4 sm:p-5 space-y-4">
          {/* Fila Superior: Buscador global + Botón Limpiar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                placeholder="Buscar en 12,538 notas por actor, medio, reportero, título o palabras clave..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700/80 bg-slate-950/60 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
              {filters.search && (
                <button
                  onClick={() => setFilters((prev) => ({ ...prev, search: '' }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="px-3.5 py-2 rounded-xl text-xs font-medium border border-rose-800/50 bg-rose-950/30 text-rose-300 hover:bg-rose-900/50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
                <span>Limpiar filtros</span>
              </button>
            )}
          </div>

          {/* Fila de Botones de Filtro en Orden Estricto */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              Filtros:
            </span>

            {/* 1. BOTÓN ACTORES (Dropdown Dinámico mapeado sobre todas las filas) */}
            <div className="relative">
              <button
                onClick={() => {
                  setActiveDropdown(activeDropdown === 'actores' ? null : 'actores');
                  setDropdownSearch('');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                  filters.actores.length > 0
                    ? 'border-cyan-500 bg-cyan-950/60 text-cyan-200'
                    : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>Actores ({filters.actores.length || uniqueActores.length})</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {activeDropdown === 'actores' && (
                <div className="absolute top-full left-0 mt-2 w-72 max-h-80 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl p-2.5 z-50 flex flex-col">
                  <input
                    type="text"
                    value={dropdownSearch}
                    onChange={(e) => setDropdownSearch(e.target.value)}
                    placeholder="Filtrar actor..."
                    className="w-full px-2.5 py-1.5 mb-2 rounded-lg border border-slate-700 bg-slate-950 text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                  <div className="overflow-y-auto flex-1 space-y-1">
                    {uniqueActores
                      .filter((a) => a.toLowerCase().includes(dropdownSearch.toLowerCase()))
                      .map((actor) => {
                        const checked = filters.actores.includes(actor);
                        return (
                          <label
                            key={actor}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800/80 cursor-pointer text-xs text-slate-200"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleFilterItem('actores', actor)}
                              className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                            />
                            <span className="truncate">{actor}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* 2. BOTÓN MEDIOS (Dropdown Dinámico mapeado sobre todas las filas) */}
            <div className="relative">
              <button
                onClick={() => {
                  setActiveDropdown(activeDropdown === 'medios' ? null : 'medios');
                  setDropdownSearch('');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                  filters.medios.length > 0
                    ? 'border-cyan-500 bg-cyan-950/60 text-cyan-200'
                    : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                <span>Medios ({filters.medios.length || uniqueMedios.length})</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {activeDropdown === 'medios' && (
                <div className="absolute top-full left-0 mt-2 w-72 max-h-80 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl p-2.5 z-50 flex flex-col">
                  <input
                    type="text"
                    value={dropdownSearch}
                    onChange={(e) => setDropdownSearch(e.target.value)}
                    placeholder="Filtrar medio..."
                    className="w-full px-2.5 py-1.5 mb-2 rounded-lg border border-slate-700 bg-slate-950 text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                  <div className="overflow-y-auto flex-1 space-y-1">
                    {uniqueMedios
                      .filter((m) => m.toLowerCase().includes(dropdownSearch.toLowerCase()))
                      .map((medio) => {
                        const checked = filters.medios.includes(medio);
                        return (
                          <label
                            key={medio}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800/80 cursor-pointer text-xs text-slate-200"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleFilterItem('medios', medio)}
                              className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                            />
                            <span className="truncate">{medio}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* 3. BOTÓN REPORTEROS (Dropdown Dinámico mapeado sobre todas las filas) */}
            <div className="relative">
              <button
                onClick={() => {
                  setActiveDropdown(activeDropdown === 'reporteros' ? null : 'reporteros');
                  setDropdownSearch('');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                  filters.reporteros.length > 0
                    ? 'border-cyan-500 bg-cyan-950/60 text-cyan-200'
                    : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>Reporteros ({filters.reporteros.length || uniqueReporteros.length})</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {activeDropdown === 'reporteros' && (
                <div className="absolute top-full left-0 mt-2 w-72 max-h-80 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl p-2.5 z-50 flex flex-col">
                  <input
                    type="text"
                    value={dropdownSearch}
                    onChange={(e) => setDropdownSearch(e.target.value)}
                    placeholder="Filtrar reportero..."
                    className="w-full px-2.5 py-1.5 mb-2 rounded-lg border border-slate-700 bg-slate-950 text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                  <div className="overflow-y-auto flex-1 space-y-1">
                    {uniqueReporteros
                      .filter((r) => r.toLowerCase().includes(dropdownSearch.toLowerCase()))
                      .map((reportero) => {
                        const checked = filters.reporteros.includes(reportero);
                        return (
                          <label
                            key={reportero}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800/80 cursor-pointer text-xs text-slate-200"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleFilterItem('reporteros', reportero)}
                              className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                            />
                            <span className="truncate">{reportero}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Separador sutil */}
            <div className="h-5 w-[1px] bg-slate-800 mx-1 hidden sm:block" />

            {/* 4. BOTÓN POSITIVAS */}
            <button
              onClick={() => toggleCalificacion('Positiva')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                filters.calificaciones.includes('Positiva')
                  ? 'border-emerald-500 bg-emerald-950/80 text-emerald-200 shadow-sm shadow-emerald-500/20'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-emerald-400 hover:border-emerald-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Positivas ({stats.positivas.toLocaleString()})</span>
            </button>

            {/* 5. BOTÓN NEUTRALES */}
            <button
              onClick={() => toggleCalificacion('Neutral')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                filters.calificaciones.includes('Neutral')
                  ? 'border-amber-500 bg-amber-950/80 text-amber-200 shadow-sm shadow-amber-500/20'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-amber-400 hover:border-amber-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Neutrales ({stats.neutrales.toLocaleString()})</span>
            </button>

            {/* 6. BOTÓN NEGATIVAS */}
            <button
              onClick={() => toggleCalificacion('Negativa')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                filters.calificaciones.includes('Negativa')
                  ? 'border-rose-500 bg-rose-950/80 text-rose-200 shadow-sm shadow-rose-500/20'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-rose-400 hover:border-rose-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              <span>Negativas ({stats.negativas.toLocaleString()})</span>
            </button>
          </div>
        </section>

        {/* TABLA DE RESULTADOS CON PAGINACIÓN VIRTUAL RÁPIDA */}
        <section className="rounded-2xl border border-slate-800/80 bg-slate-900/80 backdrop-blur-xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                Bitácora de Cobertura Informativa
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Mostrando {Math.min(filteredRecords.length, (currentPage - 1) * PAGE_SIZE + 1)}-
                {Math.min(filteredRecords.length, currentPage * PAGE_SIZE)} de{' '}
                {filteredRecords.length.toLocaleString()} notas filtradas en tiempo real
              </p>
            </div>

            {/* Controles de paginación */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-300 px-2 font-mono">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="p-16 text-center text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-cyan-400" />
              <p className="text-sm font-medium">Cargando 12,538 registros desde Google Sheets...</p>
            </div>
          ) : paginatedRecords.length === 0 ? (
            <div className="p-16 text-center text-slate-400 space-y-2">
              <p className="text-sm">No se encontraron notas con los filtros aplicados.</p>
              <button
                onClick={clearAllFilters}
                className="text-xs text-cyan-400 underline cursor-pointer"
              >
                Restablecer todos los filtros
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Medio &bull; Reportero</th>
                    <th className="py-3 px-4">Calificación</th>
                    <th className="py-3 px-4">Resumen / Titular</th>
                    <th className="py-3 px-4 text-right">Enlace</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {paginatedRecords.map((rec) => {
                    const isPos = rec.calificacion === 'Positiva';
                    const isNeg = rec.calificacion === 'Negativa';

                    return (
                      <tr
                        key={rec.id}
                        onClick={() => setSelectedRecord(rec)}
                        className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                          {rec.fecha || '—'}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-white whitespace-nowrap">
                          {rec.actor}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-medium text-slate-200">{rec.medio}</div>
                          <div className="text-[11px] text-slate-500">{rec.reportero}</div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                              isPos
                                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                                : isNeg
                                ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                                : 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                            }`}
                          >
                            {rec.calificacion}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 max-w-md">
                          <p className="line-clamp-2 text-slate-300 leading-relaxed">
                            {rec.resumen || rec.titulo}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {rec.link && rec.link !== '#' ? (
                            <a
                              href={rec.link}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="p-1.5 inline-flex items-center justify-center rounded-lg border border-slate-700 hover:border-cyan-500 text-slate-400 hover:text-cyan-400 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Modal de Detalle de Nota */}
      {selectedRecord && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
          onClick={() => setSelectedRecord(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold mb-2 ${
                    selectedRecord.calificacion === 'Positiva'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : selectedRecord.calificacion === 'Negativa'
                      ? 'bg-rose-950 text-rose-300 border border-rose-800'
                      : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}
                >
                  {selectedRecord.calificacion}
                </span>
                <h3 className="text-lg font-bold text-white leading-snug">
                  {selectedRecord.titulo || selectedRecord.resumen}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-500 block mb-0.5">Fecha</span>
                <span className="font-semibold text-slate-200">{selectedRecord.fecha}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-500 block mb-0.5">Actor</span>
                <span className="font-semibold text-cyan-300">{selectedRecord.actor}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-500 block mb-0.5">Medio</span>
                <span className="font-semibold text-slate-200">{selectedRecord.medio}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-500 block mb-0.5">Reportero</span>
                <span className="font-semibold text-slate-200">{selectedRecord.reportero}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Resumen de la Nota
              </h4>
              <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                {selectedRecord.resumen}
              </p>
            </div>

            {selectedRecord.contexto && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Contexto
                </h4>
                <p className="text-xs text-slate-400">{selectedRecord.contexto}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
              <span className="text-slate-500 font-mono">ID: {selectedRecord.id}</span>
              {selectedRecord.link && selectedRecord.link !== '#' && (
                <a
                  href={selectedRecord.link}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>Abrir Fuente Original</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
