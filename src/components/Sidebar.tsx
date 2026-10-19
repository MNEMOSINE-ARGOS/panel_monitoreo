import React from 'react';
import { MainNavView } from './Navbar';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  Newspaper,
  Tag,
  Link2,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import { FilterState } from '../types';

interface SidebarProps {
  activeView: MainNavView;
  onSelectView: (view: MainNavView) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  totalRecordsCount: number;
  onSync?: () => void;
  isSyncing?: boolean;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  filters?: FilterState;
}

type Item = {
  id: MainNavView;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  bar: string;
  ink: string;
  /** Estado activo suave (sin fondo oscuro) */
  soft?: boolean;
};

// Cada lectura lleva su color de marca (barra) y su texto de acento legible en claro y oscuro.
const HOME: Item = {
  id: 'monitor', label: 'Panel general', description: 'Vista principal del monitoreo', icon: LayoutDashboard, bar: 'bg-slate-400 dark:bg-slate-500', ink: 'text-slate-600 dark:text-slate-300', soft: true,
};

const TOOLS: Item[] = [
  { id: 'enlace', label: 'Enlace Comparativo', description: 'Crear URL de actores y periodo', icon: Link2, bar: 'bg-argos-teal', ink: 'text-teal-ink dark:text-teal-glow' },
];

const READINGS: Item[] = [
  { id: 'actores', label: 'Actores', description: 'Cobertura y reputación', icon: Users, bar: 'bg-argos-teal', ink: 'text-teal-ink dark:text-teal-glow' },
  { id: 'medios', label: 'Medios', description: 'Línea editorial y cobertura', icon: Newspaper, bar: 'bg-argos-blue', ink: 'text-blue-ink dark:text-blue-glow' },
  { id: 'temas', label: 'Temas', description: 'Agenda pública y coyuntura', icon: Tag, bar: 'bg-argos-gold', ink: 'text-gold-ink dark:text-gold-glow' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  isCollapsed,
  onToggleCollapse,
  onSync,
  isSyncing = false,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { user, logout } = useAuth();

  const handleSelect = (id: MainNavView) => {
    onSelectView(id);
    onCloseMobile?.();
  };

  const card = (item: Item) => {
    const Icon = item.icon;
    const isActive = activeView === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handleSelect(item.id)}
        title={isCollapsed ? item.label : undefined}
        aria-current={isActive ? 'page' : undefined}
        className={`group relative w-full flex items-center gap-3 overflow-hidden rounded-2xl border text-left cursor-pointer transition-[background-color,box-shadow,transform] duration-100 active:scale-[0.985] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:focus-visible:outline-white ${
          isCollapsed ? 'justify-center mx-auto h-12 w-12 p-0' : 'pl-4 pr-3 py-3'
        } ${
          isActive && item.soft
            ? 'bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600'
            : isActive
            ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white shadow-md'
            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm'
        }`}
      >
        <span
          className={`absolute ${isCollapsed ? 'inset-y-2.5 left-1.5 w-1 rounded-full' : 'inset-y-0 left-0 w-1.5'} ${item.bar}`}
          aria-hidden="true"
        />
        <Icon
          className={`h-6 w-6 shrink-0 ${isActive && !item.soft ? 'text-white dark:text-slate-900' : item.ink}`}
          strokeWidth={1.75}
        />
        {!isCollapsed && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold leading-tight">{item.label}</span>
            <span className={`block truncate text-xs mt-0.5 ${isActive && !item.soft ? 'text-slate-300 dark:text-slate-600' : 'text-slate-600 dark:text-slate-400'}`}>
              {item.description}
            </span>
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      {isMobileOpen && (
        <div onClick={onCloseMobile} className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs md:hidden" />
      )}

      <aside
        className={`fixed md:sticky top-14 z-40 h-[calc(100vh-3.5rem)] flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-[width,transform] duration-300 shadow-sm md:shadow-none select-none shrink-0 motion-reduce:transition-none ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${isCollapsed ? 'w-20' : 'w-72'}`}
      >
        <div className="px-3 pt-3 pb-1">
          <button
            type="button"
            onClick={onToggleCollapse}
            id="btn-toggle-sidebar"
            aria-label={isCollapsed ? 'Expandir barra lateral' : 'Minimizar barra lateral'}
            title={isCollapsed ? 'Expandir barra lateral' : 'Minimizar barra lateral'}
            className={`hidden md:flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm cursor-pointer transition-[background-color,box-shadow,transform] duration-100 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:focus-visible:outline-white ${
              isCollapsed ? 'mx-auto h-12 w-12 justify-center' : 'w-full gap-2.5 px-3 py-2.5'
            }`}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-5 w-5" strokeWidth={1.75} />
            ) : (
              <>
                <PanelLeftClose className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                <span>Minimizar</span>
              </>
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5" aria-label="Secciones">
          <div className="space-y-2">
            {card(HOME)}
            <div className="mx-2 border-t border-slate-200 dark:border-slate-800" role="separator" />
            {READINGS.map(card)}
            <div className="mx-2 border-t border-slate-200 dark:border-slate-800" role="separator" />
            {TOOLS.map(card)}
          </div>
        </nav>

        <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 p-3">
          {onSync && (
            <button
              type="button"
              onClick={onSync}
              disabled={isSyncing}
              id="sidebar-btn-sync"
              title="Refrescar datos desde PostgreSQL"
              className={`w-full flex items-center rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-[background-color,transform] duration-100 active:scale-[0.98] cursor-pointer disabled:opacity-60 ${
                isCollapsed ? 'p-2.5 justify-center' : 'px-3 py-2.5 gap-2.5'
              }`}
            >
              <RefreshCw className={`w-4 h-4 shrink-0 text-teal-ink dark:text-teal-glow ${isSyncing ? 'animate-spin' : ''}`} />
              {!isCollapsed && <span className="truncate">{isSyncing ? 'Actualizando…' : 'Refrescar datos'}</span>}
            </button>
          )}

          <div style={{ marginTop: 28 }} className={`flex items-center ${isCollapsed ? 'flex-col gap-2 justify-center' : 'justify-between gap-2'}`}>
            <div
              className={`flex items-center gap-2.5 min-w-0 ${isCollapsed ? 'justify-center' : ''}`}
              title={`${user?.nombre || user?.usuario || 'Usuario'} (rol: ${user?.rol || 'admin'})`}
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-argos-ink text-sm font-semibold text-white">
                {(user?.nombre || user?.usuario || 'U').charAt(0).toUpperCase()}
              </div>
              {!isCollapsed && (
                <div className="min-w-0 text-left">
                  <p className="truncate text-sm font-semibold leading-tight text-slate-900 dark:text-slate-100">
                    {user?.nombre || user?.usuario || 'Usuario'}
                  </p>
                  <p className="text-xs capitalize text-slate-500 dark:text-slate-400">{user?.rol || 'admin'}</p>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={logout}
              id="sidebar-btn-logout"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-900/5 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
