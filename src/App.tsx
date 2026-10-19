/**
 * Media Monitoring & Corporate Reputation BI Platform
 * Specialized 3-Way Reading Architecture: Actores, Medios, Temas
 * Strictly Read-Only PostgreSQL Integration (122,264+ records)
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './components/LoginPage';
import { Navbar, MainNavView } from './components/Navbar';
import { ComparativoLinkBuilder } from './components/ComparativoLinkBuilder';
import { Sidebar } from './components/Sidebar';
import { FilterBar } from './components/FilterBar';
import { StatusToast } from './components/StatusToast';
import { MonitorHero } from './components/MonitorHero';
import { KPIGrid } from './components/KPIGrid';
import { ChartsSection } from './components/ChartsSection';
import { DataTable } from './components/DataTable';
import { RecordModal } from './components/RecordModal';
import { GlobalReportModal } from './components/GlobalReportModal';
import { PerspectiveViews, PerspectiveMode } from './components/PerspectiveViews';
import { FacebookToggle } from './components/FacebookToggle';
import { repository } from './services/repository';
import { DataSourceConfig, FilterState, KPIStats, MediaRecord, FilterOptionItem, Calificacion } from './types';
import {
  getTemaMetadata,
  matchesCategory,
  CATEGORIAS_OFICIALES,
  isCategoriaOficial,
  matchCategoriaOficial
} from './data/temasCatalogo';
import { getPresetDateRange } from './utils/dateUtils';
import {
  Sparkles,
  RefreshCw,
  Users,
  Newspaper,
  Tag,
  ArrowRight,
  ShieldCheck,
  LayoutDashboard,
  FileDown
} from 'lucide-react';

// Helper for default 90-day standard range
const getInitial90DaysRange = () => {
  const { start, end } = getPresetDateRange('90d');
  return {
    preset: '90d' as const,
    start,
    end
  };
};

const DashboardContent: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Navigation View State: 'monitor' | 'actores' | 'medios' | 'temas'
  const [activeView, setActiveView] = useState<MainNavView>('monitor');

  const [records, setRecords] = useState<MediaRecord[]>([]);
  const [config, setConfig] = useState<DataSourceConfig>(repository.getConfig());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  // Fuente global: por defecto sin Facebook (tabla monitoreo); activado usa monitoreo_total
  const [incluirFacebook, setIncluirFacebook] = useState<boolean>(false);
  const [isBooting, setIsBooting] = useState<boolean>(true);
  const [syncNotice, setSyncNotice] = useState<{ message: string; type: 'success' | 'warning' | 'error'; actionLabel?: string } | null>(null);

  // Server-side filter options
  const [serverOptions, setServerOptions] = useState<{
    actores: FilterOptionItem[];
    medios: FilterOptionItem[];
    temas: FilterOptionItem[];
    reporteros: FilterOptionItem[];
    estados: FilterOptionItem[];
    municipios: FilterOptionItem[];
    categorias: FilterOptionItem[];
  }>({
    actores: [],
    medios: [],
    temas: [],
    reporteros: [],
    estados: [],
    municipios: [],
    categorias: []
  });

  // Total counts & live PostgreSQL query state
  const [totalDatabaseCount, setTotalDatabaseCount] = useState<number>(122264);
  const [totalMatchedCount, setTotalMatchedCount] = useState<number>(122264);
  const [serverKpiStats, setServerKpiStats] = useState<KPIStats | null>(null);
  const [isQuerying, setIsQuerying] = useState<boolean>(false);

  // Modal State
  const [selectedRecord, setSelectedRecord] = useState<MediaRecord | null>(null);
  const [isGlobalReportOpen, setIsGlobalReportOpen] = useState<boolean>(false);

  // Left Sidebar State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Cross-Filter State (defaults to 90 days standard)
  const [filters, setFilters] = useState<FilterState>(() => ({
    search: '',
    actores: [],
    medios: [],
    temas: [],
    calificaciones: [],
    reporteros: [],
    estados: [],
    municipios: [],
    categorias: [],
    dateRange: getInitial90DaysRange(),
    sortField: 'fecha',
    sortDirection: 'desc'
  }));

  // Unified filter change handler with category-aware tema pruning
  const handleFilterChange = useCallback((updater: FilterState | ((prev: FilterState) => FilterState)) => {
    setFilters((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // If categories are selected, ensure any selected temas belong to the chosen category (primary or secondary)
      if (next.categorias && next.categorias.length > 0 && next.temas && next.temas.length > 0) {
        const validTemas = next.temas.filter((t) => {
          const meta = getTemaMetadata(t);
          if (!meta) return true;
          return matchesCategory(meta, next.categorias!).matches;
        });
        if (validTemas.length !== next.temas.length) {
          return {
            ...next,
            temas: validTemas
          };
        }
      }
      return next;
    });
  }, []);

  // Load records from repository
  const loadRecords = useCallback(async (refreshFromSource = false) => {
    try {
      if (refreshFromSource) {
        setIsSyncing(true);
        await repository.syncFromSource(true);
      }
      const data = await repository.getRecords();
      setRecords(data);
      setConfig(repository.getConfig());
    } catch (err) {
      console.error('Error loading records', err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Fetch server-level filter options (with counts across all 122k records, reactive to period, category, geo, and sentiment)
  const loadFilterOptions = useCallback(
    async (
      force = false,
      context?: {
        startDate?: string;
        endDate?: string;
        categorias?: string[];
        estados?: string[];
        municipios?: string[];
        calificaciones?: Calificacion[];
        actores?: string[];
        medios?: string[];
        temas?: string[];
        reporteros?: string[];
        search?: string;
      }
    ) => {
      try {
        const [opts, diag] = await Promise.all([
          repository.fetchPostgresFilters(force, context),
          repository.getPostgresDiagnostics()
        ]);
        if (opts) {
          // Exclude or sort 'Sin actor'
          const cleanActores = (opts.actores || []).filter(
            (a: FilterOptionItem) => a.name && a.name.toLowerCase() !== 'sin actor'
          );
          setServerOptions((prev) => ({
            actores: cleanActores,
            medios: opts.medios || [],
            temas: opts.temas || [],
            reporteros: opts.reporteros || [],
            estados: opts.estados || [],
            municipios: opts.municipios || [],
            categorias: opts.categorias || []
          }));
        }
        if (diag && diag.totalRecords) {
          setTotalDatabaseCount(diag.totalRecords);
        }
      } catch (err) {
        console.error('Error loading filter options:', err);
      }
    },
    []
  );

  // Cascading filters: Whenever Period, Category, Geo, Sentiment, or Medio changes, refresh Actores, Medios, Temas, etc.
  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = setTimeout(() => {
      loadFilterOptions(false, {
        startDate: filters.dateRange.start,
        endDate: filters.dateRange.end,
        categorias: filters.categorias,
        estados: filters.estados,
        municipios: filters.municipios,
        calificaciones: filters.calificaciones,
        medios: filters.medios,
        actores: filters.actores,
        temas: filters.temas,
        reporteros: filters.reporteros,
        search: filters.search
      });
    }, 150);

    return () => clearTimeout(timer);
  }, [
    isAuthenticated,
    filters.dateRange.start,
    filters.dateRange.end,
    filters.categorias,
    filters.estados,
    filters.municipios,
    filters.calificaciones,
    filters.medios,
    filters.actores,
    filters.temas,
    filters.reporteros,
    filters.search,
    incluirFacebook,
    loadFilterOptions
  ]);

  // Live Query from PostgreSQL whenever filters change
  useEffect(() => {
    if (!isAuthenticated) return;
    let isCancelled = false;

    const timer = setTimeout(async () => {
      setIsQuerying(true);
      try {
        // Umbral de consulta: 3,000 registros para permitir cargar y paginar la totalidad de menciones de actores con alto volumen
        const queryLimit = 3000;
        const [queryRes, kpiRes] = await Promise.all([
          repository.queryRecords(filters, queryLimit, 0),
          repository.getKPIStats(filters)
        ]);

        if (!isCancelled) {
          if (queryRes) {
            setRecords(queryRes.records);
            setTotalMatchedCount(queryRes.total);
          }
          if (kpiRes) {
            setServerKpiStats(kpiRes);
          }
        }
      } catch (err) {
        console.error('Error querying filtered data:', err);
      } finally {
        if (!isCancelled) {
          setIsQuerying(false);
        }
      }
    }, filters.search ? 300 : 0);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [filters, isAuthenticated, incluirFacebook]);

  useEffect(() => {
    if (isAuthenticated) {
      setIsBooting(true);
      repository.syncFromSource(false).then((res) => {
        loadRecords(false);
        const isPg = res.source.toLowerCase().includes('postgres');
        if (isPg) {
          setSyncNotice({
            message: `${res.count.toLocaleString('es-MX')} notas disponibles`,
            type: 'success'
          });
        } else {
          setSyncNotice({
            message: `Conectado a ${res.source} correctamente.`,
            type: 'warning',
            actionLabel: 'Ver Diagnóstico PG'
          });
        }
        setTimeout(() => setSyncNotice(null), 5000);
      }).catch((err) => {
        console.error('Initial sync failed', err);
      }).finally(() => setIsBooting(false));
      loadFilterOptions(false);
    }
  }, [isAuthenticated, loadRecords, loadFilterOptions]);

  // Sync action
  const handleToggleFacebook = () => {
    const next = !incluirFacebook;
    repository.setIncluirFacebook(next);
    setIncluirFacebook(next);
  };

  const handleSync = async (force = true) => {
    setIsSyncing(true);
    setSyncNotice(null);
    try {
      const res = await repository.syncFromSource(force);
      await loadRecords(false);
      await loadFilterOptions(true);
      setSyncNotice({
        message: `${res.count.toLocaleString('es-MX')} notas disponibles`,
        type: 'success'
      });
      setTimeout(() => setSyncNotice(null), 5000);
    } catch (err: any) {
      console.error('Sync failed', err);
      setSyncNotice({
        message: `Error al sincronizar: ${err?.message || 'Error de red'}`,
        type: 'error',
        actionLabel: 'Ver Diagnóstico'
      });
      setTimeout(() => setSyncNotice(null), 7000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Scoped records matching active filters (period, actor, category, medio, geo, sentiment) for client-side fallback
  const contextScopedRecords = useMemo(() => {
    let list = records;
    if (filters.actores && filters.actores.length > 0) {
      list = list.filter((r) => filters.actores!.includes(r.actor));
    }
    if (filters.dateRange.start) {
      list = list.filter((r) => r.fecha >= filters.dateRange.start);
    }
    if (filters.dateRange.end) {
      list = list.filter((r) => r.fecha <= filters.dateRange.end);
    }
    if (filters.medios && filters.medios.length > 0) {
      list = list.filter((r) => filters.medios!.includes(r.medio));
    }
    if (filters.categorias && filters.categorias.length > 0) {
      const cats = filters.categorias.map((c) => c.toLowerCase());
      list = list.filter((r) => {
        const val = (r.categoria || r.tema || r.tipo || '').toLowerCase();
        return cats.some((c) => val.includes(c));
      });
    }
    if (filters.calificaciones.length > 0) {
      list = list.filter((r) => filters.calificaciones.includes(r.calificacion));
    }
    const selEstados = filters.estados || [];
    const selMunicipios = filters.municipios || [];
    if (selEstados.length > 0) {
      list = list.filter((r) => selEstados.includes(r.estado || r.region || ''));
    }
    if (selMunicipios.length > 0) {
      list = list.filter((r) => selMunicipios.includes(r.municipio || ''));
    }
    return list;
  }, [
    records,
    filters.actores,
    filters.dateRange.start,
    filters.dateRange.end,
    filters.medios,
    filters.categorias,
    filters.calificaciones,
    filters.estados,
    filters.municipios
  ]);

  const hasActorFilter = Boolean(filters.actores && filters.actores.length > 0);
  const hasDateFilter = Boolean(filters.dateRange.preset !== 'all' || filters.dateRange.start || filters.dateRange.end);
  const hasActorOrRangeScope = hasActorFilter || hasDateFilter;

  // Records strictly scoped to active Actor and Date Range for immediate, reactive facet derivation
  const actorScopedRecords = useMemo(() => {
    let list = records;
    if (hasActorFilter) {
      list = list.filter((r) => filters.actores!.includes(r.actor));
    }
    if (filters.dateRange.start) {
      list = list.filter((r) => r.fecha >= filters.dateRange.start);
    }
    if (filters.dateRange.end) {
      list = list.filter((r) => r.fecha <= filters.dateRange.end);
    }
    return list;
  }, [records, hasActorFilter, filters.actores, filters.dateRange.start, filters.dateRange.end]);

  const actorMediosSet = useMemo(() => {
    if (!hasActorFilter) return null;
    return new Set(actorScopedRecords.map((r) => r.medio).filter(Boolean));
  }, [hasActorFilter, actorScopedRecords]);

  const actorTemasSet = useMemo(() => {
    if (!hasActorFilter) return null;
    const s = new Set<string>();
    actorScopedRecords.forEach((r) => {
      if (r.tema) s.add(r.tema.trim().toUpperCase());
      if (r.categoria) s.add(r.categoria.trim().toUpperCase());
    });
    return s;
  }, [hasActorFilter, actorScopedRecords]);

  const actorReporterosSet = useMemo(() => {
    if (!hasActorFilter) return null;
    return new Set(actorScopedRecords.map((r) => r.reportero).filter((rep) => rep && rep !== 'Redacción'));
  }, [hasActorFilter, actorScopedRecords]);

  const actorEstadosSet = useMemo(() => {
    if (!hasActorFilter) return null;
    return new Set(actorScopedRecords.map((r) => r.estado || r.region).filter(Boolean) as string[]);
  }, [hasActorFilter, actorScopedRecords]);

  const actorMunicipiosSet = useMemo(() => {
    if (!hasActorFilter) return null;
    return new Set(actorScopedRecords.map((r) => r.municipio).filter(Boolean) as string[]);
  }, [hasActorFilter, actorScopedRecords]);

  const actorCategoriasSet = useMemo(() => {
    if (!hasActorFilter) return null;
    const s = new Set<string>();
    actorScopedRecords.forEach((r) => {
      const cat = r.categoria && matchCategoriaOficial(r.categoria);
      if (cat) s.add(cat);
      const meta = getTemaMetadata(r.tema || '');
      if (meta?.categoria) s.add(meta.categoria);
      if (meta?.categoria_secundaria) s.add(meta.categoria_secundaria);
    });
    return s;
  }, [hasActorFilter, actorScopedRecords]);

  // Derive available options (prefers serverOptions filtered by PostgreSQL, strictly scoped by actor and range)
  const availableActores = useMemo(() => {
    if (serverOptions.actores.length > 0) return serverOptions.actores;
    const map = new Map<string, number>();
    contextScopedRecords.forEach((r) => {
      if (r.actor && r.actor !== 'Sin actor') {
        map.set(r.actor, (map.get(r.actor) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [serverOptions.actores, contextScopedRecords]);

  const availableMedios = useMemo(() => {
    if (serverOptions.medios.length > 0) {
      const scoped = hasActorOrRangeScope
        ? serverOptions.medios.filter((m) => (m.count || 0) > 0)
        : serverOptions.medios;
      if (scoped.length > 0 || !hasActorFilter) {
        return scoped;
      }
    }
    const map = new Map<string, number>();
    (hasActorFilter ? actorScopedRecords : contextScopedRecords).forEach((r) => {
      if (r.medio) map.set(r.medio, (map.get(r.medio) || 0) + 1);
    });
    return Array.from(map.entries())
      .filter(([_, count]) => !hasActorOrRangeScope || count > 0)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [serverOptions.medios, contextScopedRecords, actorScopedRecords, hasActorOrRangeScope, hasActorFilter, actorMediosSet]);

  const availableTemas = useMemo(() => {
    if (serverOptions.temas.length > 0) {
      const scoped = hasActorOrRangeScope
        ? serverOptions.temas.filter((t) => (t.count || 0) > 0)
        : serverOptions.temas;
      if (scoped.length > 0 || !hasActorFilter) {
        return scoped;
      }
    }
    const map = new Map<string, number>();
    (hasActorFilter ? actorScopedRecords : contextScopedRecords).forEach((r) => {
      const val = r.tema || r.categoria;
      if (val) map.set(val, (map.get(val) || 0) + 1);
    });
    return Array.from(map.entries())
      .filter(([_, count]) => !hasActorOrRangeScope || count > 0)
      .map(([name, count]) => {
        const meta = getTemaMetadata(name);
        return {
          name,
          count,
          categoria: meta?.categoria,
          categoriaSecundaria: meta?.categoria_secundaria
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [serverOptions.temas, contextScopedRecords, actorScopedRecords, hasActorOrRangeScope, hasActorFilter, actorTemasSet]);

  const availableReporteros = useMemo(() => {
    if (serverOptions.reporteros.length > 0) {
      const scoped = hasActorOrRangeScope
        ? serverOptions.reporteros.filter((r) => (r.count || 0) > 0)
        : serverOptions.reporteros;
      if (scoped.length > 0 || !hasActorFilter) {
        return scoped;
      }
    }
    const map = new Map<string, number>();
    (hasActorFilter ? actorScopedRecords : contextScopedRecords).forEach((r) => {
      if (r.reportero && r.reportero !== 'Redacción') {
        map.set(r.reportero, (map.get(r.reportero) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .filter(([_, count]) => !hasActorOrRangeScope || count > 0)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [serverOptions.reporteros, contextScopedRecords, actorScopedRecords, hasActorOrRangeScope, hasActorFilter, actorReporterosSet]);

  const availableEstados = useMemo(() => {
    if (serverOptions.estados.length > 0) {
      const scoped = hasActorOrRangeScope
        ? serverOptions.estados.filter((e) => (e.count || 0) > 0)
        : serverOptions.estados;
      if (scoped.length > 0 || !hasActorFilter) {
        return scoped;
      }
    }
    const map = new Map<string, number>();
    (hasActorFilter ? actorScopedRecords : contextScopedRecords).forEach((r) => {
      const val = r.estado || r.region;
      if (val) map.set(val, (map.get(val) || 0) + 1);
    });
    return Array.from(map.entries())
      .filter(([_, count]) => !hasActorOrRangeScope || count > 0)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [serverOptions.estados, contextScopedRecords, actorScopedRecords, hasActorOrRangeScope, hasActorFilter, actorEstadosSet]);

  const availableMunicipios = useMemo(() => {
    if (serverOptions.municipios.length > 0) {
      const scoped = hasActorOrRangeScope
        ? serverOptions.municipios.filter((m) => (m.count || 0) > 0)
        : serverOptions.municipios;
      if (scoped.length > 0 || !hasActorFilter) {
        return scoped;
      }
    }
    const map = new Map<string, number>();
    const selEstados = filters.estados || [];
    const sourceRecords = hasActorFilter ? actorScopedRecords : contextScopedRecords;
    const stateScoped = selEstados.length > 0
      ? sourceRecords.filter((r) => selEstados.includes(r.estado || r.region || ''))
      : sourceRecords;
    stateScoped.forEach((r) => {
      if (r.municipio) map.set(r.municipio, (map.get(r.municipio) || 0) + 1);
    });
    return Array.from(map.entries())
      .filter(([_, count]) => !hasActorOrRangeScope || count > 0)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [serverOptions.municipios, contextScopedRecords, actorScopedRecords, filters.estados, hasActorOrRangeScope, hasActorFilter, actorMunicipiosSet]);

  const availableCategorias = useMemo(() => {
    if (serverOptions.categorias.length > 0) {
      const scoped = serverOptions.categorias
        .filter((c) => isCategoriaOficial(c.name))
        .filter((c) => !hasActorOrRangeScope || ((c.count || 0) > 0));
      if (scoped.length > 0 || !hasActorFilter) {
        return scoped;
      }
    }
    const map = new Map<string, number>();
    (hasActorFilter ? actorScopedRecords : contextScopedRecords).forEach((r) => {
      const cat = r.categoria && matchCategoriaOficial(r.categoria);
      if (cat) map.set(cat, (map.get(cat) || 0) + 1);
    });
    if (!hasActorOrRangeScope) {
      CATEGORIAS_OFICIALES.forEach((catName) => {
        if (!map.has(catName)) {
          map.set(catName, 0);
        }
      });
    }
    return Array.from(map.entries())
      .filter(([_, count]) => !hasActorOrRangeScope || count > 0)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [serverOptions.categorias, contextScopedRecords, actorScopedRecords, hasActorOrRangeScope, hasActorFilter, actorCategoriasSet]);

  // Sorted records
  const sortedRecords = useMemo(() => {
    const result = [...records];
    const field = filters.sortField;
    const dir = filters.sortDirection === 'desc' ? -1 : 1;
    result.sort((a, b) => {
      const valA = a[field] ?? '';
      const valB = b[field] ?? '';
      if (valA < valB) return -1 * dir;
      if (valA > valB) return 1 * dir;
      return 0;
    });
    return result;
  }, [records, filters.sortField, filters.sortDirection]);

  // Compute KPI Statistics (prefers serverKpiStats if available from PostgreSQL)
  const activeStats: KPIStats = useMemo(() => {
    if (serverKpiStats) return serverKpiStats;
    const total = sortedRecords.length;
    let pos = 0;
    let neu = 0;
    let neg = 0;
    const actoresSet = new Set<string>();
    const mediosSet = new Set<string>();
    const reporterosSet = new Set<string>();

    sortedRecords.forEach((r) => {
      if (r.calificacion === 'Positiva') pos++;
      else if (r.calificacion === 'Negativa') neg++;
      else neu++;

      if (r.actor) actoresSet.add(r.actor);
      if (r.medio) mediosSet.add(r.medio);
      if (r.reportero) reporterosSet.add(r.reportero);
    });

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
      neutralPct
    };
  }, [serverKpiStats, sortedRecords]);

  const handleSort = (field: keyof MediaRecord) => {
    setFilters((prev) => ({
      ...prev,
      sortField: field,
      sortDirection: prev.sortField === field && prev.sortDirection === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Handler when user selects an entity from PerspectiveViews to filter in Global Monitor
  const handleSelectEntityFilter = (
    type: 'actor' | 'medio' | 'tema',
    name: string,
    dateRange?: { preset: any; start: string; end: string }
  ) => {
    setActiveView('monitor');
    setFilters((prev) => ({
      ...prev,
      dateRange: dateRange || prev.dateRange,
      ...(type === 'actor'
        ? { actores: [name], medios: [], temas: [], reporteros: [], calificaciones: [], search: '' }
        : {}),
      ...(type === 'medio'
        ? { medios: [name], actores: [], temas: [], reporteros: [], calificaciones: [], search: '' }
        : {}),
      ...(type === 'tema'
        ? { temas: [name], actores: [], medios: [], reporteros: [], calificaciones: [], search: '' }
        : {})
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Auth Protection Middleware
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors duration-200">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
          <p className="text-xs uppercase font-mono tracking-widest text-cyan-600 dark:text-cyan-400">
            Verificando Sesión...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-[#e9edf2] dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 flex flex-col">
      {/* Barra superior: logotipo Arg.Os y tema */}
      <Navbar
        activeView={activeView}
        onSelectView={setActiveView}
        onToggleSidebar={() => {
          if (typeof window !== 'undefined' && window.innerWidth < 768) {
            setIsMobileSidebarOpen((prev) => !prev);
          } else {
            setIsSidebarCollapsed((prev) => !prev);
          }
        }}
      />

      {/* Main Layout: Left Sidebar + Content Area */}
      <div className="flex-1 flex w-full">
        <Sidebar
          activeView={activeView}
          onSelectView={setActiveView}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
          totalRecordsCount={totalDatabaseCount}
          onSync={() => handleSync(true)}
          isSyncing={isSyncing}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          filters={filters}
        />

        {/* Main Content Area */}
        <main key={incluirFacebook ? 'con-facebook' : 'sin-facebook'} className="flex-1 min-w-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Aviso de carga: primero spinner, luego confirmación */}
        {(isBooting || isSyncing) && !syncNotice ? (
          <StatusToast kind="loading" title={isSyncing && !isBooting ? 'Actualizando datos…' : 'Cargando datos…'} />
        ) : syncNotice ? (
          <StatusToast
            kind={syncNotice.type}
            title={syncNotice.type === 'success' ? 'Datos cargados' : syncNotice.message}
            detail={syncNotice.type === 'success' ? syncNotice.message : undefined}
            onClose={() => setSyncNotice(null)}
          />
        ) : null}

        {/* View Router */}
        {activeView === 'monitor' ? (
          <>
            <MonitorHero totalCount={totalDatabaseCount} />

            {/* Rango de fechas y filtros */}
            <section
              aria-label="Filtros"
              className="relative z-30 rounded-3xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-3 sm:p-4 shadow-sm space-y-3"
            >
            <FilterBar
              embedded
              filters={filters}
              onFilterChange={handleFilterChange}
              availableActores={availableActores}
              availableMedios={availableMedios}
              availableTemas={availableTemas}
              availableReporteros={availableReporteros}
              availableEstados={availableEstados}
              availableMunicipios={availableMunicipios}
              availableCategorias={availableCategorias}
              totalRecords={totalDatabaseCount}
              filteredCount={totalMatchedCount}
            />
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200/70 dark:border-slate-800/70 pt-3">
              <FacebookToggle active={incluirFacebook} onToggle={handleToggleFacebook} />
              {/* El reporte se arma por actor: sin al menos uno elegido queda desactivado */}
              <span className="group relative inline-flex">
                <button
                  type="button"
                  onClick={() => setIsGlobalReportOpen(true)}
                  id="btn-generate-global-pdf"
                  disabled={filters.actores.length === 0}
                  aria-describedby={filters.actores.length === 0 ? 'tip-global-pdf' : undefined}
                  title={filters.actores.length > 0 ? 'Generar informe ejecutivo en PDF del monitor global' : undefined}
                  className="flex items-center gap-2 rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 transition-[background-color,transform,opacity] duration-100 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-[0.97] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-slate-800 disabled:active:scale-100"
                >
                  <FileDown className="h-4 w-4 text-argos-blue" />
                  <span>Generar Reporte PDF</span>
                </button>
                {filters.actores.length === 0 && (
                  <span
                    id="tip-global-pdf"
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full right-0 mb-2 w-56 rounded-xl border border-white/10 bg-slate-900/90 px-3 py-2 text-xs leading-snug text-white opacity-0 shadow-lg backdrop-blur-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                  >
                    Elige al menos un actor en los filtros para generar el reporte.
                  </span>
                )}
              </span>
            </div>
            </section>

            {/* 2. Micro-Interaction KPI Cards */}
            <KPIGrid stats={activeStats} />

            {/* 3. Advanced Charts Section */}
            <ChartsSection
              records={sortedRecords}
              selectedActores={filters.actores}
              allAvailableActores={availableActores}
              onUpdateSelectedActores={(newActores) => handleFilterChange((prev) => ({ ...prev, actores: newActores }))}
              dateRange={filters.dateRange}
              filters={filters}
            />

            {/* 4. Dynamic Virtualized/Paginated DataTable */}
            <DataTable
              records={sortedRecords}
              totalMatchedCount={totalMatchedCount}
              onSelectRecord={(rec) => setSelectedRecord(rec)}
              sortField={filters.sortField}
              sortDirection={filters.sortDirection}
              onSort={handleSort}
              onOpenReportModal={filters.actores.length > 0 ? () => setIsGlobalReportOpen(true) : undefined}
            />
          </>
        ) : activeView === 'enlace' ? (
          <ComparativoLinkBuilder availableActores={availableActores} />
        ) : (
          /* Specialized Perspective Reading View */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setActiveView('monitor')}
                className="flex items-center gap-2 text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
              >
                &larr; Volver al Monitor Global
              </button>
            </div>

            <PerspectiveViews
              initialMode={activeView as PerspectiveMode}
              initialDateRange={filters.dateRange}
              onSelectEntityFilter={handleSelectEntityFilter}
              onOpenRecord={(rec) => setSelectedRecord(rec)}
              filters={filters}
              onFilterChange={handleFilterChange}
              availableEstados={availableEstados}
              availableMunicipios={availableMunicipios}
              availableCategorias={availableCategorias}
              incluirFacebook={incluirFacebook}
              onToggleFacebook={handleToggleFacebook}
            />
          </div>
        )}
      </main>
      </div>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200/80 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/50 py-6 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/membrete.png"
              alt="Brand Logo"
              className="h-6 w-auto object-contain dark:brightness-110 opacity-90"
              referrerPolicy="no-referrer"
            />
            <span>
              Media Monitoring & Reputation BI &copy; {new Date().getFullYear()} &mdash; Base de datos PostgreSQL conectada
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <button
              onClick={() => handleSync(true)}
              className="hover:text-teal-ink dark:hover:text-teal-glow transition-colors cursor-pointer"
            >
              Refrescar datos
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <RecordModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />

      <GlobalReportModal
        isOpen={isGlobalReportOpen}
        onClose={() => setIsGlobalReportOpen(false)}
        records={sortedRecords}
        stats={activeStats}
        filters={filters}
        totalDatabaseCount={totalDatabaseCount}
        filteredCount={totalMatchedCount}
      />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DashboardContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
