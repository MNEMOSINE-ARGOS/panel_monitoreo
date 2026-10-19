import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calificacion, FilterState, FilterOptionItem } from '../types';
import { getTemaMetadata, matchesCategory, getTemasForCategorias, isCategoriaOficial } from '../data/temasCatalogo';
import { getPresetDateRange, getOperationalTodayDate } from '../utils/dateUtils';
import { UserRound,
  Search,
  X,
  RotateCcw,
  Calendar,
  Building2,
  Newspaper,
  UserCheck,
  Tag,
  Smile,
  Meh,
  Frown,
  ChevronDown,
  Check,
  MapPin,
  Compass,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  availableActores: Array<string | FilterOptionItem>;
  availableMedios: Array<string | FilterOptionItem>;
  availableTemas: Array<string | FilterOptionItem>;
  availableReporteros: Array<string | FilterOptionItem>;
  availableEstados?: Array<string | FilterOptionItem>;
  availableMunicipios?: Array<string | FilterOptionItem>;
  availableCategorias?: Array<string | FilterOptionItem>;
  totalRecords: number;
  filteredCount: number;
  /** Sin tarjeta propia: se integra dentro de otro contenedor */
  embedded?: boolean;
}

function FilterLevel({ icon: Icon, title, hint, children, accent = false }: {
  icon: React.ElementType; title: string; hint: string; children: React.ReactNode; accent?: boolean;
}) {
  return (
    <div className="grid gap-x-4 gap-y-1.5 px-3 py-2 md:grid-cols-[7.5rem_1fr] items-center">
      <div className="flex items-center gap-2" title={hint}>
        {accent ? (
          <Icon className="h-4 w-4 shrink-0 text-teal-ink dark:text-teal-glow" strokeWidth={2.2} aria-hidden="true" />
        ) : (
          <Icon className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" strokeWidth={1.9} aria-hidden="true" />
        )}
        <div>
          <p className="text-[13px] font-semibold leading-tight text-slate-900 dark:text-white">{title}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  availableActores,
  availableMedios,
  availableTemas,
  availableReporteros,
  availableEstados = [],
  availableMunicipios = [],
  availableCategorias = [],
  totalRecords,
  filteredCount,
  embedded = false
}) => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [actorSearch, setActorSearch] = useState('');
  const [medioSearch, setMedioSearch] = useState('');
  const [temaSearch, setTemaSearch] = useState('');
  const [temaTabFilter, setTemaTabFilter] = useState<'all' | 'primary' | 'secondary'>('all');
  const [reporteroSearch, setReporteroSearch] = useState('');
  const [estadoSearch, setEstadoSearch] = useState('');
  const [municipioSearch, setMunicipioSearch] = useState('');
  const [categoriaSearch, setCategoriaSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click or Escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest?.('[data-filter-dropdown] > *')) {
        setOpenDropdown(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const toggleDropdown = (name: string) => {
    setOpenDropdown((prev) => (prev === name ? null : name));
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({
      ...filters,
      search: e.target.value
    });
  };

  const toggleCalificacion = (calif: Calificacion) => {
    const exists = filters.calificaciones.includes(calif);
    const updated = exists
      ? filters.calificaciones.filter((c) => c !== calif)
      : [...filters.calificaciones, calif];
    onFilterChange({
      ...filters,
      calificaciones: updated
    });
  };

  const toggleActor = (actor: string) => {
    const exists = filters.actores.includes(actor);
    const updated = exists
      ? filters.actores.filter((a) => a !== actor)
      : [...filters.actores, actor];
    onFilterChange({
      ...filters,
      actores: updated
    });
  };

  const toggleMedio = (medio: string) => {
    const exists = filters.medios.includes(medio);
    const updated = exists
      ? filters.medios.filter((m) => m !== medio)
      : [...filters.medios, medio];
    onFilterChange({
      ...filters,
      medios: updated
    });
  };

  const toggleTema = (tema: string) => {
    const exists = (filters.temas || []).includes(tema);
    const updated = exists
      ? (filters.temas || []).filter((t) => t !== tema)
      : [...(filters.temas || []), tema];
    onFilterChange({
      ...filters,
      temas: updated
    });
  };

  const toggleReportero = (reportero: string) => {
    const exists = filters.reporteros.includes(reportero);
    const updated = exists
      ? filters.reporteros.filter((r) => r !== reportero)
      : [...filters.reporteros, reportero];
    onFilterChange({
      ...filters,
      reporteros: updated
    });
  };

  const toggleEstado = (estado: string) => {
    const list = filters.estados || [];
    const exists = list.includes(estado);
    const updated = exists ? list.filter((e) => e !== estado) : [...list, estado];
    onFilterChange({
      ...filters,
      estados: updated
    });
  };

  const toggleMunicipio = (municipio: string) => {
    const list = filters.municipios || [];
    const exists = list.includes(municipio);
    const updated = exists ? list.filter((m) => m !== municipio) : [...list, municipio];
    onFilterChange({
      ...filters,
      municipios: updated
    });
  };

  const toggleCategoria = (categoria: string) => {
    const list = filters.categorias || [];
    const exists = list.includes(categoria);
    const updated = exists ? list.filter((c) => c !== categoria) : [...list, categoria];
    onFilterChange({
      ...filters,
      categorias: updated
    });
  };

  const handleDatePreset = (preset: FilterState['dateRange']['preset']) => {
    const { start, end } = getPresetDateRange(preset);

    onFilterChange({
      ...filters,
      dateRange: {
        preset,
        start,
        end
      }
    });
  };

  // Rango personalizado "Desde / Hasta": si el usuario invierte las fechas, se ajusta la otra para mantener start <= end
  const handleCustomDate = (field: 'start' | 'end', value: string) => {
    let { start, end } = filters.dateRange;
    if (filters.dateRange.preset === 'all') {
      start = '';
      end = '';
    }
    if (field === 'start') {
      start = value;
      if (value && end && value > end) end = value;
    } else {
      end = value;
      if (value && start && value < start) start = value;
    }

    onFilterChange({
      ...filters,
      dateRange: { preset: 'custom', start, end }
    });
  };

  const handleResetFilters = () => {
    const { start, end } = getPresetDateRange('90d');

    onFilterChange({
      search: '',
      actores: [],
      medios: [],
      temas: [],
      calificaciones: [],
      reporteros: [],
      estados: [],
      municipios: [],
      categorias: [],
      dateRange: {
        preset: '90d',
        start,
        end
      },
      sortField: 'fecha',
      sortDirection: 'desc'
    });
    setOpenDropdown(null);
    setActorSearch('');
    setMedioSearch('');
    setTemaSearch('');
    setTemaTabFilter('all');
    setReporteroSearch('');
    setEstadoSearch('');
    setMunicipioSearch('');
    setCategoriaSearch('');
  };

  // Helper normalizers for lists
  const normalizeList = (items: Array<string | FilterOptionItem>): FilterOptionItem[] => {
    return items.map((item) => {
      if (typeof item === 'string') {
        const meta = getTemaMetadata(item);
        return {
          name: item,
          count: 0,
          categoria: meta?.categoria,
          categoriaSecundaria: meta?.categoria_secundaria
        };
      }
      const meta = getTemaMetadata(item.name);
      return {
        ...item,
        categoria: item.categoria || meta?.categoria,
        categoriaSecundaria: item.categoriaSecundaria || meta?.categoria_secundaria
      };
    });
  };

  const filteredActores = useMemo(() => {
    const list = normalizeList(availableActores);
    if (!actorSearch.trim()) return list;
    const term = actorSearch.toLowerCase();
    return list.filter((a) => a.name.toLowerCase().includes(term));
  }, [availableActores, actorSearch]);

  const filteredMedios = useMemo(() => {
    let list = normalizeList(availableMedios);
    if ((filters.actores?.length || 0) > 0 || filters.dateRange.preset !== 'all') {
      list = list.filter((m) => (m.count || 0) > 0);
    }
    if (!medioSearch.trim()) return list;
    const term = medioSearch.toLowerCase();
    return list.filter((m) => m.name.toLowerCase().includes(term));
  }, [availableMedios, medioSearch, filters.actores, filters.dateRange.preset]);

  // Scoped temas by active category filter (respecting primary and secondary category classification)
  const temasCategoryScoped = useMemo(() => {
    const rawList = normalizeList(availableTemas);
    const selectedCats = filters.categorias || [];
    const hasMediosFilter = Boolean(filters.medios && filters.medios.length > 0);
    const hasActorFilter = Boolean(filters.actores && filters.actores.length > 0);
    const hasDateFilter = Boolean(filters.dateRange && filters.dateRange.preset !== 'all');
    const shouldStrictFilterNonZero = hasActorFilter || hasDateFilter || hasMediosFilter;

    if (selectedCats.length === 0) {
      const baseList = shouldStrictFilterNonZero
        ? rawList.filter((t) => (t.count || 0) > 0)
        : rawList;
      return baseList.map((t) => ({
        ...t,
        isPrimary: true,
        isSecondary: false
      }));
    }

    // Filter raw list by category (primary or secondary)
    let matchedItems: FilterOptionItem[] = rawList
      .filter((item) => {
        const match = matchesCategory(
          { categoria: item.categoria, categoria_secundaria: item.categoriaSecundaria },
          selectedCats
        );
        return match.matches;
      })
      .map((item) => {
        const match = matchesCategory(
          { categoria: item.categoria, categoria_secundaria: item.categoriaSecundaria },
          selectedCats
        );
        return {
          ...item,
          isPrimary: match.isPrimary,
          isSecondary: match.isSecondary
        };
      });

    // Only inject catalog topics with count 0 if NO actor, date range, or media outlet is selected
    if (!shouldStrictFilterNonZero) {
      const existingNames = new Set(matchedItems.map((t) => t.name.toUpperCase().trim()));
      const catalogTemas = getTemasForCategorias(selectedCats);
      for (const catTema of catalogTemas) {
        if (!existingNames.has(catTema.nombre.toUpperCase().trim())) {
          matchedItems.push({
            name: catTema.nombre,
            count: 0,
            categoria: catTema.categoria,
            categoriaSecundaria: catTema.categoria_secundaria,
            isPrimary: catTema.isPrimary,
            isSecondary: catTema.isSecondary
          });
          existingNames.add(catTema.nombre.toUpperCase().trim());
        }
      }
    } else {
      matchedItems = matchedItems.filter((t) => (t.count || 0) > 0);
    }

    return matchedItems.sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) {
        return a.isPrimary ? -1 : 1;
      }
      if ((b.count || 0) !== (a.count || 0)) {
        return (b.count || 0) - (a.count || 0);
      }
      return a.name.localeCompare(b.name);
    });
  }, [availableTemas, filters.categorias, filters.medios, filters.actores, filters.dateRange]);

  const primaryTemasCount = useMemo(() => {
    return temasCategoryScoped.filter((t) => t.isPrimary).length;
  }, [temasCategoryScoped]);

  const secondaryTemasCount = useMemo(() => {
    return temasCategoryScoped.filter((t) => t.isSecondary && !t.isPrimary).length;
  }, [temasCategoryScoped]);

  const filteredTemas = useMemo(() => {
    let list = temasCategoryScoped;
    if (filters.categorias && filters.categorias.length > 0) {
      if (temaTabFilter === 'primary') {
        list = list.filter((t) => t.isPrimary);
      } else if (temaTabFilter === 'secondary') {
        list = list.filter((t) => t.isSecondary && !t.isPrimary);
      }
    }
    if (!temaSearch.trim()) return list;
    const term = temaSearch.toLowerCase();
    return list.filter((t) =>
      t.name.toLowerCase().includes(term) ||
      (t.categoria && t.categoria.toLowerCase().includes(term)) ||
      (t.categoriaSecundaria && t.categoriaSecundaria.toLowerCase().includes(term))
    );
  }, [temasCategoryScoped, temaSearch, temaTabFilter, filters.categorias]);

  const filteredReporteros = useMemo(() => {
    let list = normalizeList(availableReporteros);
    if ((filters.actores?.length || 0) > 0 || filters.dateRange.preset !== 'all') {
      list = list.filter((r) => (r.count || 0) > 0);
    }
    if (!reporteroSearch.trim()) return list;
    const term = reporteroSearch.toLowerCase();
    return list.filter((r) => r.name.toLowerCase().includes(term));
  }, [availableReporteros, reporteroSearch, filters.actores, filters.dateRange.preset]);

  const filteredEstados = useMemo(() => {
    let list = normalizeList(availableEstados);
    if ((filters.actores?.length || 0) > 0 || filters.dateRange.preset !== 'all') {
      list = list.filter((e) => (e.count || 0) > 0);
    }
    if (!estadoSearch.trim()) return list;
    const term = estadoSearch.toLowerCase();
    return list.filter((e) => e.name.toLowerCase().includes(term));
  }, [availableEstados, estadoSearch, filters.actores, filters.dateRange.preset]);

  const filteredMunicipios = useMemo(() => {
    let list = normalizeList(availableMunicipios);
    if ((filters.actores?.length || 0) > 0 || filters.dateRange.preset !== 'all') {
      list = list.filter((m) => (m.count || 0) > 0);
    }
    if (!municipioSearch.trim()) return list;
    const term = municipioSearch.toLowerCase();
    return list.filter((m) => m.name.toLowerCase().includes(term));
  }, [availableMunicipios, municipioSearch, filters.actores, filters.dateRange.preset]);

  const filteredCategorias = useMemo(() => {
    let list = normalizeList(availableCategorias).filter((c) => isCategoriaOficial(c.name));
    if ((filters.actores?.length || 0) > 0 || filters.dateRange.preset !== 'all') {
      list = list.filter((c) => (c.count || 0) > 0);
    }
    if (!categoriaSearch.trim()) return list;
    const term = categoriaSearch.toLowerCase();
    return list.filter((c) => c.name.toLowerCase().includes(term));
  }, [availableCategorias, categoriaSearch, filters.actores, filters.dateRange.preset]);

  const renderFilterScopeBanner = (dropdownKey: string) => {
    const activeConditions: string[] = [];

    if (dropdownKey !== 'actores' && (filters.actores?.length || 0) > 0) {
      activeConditions.push(`Actor: ${filters.actores!.join(', ')}`);
    }

    if (dropdownKey !== 'categorias' && (filters.categorias?.length || 0) > 0) {
      activeConditions.push(`Categoría: ${filters.categorias!.join(', ')}`);
    }

    if (filters.dateRange.preset !== 'all') {
      const presetLabels: Record<string, string> = {
        today: 'Hoy',
        '7d': '7 días',
        '30d': '30 días',
        '60d': '60 días',
        '90d': '90 días',
        custom: `${filters.dateRange.start || 'Inicio'} al ${filters.dateRange.end || 'Hoy'}`
      };
      activeConditions.push(presetLabels[filters.dateRange.preset] || 'Periodo');
    }

    if (dropdownKey !== 'estados' && (filters.estados?.length || 0) > 0) {
      activeConditions.push(`Estado: ${filters.estados!.join(', ')}`);
    }

    if (dropdownKey !== 'municipios' && (filters.municipios?.length || 0) > 0) {
      activeConditions.push(`Municipio: ${filters.municipios!.join(', ')}`);
    }

    if (activeConditions.length === 0) return null;

    return (
      <div className="px-2.5 py-1 mb-1 bg-argos-teal/10 dark:bg-argos-teal/40 text-[10px] text-teal-ink dark:text-teal-glow font-medium rounded-md flex items-center gap-1.5 border border-argos-teal/25 dark:border-argos-teal/50">
        <Layers className="w-3 h-3 text-teal-ink shrink-0" />
        <span className="truncate">Notas de: {activeConditions.join(' • ')}</span>
      </div>
    );
  };

  const hasActiveFilters =
    filters.search !== '' ||
    filters.actores.length > 0 ||
    filters.medios.length > 0 ||
    (filters.temas && filters.temas.length > 0) ||
    filters.calificaciones.length > 0 ||
    filters.reporteros.length > 0 ||
    ((filters.estados?.length || 0) > 0) ||
    ((filters.municipios?.length || 0) > 0) ||
    ((filters.categorias?.length || 0) > 0) ||
    filters.dateRange.preset !== '90d';

  return (
    <div
      ref={containerRef}
      className={`relative ${openDropdown ? 'z-50' : 'z-20'} w-full space-y-2.5 ${embedded ? '' : 'rounded-3xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm'}`}
    >
      {/* Rango de fechas */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        {/* Date Presets */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1 mr-1 shrink-0">
            <Calendar className="w-3.5 h-3.5" /> Rango:
          </span>
          {[
            { id: 'all', label: 'Todo' },
            { id: 'today', label: 'Hoy' },
            { id: '7d', label: '7 Días' },
            { id: '30d', label: '30 Días' },
            { id: '60d', label: '60 Días' },
            { id: '90d', label: '90 Días' }
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => handleDatePreset(p.id as FilterState['dateRange']['preset'])}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
                filters.dateRange.preset === p.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Rango personalizado Desde / Hasta */}
        <div className="flex flex-wrap items-center gap-1.5 lg:pl-3 lg:border-l border-slate-200 dark:border-slate-700">
          <label htmlFor="filter-date-start" className="text-xs font-semibold text-slate-400 dark:text-slate-500 shrink-0">
            Desde
          </label>
          <input
            id="filter-date-start"
            type="date"
            value={filters.dateRange.preset === 'all' ? '' : filters.dateRange.start}
            max={getOperationalTodayDate()}
            onChange={(e) => handleCustomDate('start', e.target.value)}
            className={`px-2 py-1 text-xs rounded-lg border bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-argos-teal/40 ${
              filters.dateRange.preset === 'custom'
                ? 'border-argos-teal/50'
                : 'border-slate-300 dark:border-slate-600'
            }`}
          />
          <label htmlFor="filter-date-end" className="text-xs font-semibold text-slate-400 dark:text-slate-500 shrink-0">
            Hasta
          </label>
          <input
            id="filter-date-end"
            type="date"
            value={filters.dateRange.preset === 'all' ? '' : filters.dateRange.end}
            max={getOperationalTodayDate()}
            onChange={(e) => handleCustomDate('end', e.target.value)}
            className={`px-2 py-1 text-xs rounded-lg border bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-argos-teal/40 ${
              filters.dateRange.preset === 'custom'
                ? 'border-argos-teal/50'
                : 'border-slate-300 dark:border-slate-600'
            }`}
          />
        </div>
      </div>

      {/* Niveles de filtrado: territorio -> segmento -> fuentes -> tono */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 divide-y divide-slate-200 dark:divide-slate-800">
        <FilterLevel icon={UserRound} accent title="Actor" hint="Foco principal del análisis">
          {/* 1. Actores Dropdown */}
          <div className="relative w-full sm:w-auto sm:min-w-[18rem]" data-filter-dropdown>
            <button
              onClick={() => toggleDropdown('actores')}
              id="dropdown-filter-actores"
              className={`flex w-full items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                filters.actores.length > 0
                  ? 'border-argos-teal/40 bg-argos-teal/10 dark:bg-argos-teal/40 text-teal-ink dark:text-teal-glow shadow-xs'
                  : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <UserRound className="w-4 h-4 shrink-0 text-teal-ink dark:text-teal-glow" strokeWidth={2} />
              <span className="flex-1 text-left">Actores {filters.actores.length > 0 && `(${filters.actores.length})`}</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {openDropdown === 'actores' && (
              <div className="absolute top-full left-0 mt-1.5 w-full min-w-[20rem] max-h-80 overflow-hidden flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-2 z-50">
                {renderFilterScopeBanner('actores')}
                <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <input
                    type="text"
                    value={actorSearch}
                    onChange={(e) => setActorSearch(e.target.value)}
                    placeholder="Filtrar actor..."
                    className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-argos-teal/40"
                  />
                </div>
                <div className="overflow-y-auto max-h-64 p-1 space-y-0.5">
                  {filteredActores.length > 0 ? (
                    filteredActores.map((actor) => {
                      const isChecked = filters.actores.includes(actor.name);
                      return (
                        <label
                          key={actor.name}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleActor(actor.name)}
                              className="rounded border-slate-300 text-teal-ink focus:ring-argos-teal/40 shrink-0"
                            />
                            <span className="truncate font-medium">{actor.name}</span>
                          </div>
                          {actor.count > 0 && (
                            <span className="text-[10px] font-mono text-slate-400 shrink-0">
                              {actor.count.toLocaleString()}
                            </span>
                          )}
                        </label>
                      );
                    })
                  ) : (
                    <div className="text-center py-4 text-xs text-slate-400">No se encontraron actores</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </FilterLevel>
        <FilterLevel icon={MapPin} title="Territorio" hint="Dónde se analiza">
          {/* 5. Estados Dropdown */}
          <div className="relative" data-filter-dropdown>
            <button
              onClick={() => toggleDropdown('estados')}
              id="dropdown-filter-estados"
              className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                (filters.estados?.length || 0) > 0
                  ? 'border-argos-teal/40 bg-argos-teal/10 dark:bg-argos-teal/40 text-teal-ink dark:text-teal-glow shadow-xs'
                  : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-teal-ink" />
              <span>Estados {(filters.estados?.length || 0) > 0 && `(${filters.estados?.length})`}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {openDropdown === 'estados' && (
              <div className="absolute top-full left-0 mt-1.5 w-72 max-h-80 overflow-hidden flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-2 z-50">
                {renderFilterScopeBanner('estados')}
                <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <input
                    type="text"
                    value={estadoSearch}
                    onChange={(e) => setEstadoSearch(e.target.value)}
                    placeholder="Filtrar estado o región..."
                    className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-argos-teal/40"
                  />
                </div>
                <div className="overflow-y-auto max-h-64 p-1 space-y-0.5">
                  {filteredEstados.length > 0 ? (
                    filteredEstados.map((est) => {
                      const isChecked = (filters.estados || []).includes(est.name);
                      return (
                        <label
                          key={est.name}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleEstado(est.name)}
                              className="rounded border-slate-300 text-teal-ink focus:ring-argos-teal/40 shrink-0"
                            />
                            <span className="truncate font-medium">{est.name}</span>
                          </div>
                          {est.count > 0 && (
                            <span className="text-[10px] font-mono text-slate-400 shrink-0">
                              {est.count.toLocaleString()}
                            </span>
                          )}
                        </label>
                      );
                    })
                  ) : (
                    <div className="text-center py-4 text-xs text-slate-400">No se encontraron estados</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 6. Municipios Dropdown */}
          <div className="relative" data-filter-dropdown>
            <button
              onClick={() => toggleDropdown('municipios')}
              id="dropdown-filter-municipios"
              className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                (filters.municipios?.length || 0) > 0
                  ? 'border-argos-teal/40 bg-argos-teal/10 dark:bg-argos-teal/40 text-teal-ink dark:text-teal-glow shadow-xs'
                  : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-teal-ink" />
              <span>Municipios {(filters.municipios?.length || 0) > 0 && `(${filters.municipios?.length})`}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {openDropdown === 'municipios' && (
              <div className="absolute top-full left-0 mt-1.5 w-72 max-h-80 overflow-hidden flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-2 z-50">
                {renderFilterScopeBanner('municipios')}
                <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <input
                    type="text"
                    value={municipioSearch}
                    onChange={(e) => setMunicipioSearch(e.target.value)}
                    placeholder="Filtrar municipio..."
                    className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-argos-teal/40"
                  />
                </div>
                <div className="overflow-y-auto max-h-64 p-1 space-y-0.5">
                  {filteredMunicipios.length > 0 ? (
                    filteredMunicipios.map((mun) => {
                      const isChecked = (filters.municipios || []).includes(mun.name);
                      return (
                        <label
                          key={mun.name}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleMunicipio(mun.name)}
                              className="rounded border-slate-300 text-teal-ink focus:ring-argos-teal/40 shrink-0"
                            />
                            <span className="truncate font-medium">{mun.name}</span>
                          </div>
                          {mun.count > 0 && (
                            <span className="text-[10px] font-mono text-slate-400 shrink-0">
                              {mun.count.toLocaleString()}
                            </span>
                          )}
                        </label>
                      );
                    })
                  ) : (
                    <div className="text-center py-4 text-xs text-slate-400">No se encontraron municipios</div>
                  )}
                </div>
              </div>
            )}
          </div>

        </FilterLevel>
        <FilterLevel icon={Layers} title="Segmentar" hint="Temas y categorías">
          {/* 3. Temas Dropdown (Enhanced with Primary and Secondary Category Sectioning) */}
          <div className="relative" data-filter-dropdown>
            <button
              onClick={() => toggleDropdown('temas')}
              id="dropdown-filter-temas"
              className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                filters.temas && filters.temas.length > 0
                  ? 'border-argos-teal/40 bg-argos-teal/10 dark:bg-argos-teal/40 text-teal-ink dark:text-teal-glow shadow-xs'
                  : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <Tag className="w-3.5 h-3.5 text-teal-ink" />
              <span>
                Temas {filters.temas && filters.temas.length > 0 && `(${filters.temas.length})`}
              </span>
              {filters.categorias && filters.categorias.length > 0 && (
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-argos-teal/20 text-teal-ink dark:text-teal-glow border border-argos-teal/30">
                  {temasCategoryScoped.length} de cat.
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {openDropdown === 'temas' && (
              <div className="absolute top-full left-0 mt-1.5 w-80 sm:w-96 max-h-[28rem] overflow-hidden flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-2.5 z-50">
                {/* Category Scope Informational Header */}
                {filters.categorias && filters.categorias.length > 0 ? (
                  <div className="mb-2 p-2.5 rounded-xl bg-argos-teal/90 dark:bg-argos-teal/50 border border-argos-teal/25 dark:border-argos-teal/60 text-xs">
                    <div className="flex items-center justify-between font-bold text-teal-ink dark:text-teal-glow">
                      <span className="flex items-center gap-1.5 truncate">
                        <Layers className="w-3.5 h-3.5 text-teal-ink dark:text-teal-glow shrink-0" />
                        <span className="truncate">Categoría: {filters.categorias.join(', ')}</span>
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-argos-teal/60 dark:bg-argos-teal/60 text-teal-ink dark:text-teal-glow shrink-0">
                        {temasCategoryScoped.length} temas
                      </span>
                    </div>
                    <p className="text-[11px] text-teal-ink dark:text-teal-glow mt-1">
                      Mostrando temas seccionados en <strong className="font-semibold text-teal-ink dark:text-teal-glow">Categoría Principal</strong> y <strong className="font-semibold text-amber-700 dark:text-amber-300">Categoría Secundaria</strong>.
                    </p>
                  </div>
                ) : (
                  <div className="mb-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-teal-ink shrink-0" />
                    <span>Selecciona una <strong className="text-teal-ink dark:text-teal-glow">Categoría</strong> para enfocar solo sus temas correspondientes.</span>
                  </div>
                )}

                {/* Search input */}
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={temaSearch}
                    onChange={(e) => setTemaSearch(e.target.value)}
                    placeholder="Buscar tema por nombre o subcategoría..."
                    className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-argos-teal/40"
                  />
                  {temaSearch && (
                    <button
                      type="button"
                      onClick={() => setTemaSearch('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Sectioned Tabs: All, Primary, Secondary */}
                {filters.categorias && filters.categorias.length > 0 && (
                  <div className="flex items-center p-1 mb-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-[11px]">
                    <button
                      type="button"
                      onClick={() => setTemaTabFilter('all')}
                      className={`flex-1 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                        temaTabFilter === 'all'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Todos ({temasCategoryScoped.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemaTabFilter('primary')}
                      className={`flex-1 py-1 rounded-lg font-medium transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        temaTabFilter === 'primary'
                          ? 'bg-white dark:bg-slate-700 text-teal-ink dark:text-teal-glow shadow-xs font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span>📌 Principal</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-argos-teal/10 dark:bg-argos-teal/50 text-teal-ink dark:text-teal-glow">
                        {primaryTemasCount}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemaTabFilter('secondary')}
                      className={`flex-1 py-1 rounded-lg font-medium transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        temaTabFilter === 'secondary'
                          ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-xs font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span>📎 Secundaria</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">
                        {secondaryTemasCount}
                      </span>
                    </button>
                  </div>
                )}

                {/* Bulk selection action row */}
                <div className="flex items-center justify-between px-1 py-1 mb-1 border-b border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                  <span>
                    {filters.temas && filters.temas.length > 0 ? (
                      <span className="text-teal-ink dark:text-teal-glow font-semibold">
                        {filters.temas.length} tema(s) marcado(s)
                      </span>
                    ) : (
                      'Ningún tema marcado'
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    {filteredTemas.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const namesToAdd = filteredTemas.map((t) => t.name);
                          const combined = Array.from(new Set([...(filters.temas || []), ...namesToAdd]));
                          onFilterChange({ ...filters, temas: combined });
                        }}
                        className="text-teal-ink dark:text-teal-glow hover:underline cursor-pointer font-medium"
                      >
                        Marcar todos
                      </button>
                    )}
                    {filters.temas && filters.temas.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onFilterChange({ ...filters, temas: [] })}
                        className="text-rose-500 hover:underline cursor-pointer font-medium"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                </div>

                {/* Temas List with Sectioning */}
                <div className="overflow-y-auto max-h-60 p-1 space-y-1">
                  {filteredTemas.length > 0 ? (
                    <>
                      {/* Section 1: Temas Principales (if in 'all' view with categories selected) */}
                      {filters.categorias && filters.categorias.length > 0 && temaTabFilter === 'all' && (
                        <div className="px-2 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-teal-ink dark:text-teal-glow flex items-center justify-between">
                          <span className="flex items-center gap-1">📌 Categoría Principal</span>
                          <span className="font-mono text-[9px] text-slate-400">{primaryTemasCount} temas</span>
                        </div>
                      )}

                      {filteredTemas
                        .filter((t) => (filters.categorias && filters.categorias.length > 0 && temaTabFilter === 'all' ? t.isPrimary : true))
                        .map((tema) => {
                          const isChecked = (filters.temas || []).includes(tema.name);
                          return (
                            <label
                              key={tema.name}
                              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs cursor-pointer transition-colors ${
                                isChecked
                                  ? 'bg-argos-teal/10 dark:bg-argos-teal/40 text-teal-ink dark:text-teal-glow border border-argos-teal/20'
                                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleTema(tema.name)}
                                  className="rounded border-slate-300 text-teal-ink focus:ring-argos-teal/40 shrink-0"
                                />
                                <div className="truncate flex-1 min-w-0">
                                  <div className="truncate font-medium">{tema.name}</div>
                                  {tema.categoriaSecundaria && (
                                    <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                                      <span className="text-[9px] px-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                        Sec: {tema.categoriaSecundaria}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {tema.count !== undefined && tema.count > 0 && (
                                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                    {tema.count.toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </label>
                          );
                        })}

                      {/* Section 2: Temas de Categoría Secundaria (if in 'all' view and has secondary temas) */}
                      {filters.categorias && filters.categorias.length > 0 && temaTabFilter === 'all' && secondaryTemasCount > 0 && (
                        <>
                          <div className="px-2 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 mt-2">
                            <span className="flex items-center gap-1">📎 Categoría Secundaria</span>
                            <span className="font-mono text-[9px] text-slate-400">{secondaryTemasCount} temas</span>
                          </div>

                          {filteredTemas
                            .filter((t) => t.isSecondary && !t.isPrimary)
                            .map((tema) => {
                              const isChecked = (filters.temas || []).includes(tema.name);
                              return (
                                <label
                                  key={tema.name}
                                  className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs cursor-pointer transition-colors ${
                                    isChecked
                                      ? 'bg-amber-500/10 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-500/20'
                                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleTema(tema.name)}
                                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 shrink-0"
                                    />
                                    <div className="truncate flex-1 min-w-0">
                                      <div className="truncate font-medium">{tema.name}</div>
                                      <div className="text-[10px] text-amber-600 dark:text-amber-400 truncate flex items-center gap-1">
                                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100/70 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-medium">
                                          Princ: {tema.categoria || 'Otra'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {tema.count !== undefined && tema.count > 0 && (
                                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-amber-100/50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                                        {tema.count.toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                </label>
                              );
                            })}
                        </>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-6 text-xs text-slate-400">
                      No se encontraron temas coincidentes
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 7. Categorías Dropdown */}
          <div className="relative" data-filter-dropdown>
            <button
              onClick={() => toggleDropdown('categorias')}
              id="dropdown-filter-categorias"
              className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                (filters.categorias?.length || 0) > 0
                  ? 'border-argos-teal/40 bg-argos-teal/10 dark:bg-argos-teal/40 text-teal-ink dark:text-teal-glow shadow-xs'
                  : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-teal-ink" />
              <span>Categorías {(filters.categorias?.length || 0) > 0 && `(${filters.categorias?.length})`}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {openDropdown === 'categorias' && (
              <div className="absolute top-full left-0 mt-1.5 w-72 max-h-80 overflow-hidden flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-2 z-50">
                {renderFilterScopeBanner('categorias')}
                <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <input
                    type="text"
                    value={categoriaSearch}
                    onChange={(e) => setCategoriaSearch(e.target.value)}
                    placeholder="Filtrar categoría..."
                    className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-argos-teal/40"
                  />
                </div>
                <div className="overflow-y-auto max-h-64 p-1 space-y-0.5">
                  {filteredCategorias.length > 0 ? (
                    filteredCategorias.map((cat) => {
                      const isChecked = (filters.categorias || []).includes(cat.name);
                      return (
                        <label
                          key={cat.name}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleCategoria(cat.name)}
                              className="rounded border-slate-300 text-teal-ink focus:ring-argos-teal/40 shrink-0"
                            />
                            <span className="truncate font-medium">{cat.name}</span>
                          </div>
                          {cat.count > 0 && (
                            <span className="text-[10px] font-mono text-slate-400 shrink-0">
                              {cat.count.toLocaleString()}
                            </span>
                          )}
                        </label>
                      );
                    })
                  ) : (
                    <div className="text-center py-4 text-xs text-slate-400">No se encontraron categorías</div>
                  )}
                </div>
              </div>
            )}
          </div>

        </FilterLevel>
        <FilterLevel icon={Newspaper} title="Fuentes" hint="Medios y reporteros">
          {/* 2. Medios Dropdown */}
          <div className="relative" data-filter-dropdown>
            <button
              onClick={() => toggleDropdown('medios')}
              id="dropdown-filter-medios"
              className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                filters.medios.length > 0
                  ? 'border-argos-teal/40 bg-argos-teal/10 dark:bg-argos-teal/40 text-teal-ink dark:text-teal-glow shadow-xs'
                  : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <Newspaper className="w-3.5 h-3.5 text-teal-ink" />
              <span>Medios {filters.medios.length > 0 && `(${filters.medios.length})`}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {openDropdown === 'medios' && (
              <div className="absolute top-full left-0 mt-1.5 w-72 max-h-80 overflow-hidden flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-2 z-50">
                {renderFilterScopeBanner('medios')}
                <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <input
                    type="text"
                    value={medioSearch}
                    onChange={(e) => setMedioSearch(e.target.value)}
                    placeholder="Filtrar medio..."
                    className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-argos-teal/40"
                  />
                </div>
                <div className="overflow-y-auto max-h-64 p-1 space-y-0.5">
                  {filteredMedios.length > 0 ? (
                    filteredMedios.map((medio) => {
                      const isChecked = filters.medios.includes(medio.name);
                      return (
                        <label
                          key={medio.name}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleMedio(medio.name)}
                              className="rounded border-slate-300 text-teal-ink focus:ring-argos-teal/40 shrink-0"
                            />
                            <span className="truncate font-medium">{medio.name}</span>
                          </div>
                          {medio.count > 0 && (
                            <span className="text-[10px] font-mono text-slate-400 shrink-0">
                              {medio.count.toLocaleString()}
                            </span>
                          )}
                        </label>
                      );
                    })
                  ) : (
                    <div className="text-center py-4 text-xs text-slate-400">No se encontraron medios</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 4. Reporteros Dropdown */}
          <div className="relative" data-filter-dropdown>
            <button
              onClick={() => toggleDropdown('reporteros')}
              id="dropdown-filter-reporteros"
              className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                filters.reporteros.length > 0
                  ? 'border-argos-teal/40 bg-argos-teal/10 dark:bg-argos-teal/40 text-teal-ink dark:text-teal-glow shadow-xs'
                  : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-teal-ink" />
              <span>Reporteros {filters.reporteros.length > 0 && `(${filters.reporteros.length})`}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {openDropdown === 'reporteros' && (
              <div className="absolute top-full left-0 mt-1.5 w-72 max-h-80 overflow-hidden flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-2 z-50">
                {renderFilterScopeBanner('reporteros')}
                <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <input
                    type="text"
                    value={reporteroSearch}
                    onChange={(e) => setReporteroSearch(e.target.value)}
                    placeholder="Filtrar reportero..."
                    className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-argos-teal/40"
                  />
                </div>
                <div className="overflow-y-auto max-h-64 p-1 space-y-0.5">
                  {filteredReporteros.length > 0 ? (
                    filteredReporteros.map((rep) => {
                      const isChecked = filters.reporteros.includes(rep.name);
                      return (
                        <label
                          key={rep.name}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleReportero(rep.name)}
                              className="rounded border-slate-300 text-teal-ink focus:ring-argos-teal/40 shrink-0"
                            />
                            <span className="truncate font-medium">{rep.name}</span>
                          </div>
                          {rep.count > 0 && (
                            <span className="text-[10px] font-mono text-slate-400 shrink-0">
                              {rep.count.toLocaleString()}
                            </span>
                          )}
                        </label>
                      );
                    })
                  ) : (
                    <div className="text-center py-4 text-xs text-slate-400">No se encontraron reporteros</div>
                  )}
                </div>
              </div>
            )}
          </div>

        </FilterLevel>
        <FilterLevel icon={Sparkles} title="Tono" hint="Positivas, neutrales y negativas">
          {/* Calificación / Sentimiento Selector */}
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
            <button
              type="button"
              id="filter-sentimiento-positiva"
              onClick={() => toggleCalificacion('Positiva')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filters.calificaciones.includes('Positiva')
                  ? 'bg-argos-teal text-slate-950 shadow-xs font-semibold'
                  : 'text-teal-ink dark:text-teal-glow hover:bg-argos-teal/15'
              }`}
            >
              <Smile className="w-3.5 h-3.5" />
              <span>Positivas</span>
            </button>

            <button
              type="button"
              id="filter-sentimiento-neutral"
              onClick={() => toggleCalificacion('Neutral')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filters.calificaciones.includes('Neutral')
                  ? 'bg-slate-600 text-white shadow-xs font-semibold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-300/40 dark:hover:bg-slate-700/60'
              }`}
            >
              <Meh className="w-3.5 h-3.5" />
              <span>Neutrales</span>
            </button>

            <button
              type="button"
              id="filter-sentimiento-negativa"
              onClick={() => toggleCalificacion('Negativa')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filters.calificaciones.includes('Negativa')
                  ? 'bg-argos-pink text-white shadow-xs font-semibold'
                  : 'text-argos-pink hover:bg-argos-pink/10'
              }`}
            >
              <Frown className="w-3.5 h-3.5" />
              <span>Negativas</span>
            </button>
          </div>
        </FilterLevel>
      </div>

      {/* Filtros seleccionados */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-xs font-semibold text-slate-900 dark:text-white">Filtros seleccionados</h4>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Mostrando <span className="text-teal-ink dark:text-teal-glow font-bold">{filteredCount.toLocaleString()}</span> de {totalRecords.toLocaleString()}
          </span>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              id="btn-reset-filters"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar</span>
            </button>
          )}
        </div>
      </div>

      {hasActiveFilters ? (
        <div className="flex flex-wrap items-center gap-2">

          {filters.dateRange.preset === 'custom' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-500/10 border border-slate-500/30 text-slate-700 dark:text-slate-300 text-xs font-medium">
              <Calendar className="w-3 h-3" />
              {filters.dateRange.start || 'Inicio'} al {filters.dateRange.end || 'Hoy'}
              <button onClick={() => handleDatePreset('90d')} className="hover:text-rose-500 cursor-pointer" title="Volver a 90 días">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.search && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-argos-teal/10 border border-argos-teal/30 text-teal-ink dark:text-teal-glow text-xs">
              Texto: &ldquo;{filters.search}&rdquo;
              <button
                onClick={() => onFilterChange({ ...filters, search: '' })}
                className="hover:text-rose-500 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filters.calificaciones.map((c) => (
            <span
              key={c}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${
                c === 'Positiva'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : c === 'Negativa'
                  ? 'bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300'
                  : 'bg-slate-500/10 border border-slate-500/30 text-slate-700 dark:text-slate-300'
              }`}
            >
              {c}
              <button onClick={() => toggleCalificacion(c)} className="hover:opacity-75 cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {filters.actores.map((actor) => (
            <span
              key={actor}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-argos-teal/10 border border-argos-teal/30 text-teal-ink dark:text-teal-glow text-xs font-medium"
            >
              Actor: {actor}
              <button onClick={() => toggleActor(actor)} className="hover:text-rose-500 cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {filters.medios.map((medio) => (
            <span
              key={medio}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium"
            >
              Medio: {medio}
              <button onClick={() => toggleMedio(medio)} className="hover:text-rose-500 cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {(filters.temas || []).map((tema) => (
            <span
              key={tema}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-medium"
            >
              Tema: {tema}
              <button onClick={() => toggleTema(tema)} className="hover:text-rose-500 cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {filters.reporteros.map((rep) => (
            <span
              key={rep}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-700 dark:text-purple-300 text-xs font-medium"
            >
              Reportero: {rep}
              <button onClick={() => toggleReportero(rep)} className="hover:text-rose-500 cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {(filters.estados || []).map((est) => (
            <span
              key={est}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-teal-500/10 border border-teal-500/30 text-teal-800 dark:text-teal-300 text-xs font-medium"
            >
              Estado: {est}
              <button onClick={() => toggleEstado(est)} className="hover:text-rose-500 cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {(filters.municipios || []).map((mun) => (
            <span
              key={mun}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-800 dark:text-sky-300 text-xs font-medium"
            >
              Municipio: {mun}
              <button onClick={() => toggleMunicipio(mun)} className="hover:text-rose-500 cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {(filters.categorias || []).map((cat) => (
            <span
              key={cat}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-orange-500/10 border border-orange-500/30 text-orange-800 dark:text-orange-300 text-xs font-medium"
            >
              Categoría: {cat}
              <button onClick={() => toggleCategoria(cat)} className="hover:text-rose-500 cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Sin filtros: se muestran todas las notas del rango seleccionado.
        </p>
      )}
    </div>
  );
};
