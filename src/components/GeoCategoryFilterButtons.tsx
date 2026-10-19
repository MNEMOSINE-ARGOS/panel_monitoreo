import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MapPin, Compass, Layers, ChevronDown, Search, X, Check, RotateCcw } from 'lucide-react';
import { FilterState, FilterOptionItem } from '../types';
import { isCategoriaOficial } from '../data/temasCatalogo';

export interface GeoCategoryFilterButtonsProps {
  filters: FilterState;
  onFilterChange: (updater: (prev: FilterState) => FilterState) => void;
  availableEstados?: Array<string | FilterOptionItem>;
  availableMunicipios?: Array<string | FilterOptionItem>;
  availableCategorias?: Array<string | FilterOptionItem>;
  layout?: 'horizontal' | 'vertical' | 'sidebar';
  isCollapsed?: boolean;
  className?: string;
}

interface NormalizedOption {
  name: string;
  count: number;
}

export const GeoCategoryFilterButtons: React.FC<GeoCategoryFilterButtonsProps> = ({
  filters,
  onFilterChange,
  availableEstados = [],
  availableMunicipios = [],
  availableCategorias = [],
  layout = 'horizontal',
  isCollapsed = false,
  className = ''
}) => {
  const [openDropdown, setOpenDropdown] = useState<'estados' | 'municipios' | 'categorias' | null>(null);
  const [estadoSearch, setEstadoSearch] = useState('');
  const [municipioSearch, setMunicipioSearch] = useState('');
  const [categoriaSearch, setCategoriaSearch] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Esc
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element | null)?.closest?.('[data-filter-dropdown] > *')) {
        setOpenDropdown(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenDropdown(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Helper to normalize lists into { name, count }
  const normalize = (items: Array<string | FilterOptionItem>): NormalizedOption[] => {
    return items
      .map((item) => {
        if (typeof item === 'string') {
          return { name: item.trim(), count: 0 };
        }
        return { name: item.name.trim(), count: item.count || 0 };
      })
      .filter((opt) => opt.name && opt.name !== '');
  };

  const hasActorOrRangeScope = (filters.actores?.length || 0) > 0 || filters.dateRange.preset !== 'all';

  const normalizedEstados = useMemo(() => {
    let list = normalize(availableEstados);
    if (hasActorOrRangeScope) {
      list = list.filter((e) => (e.count || 0) > 0);
    }
    return list;
  }, [availableEstados, hasActorOrRangeScope]);

  const normalizedMunicipios = useMemo(() => {
    let list = normalize(availableMunicipios);
    if (hasActorOrRangeScope) {
      list = list.filter((m) => (m.count || 0) > 0);
    }
    return list;
  }, [availableMunicipios, hasActorOrRangeScope]);

  const normalizedCategorias = useMemo(() => {
    let list = normalize(availableCategorias).filter((c) => isCategoriaOficial(c.name));
    if (hasActorOrRangeScope) {
      list = list.filter((c) => (c.count || 0) > 0);
    }
    return list;
  }, [availableCategorias, hasActorOrRangeScope]);

  // Filtered lists by respective search input
  const filteredEstados = useMemo(() => {
    if (!estadoSearch.trim()) return normalizedEstados;
    const q = estadoSearch.toLowerCase();
    return normalizedEstados.filter((e) => e.name.toLowerCase().includes(q));
  }, [normalizedEstados, estadoSearch]);

  const filteredMunicipios = useMemo(() => {
    if (!municipioSearch.trim()) return normalizedMunicipios;
    const q = municipioSearch.toLowerCase();
    return normalizedMunicipios.filter((m) => m.name.toLowerCase().includes(q));
  }, [normalizedMunicipios, municipioSearch]);

  const filteredCategorias = useMemo(() => {
    if (!categoriaSearch.trim()) return normalizedCategorias;
    const q = categoriaSearch.toLowerCase();
    return normalizedCategorias.filter((c) => c.name.toLowerCase().includes(q));
  }, [normalizedCategorias, categoriaSearch]);

  // Toggle handlers
  const toggleEstado = (name: string) => {
    onFilterChange((prev) => {
      const current = prev.estados || [];
      const exists = current.includes(name);
      return {
        ...prev,
        estados: exists ? current.filter((item) => item !== name) : [...current, name]
      };
    });
  };

  const toggleMunicipio = (name: string) => {
    onFilterChange((prev) => {
      const current = prev.municipios || [];
      const exists = current.includes(name);
      return {
        ...prev,
        municipios: exists ? current.filter((item) => item !== name) : [...current, name]
      };
    });
  };

  const toggleCategoria = (name: string) => {
    onFilterChange((prev) => {
      const current = prev.categorias || [];
      const exists = current.includes(name);
      return {
        ...prev,
        categorias: exists ? current.filter((item) => item !== name) : [...current, name]
      };
    });
  };

  const clearFilter = (type: 'estados' | 'municipios' | 'categorias') => {
    onFilterChange((prev) => ({
      ...prev,
      [type]: []
    }));
  };

  const clearAll = () => {
    onFilterChange((prev) => ({
      ...prev,
      estados: [],
      municipios: [],
      categorias: []
    }));
  };

  const estadosCount = filters.estados?.length || 0;
  const municipiosCount = filters.municipios?.length || 0;
  const categoriasCount = filters.categorias?.length || 0;
  const hasAnyActive = estadosCount > 0 || municipiosCount > 0 || categoriasCount > 0;

  // Render collapsed sidebar state (compact icons with badge)
  if (layout === 'sidebar' && isCollapsed) {
    return (
      <div ref={containerRef} className="flex flex-col items-center gap-2 py-2 relative">
        {/* 1. Estados icon button */}
        <div className="relative" data-filter-dropdown>
          <button
            type="button"
            onClick={() => setOpenDropdown(openDropdown === 'estados' ? null : 'estados')}
            title={`Estados ${estadosCount > 0 ? `(${estadosCount})` : ''}`}
            className={`p-2 rounded-xl border transition-all cursor-pointer relative ${
              estadosCount > 0
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                : 'bg-[#0c1829] dark:bg-[#0c1829] border-slate-700/80 text-cyan-400 hover:border-cyan-500/50'
            }`}
          >
            <MapPin className="w-4 h-4" />
            {estadosCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-cyan-500 text-[9px] font-bold text-slate-950 flex items-center justify-center">
                {estadosCount}
              </span>
            )}
          </button>

          {openDropdown === 'estados' && (
            <div className="fixed md:absolute left-20 top-0 w-72 max-h-80 overflow-hidden flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-2.5 z-50 text-slate-100">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold flex items-center gap-1.5 text-cyan-400">
                  <MapPin className="w-3.5 h-3.5" /> Estados
                </span>
                {estadosCount > 0 && (
                  <button onClick={() => clearFilter('estados')} className="text-[10px] text-rose-400 hover:underline">
                    Limpiar ({estadosCount})
                  </button>
                )}
              </div>
              <div className="py-2">
                <input
                  type="text"
                  value={estadoSearch}
                  onChange={(e) => setEstadoSearch(e.target.value)}
                  placeholder="Filtrar estado..."
                  className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-700 bg-slate-800 text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
              <div className="overflow-y-auto max-h-56 space-y-0.5 pr-1">
                {filteredEstados.map((est) => {
                  const isChecked = (filters.estados || []).includes(est.name);
                  return (
                    <label
                      key={est.name}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800 text-xs cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleEstado(est.name)}
                          className="rounded border-slate-600 text-cyan-500 focus:ring-cyan-500"
                        />
                        <span className="truncate">{est.name}</span>
                      </div>
                      {est.count > 0 && (
                        <span className="text-[10px] font-mono text-slate-400">{est.count.toLocaleString()}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 2. Municipios icon button */}
        <div className="relative" data-filter-dropdown>
          <button
            type="button"
            onClick={() => setOpenDropdown(openDropdown === 'municipios' ? null : 'municipios')}
            title={`Municipios ${municipiosCount > 0 ? `(${municipiosCount})` : ''}`}
            className={`p-2 rounded-xl border transition-all cursor-pointer relative ${
              municipiosCount > 0
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                : 'bg-[#0c1829] dark:bg-[#0c1829] border-slate-700/80 text-cyan-400 hover:border-cyan-500/50'
            }`}
          >
            <Compass className="w-4 h-4" />
            {municipiosCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-cyan-500 text-[9px] font-bold text-slate-950 flex items-center justify-center">
                {municipiosCount}
              </span>
            )}
          </button>

          {openDropdown === 'municipios' && (
            <div className="fixed md:absolute left-20 top-0 w-72 max-h-80 overflow-hidden flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-2.5 z-50 text-slate-100">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold flex items-center gap-1.5 text-cyan-400">
                  <Compass className="w-3.5 h-3.5" /> Municipios
                </span>
                {municipiosCount > 0 && (
                  <button onClick={() => clearFilter('municipios')} className="text-[10px] text-rose-400 hover:underline">
                    Limpiar ({municipiosCount})
                  </button>
                )}
              </div>
              <div className="py-2">
                <input
                  type="text"
                  value={municipioSearch}
                  onChange={(e) => setMunicipioSearch(e.target.value)}
                  placeholder="Filtrar municipio..."
                  className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-700 bg-slate-800 text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
              <div className="overflow-y-auto max-h-56 space-y-0.5 pr-1">
                {filteredMunicipios.map((mun) => {
                  const isChecked = (filters.municipios || []).includes(mun.name);
                  return (
                    <label
                      key={mun.name}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800 text-xs cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleMunicipio(mun.name)}
                          className="rounded border-slate-600 text-cyan-500 focus:ring-cyan-500"
                        />
                        <span className="truncate">{mun.name}</span>
                      </div>
                      {mun.count > 0 && (
                        <span className="text-[10px] font-mono text-slate-400">{mun.count.toLocaleString()}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 3. Categorías icon button */}
        <div className="relative" data-filter-dropdown>
          <button
            type="button"
            onClick={() => setOpenDropdown(openDropdown === 'categorias' ? null : 'categorias')}
            title={`Categorías ${categoriasCount > 0 ? `(${categoriasCount})` : ''}`}
            className={`p-2 rounded-xl border transition-all cursor-pointer relative ${
              categoriasCount > 0
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                : 'bg-[#0c1829] dark:bg-[#0c1829] border-slate-700/80 text-cyan-400 hover:border-cyan-500/50'
            }`}
          >
            <Layers className="w-4 h-4" />
            {categoriasCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-cyan-500 text-[9px] font-bold text-slate-950 flex items-center justify-center">
                {categoriasCount}
              </span>
            )}
          </button>

          {openDropdown === 'categorias' && (
            <div className="fixed md:absolute left-20 top-0 w-72 max-h-80 overflow-hidden flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-2.5 z-50 text-slate-100">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold flex items-center gap-1.5 text-cyan-400">
                  <Layers className="w-3.5 h-3.5" /> Categorías
                </span>
                {categoriasCount > 0 && (
                  <button onClick={() => clearFilter('categorias')} className="text-[10px] text-rose-400 hover:underline">
                    Limpiar ({categoriasCount})
                  </button>
                )}
              </div>
              <div className="py-2">
                <input
                  type="text"
                  value={categoriaSearch}
                  onChange={(e) => setCategoriaSearch(e.target.value)}
                  placeholder="Filtrar categoría..."
                  className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-700 bg-slate-800 text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
              <div className="overflow-y-auto max-h-56 space-y-0.5 pr-1">
                {filteredCategorias.map((cat) => {
                  const isChecked = (filters.categorias || []).includes(cat.name);
                  return (
                    <label
                      key={cat.name}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800 text-xs cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCategoria(cat.name)}
                          className="rounded border-slate-600 text-cyan-500 focus:ring-cyan-500"
                        />
                        <span className="truncate">{cat.name}</span>
                      </div>
                      {cat.count > 0 && (
                        <span className="text-[10px] font-mono text-slate-400">{cat.count.toLocaleString()}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Standard Pill button rendering (Horizontal, Vertical, or Expanded Sidebar)
  const isSidebar = layout === 'sidebar';

  return (
    <div
      ref={containerRef}
      className={`relative ${
        isSidebar
          ? 'flex flex-col gap-1.5 w-full'
          : 'flex flex-wrap items-center gap-2'
      } ${className}`}
    >
      {/* 1. Estados Pill Button */}
      <div className={`relative ${isSidebar ? 'w-full' : ''} ${openDropdown === 'estados' ? 'z-40' : 'z-10'}`} data-filter-dropdown>
        <button
          type="button"
          onClick={() => setOpenDropdown(openDropdown === 'estados' ? null : 'estados')}
          className={`flex items-center justify-between gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer ${
            isSidebar ? 'w-full' : ''
          } ${
            estadosCount > 0
              ? 'border-cyan-500 bg-cyan-950/80 text-cyan-300 shadow-sm shadow-cyan-500/20'
              : 'border-slate-700/80 hover:border-cyan-500/60 bg-[#0c1829] dark:bg-[#0c1829] text-slate-200 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="truncate">Estados</span>
            {estadosCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/30 text-cyan-300 text-[10px] font-bold border border-cyan-500/40">
                {estadosCount}
              </span>
            )}
          </div>
          <ChevronDown
            className={`w-3 h-3 text-slate-400 shrink-0 transition-transform ${
              openDropdown === 'estados' ? 'rotate-180 text-cyan-400' : ''
            }`}
          />
        </button>

        {openDropdown === 'estados' && (
          <div
            className={`absolute ${
              isSidebar ? 'left-0 top-full mt-1 w-full sm:w-72' : 'left-0 top-full mt-1.5 w-72'
            } max-h-80 overflow-hidden flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-2.5 z-50 text-slate-100`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold flex items-center gap-1.5 text-cyan-400">
                <MapPin className="w-3.5 h-3.5" /> Filtrar por Estado
              </span>
              {estadosCount > 0 && (
                <button
                  type="button"
                  onClick={() => clearFilter('estados')}
                  className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                >
                  Limpiar ({estadosCount})
                </button>
              )}
            </div>

            <div className="py-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={estadoSearch}
                  onChange={(e) => setEstadoSearch(e.target.value)}
                  placeholder="Buscar estado o región..."
                  className="w-full pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-700 bg-slate-800 text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            <div className="overflow-y-auto max-h-56 space-y-0.5 pr-1 scrollbar-thin">
              {filteredEstados.length > 0 ? (
                filteredEstados.map((est) => {
                  const isChecked = (filters.estados || []).includes(est.name);
                  return (
                    <label
                      key={est.name}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800 text-xs text-slate-200 hover:text-white cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleEstado(est.name)}
                          className="rounded border-slate-600 text-cyan-500 focus:ring-cyan-500"
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
                <div className="py-4 text-center text-xs text-slate-400">No se encontraron estados</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Municipios Pill Button */}
      <div className={`relative ${isSidebar ? 'w-full' : ''} ${openDropdown === 'municipios' ? 'z-40' : 'z-10'}`} data-filter-dropdown>
        <button
          type="button"
          onClick={() => setOpenDropdown(openDropdown === 'municipios' ? null : 'municipios')}
          className={`flex items-center justify-between gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer ${
            isSidebar ? 'w-full' : ''
          } ${
            municipiosCount > 0
              ? 'border-cyan-500 bg-cyan-950/80 text-cyan-300 shadow-sm shadow-cyan-500/20'
              : 'border-slate-700/80 hover:border-cyan-500/60 bg-[#0c1829] dark:bg-[#0c1829] text-slate-200 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="truncate">Municipios</span>
            {municipiosCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/30 text-cyan-300 text-[10px] font-bold border border-cyan-500/40">
                {municipiosCount}
              </span>
            )}
          </div>
          <ChevronDown
            className={`w-3 h-3 text-slate-400 shrink-0 transition-transform ${
              openDropdown === 'municipios' ? 'rotate-180 text-cyan-400' : ''
            }`}
          />
        </button>

        {openDropdown === 'municipios' && (
          <div
            className={`absolute ${
              isSidebar ? 'left-0 top-full mt-1 w-full sm:w-72' : 'left-0 top-full mt-1.5 w-72'
            } max-h-80 overflow-hidden flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-2.5 z-50 text-slate-100`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold flex items-center gap-1.5 text-cyan-400">
                <Compass className="w-3.5 h-3.5" /> Filtrar por Municipio
              </span>
              {municipiosCount > 0 && (
                <button
                  type="button"
                  onClick={() => clearFilter('municipios')}
                  className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                >
                  Limpiar ({municipiosCount})
                </button>
              )}
            </div>

            <div className="py-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={municipioSearch}
                  onChange={(e) => setMunicipioSearch(e.target.value)}
                  placeholder="Buscar municipio..."
                  className="w-full pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-700 bg-slate-800 text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            <div className="overflow-y-auto max-h-56 space-y-0.5 pr-1 scrollbar-thin">
              {filteredMunicipios.length > 0 ? (
                filteredMunicipios.map((mun) => {
                  const isChecked = (filters.municipios || []).includes(mun.name);
                  return (
                    <label
                      key={mun.name}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800 text-xs text-slate-200 hover:text-white cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleMunicipio(mun.name)}
                          className="rounded border-slate-600 text-cyan-500 focus:ring-cyan-500"
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
                <div className="py-4 text-center text-xs text-slate-400">No se encontraron municipios</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Categorías Pill Button */}
      <div className={`relative ${isSidebar ? 'w-full' : ''} ${openDropdown === 'categorias' ? 'z-40' : 'z-10'}`} data-filter-dropdown>
        <button
          type="button"
          onClick={() => setOpenDropdown(openDropdown === 'categorias' ? null : 'categorias')}
          className={`flex items-center justify-between gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer ${
            isSidebar ? 'w-full' : ''
          } ${
            categoriasCount > 0
              ? 'border-cyan-500 bg-cyan-950/80 text-cyan-300 shadow-sm shadow-cyan-500/20'
              : 'border-slate-700/80 hover:border-cyan-500/60 bg-[#0c1829] dark:bg-[#0c1829] text-slate-200 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="truncate">Categorías</span>
            {categoriasCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/30 text-cyan-300 text-[10px] font-bold border border-cyan-500/40">
                {categoriasCount}
              </span>
            )}
          </div>
          <ChevronDown
            className={`w-3 h-3 text-slate-400 shrink-0 transition-transform ${
              openDropdown === 'categorias' ? 'rotate-180 text-cyan-400' : ''
            }`}
          />
        </button>

        {openDropdown === 'categorias' && (
          <div
            className={`absolute ${
              isSidebar
                ? 'left-0 top-full mt-1 w-full sm:w-72'
                : 'right-0 sm:right-0 sm:left-auto top-full mt-1.5 w-72'
            } max-h-80 overflow-hidden flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-2.5 z-50 text-slate-100`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold flex items-center gap-1.5 text-cyan-400">
                <Layers className="w-3.5 h-3.5" /> Filtrar por Categoría
              </span>
              {categoriasCount > 0 && (
                <button
                  type="button"
                  onClick={() => clearFilter('categorias')}
                  className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                >
                  Limpiar ({categoriasCount})
                </button>
              )}
            </div>

            <div className="py-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={categoriaSearch}
                  onChange={(e) => setCategoriaSearch(e.target.value)}
                  placeholder="Buscar categoría..."
                  className="w-full pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-700 bg-slate-800 text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            <div className="overflow-y-auto max-h-56 space-y-0.5 pr-1 scrollbar-thin">
              {filteredCategorias.length > 0 ? (
                filteredCategorias.map((cat) => {
                  const isChecked = (filters.categorias || []).includes(cat.name);
                  return (
                    <label
                      key={cat.name}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800 text-xs text-slate-200 hover:text-white cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCategoria(cat.name)}
                          className="rounded border-slate-600 text-cyan-500 focus:ring-cyan-500"
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
                <div className="py-4 text-center text-xs text-slate-400">No se encontraron categorías</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Optional Quick Clear All if any active */}
      {hasAnyActive && !isSidebar && (
        <button
          type="button"
          onClick={clearAll}
          title="Limpiar filtros de estados, municipios y categorías"
          className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-full text-slate-400 hover:text-rose-400 bg-slate-800/60 hover:bg-rose-950/40 border border-slate-700/60 hover:border-rose-800/60 transition-all cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3 h-3" />
          <span className="text-[11px]">Limpiar</span>
        </button>
      )}
    </div>
  );
};
