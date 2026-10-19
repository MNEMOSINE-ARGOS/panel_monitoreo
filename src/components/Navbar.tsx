import React from 'react';
import { useTheme } from '../context/ThemeContext';
import ArgosLogo from './ArgosLogo';
import { Sun, Moon, Menu } from 'lucide-react';

export type MainNavView = 'monitor' | 'actores' | 'medios' | 'temas' | 'enlace';

interface NavbarProps {
  activeView: MainNavView;
  onSelectView: (view: MainNavView) => void;
  onToggleSidebar?: () => void;
}

const VIEW_TITLES: Record<MainNavView, string> = {
  monitor: 'Monitor global',
  actores: 'Actores',
  medios: 'Medios de comunicación',
  temas: 'Temas y agenda pública',
  enlace: 'Enlace Comparativo',
};

const ghostButton =
  'grid h-9 w-9 place-items-center rounded-full text-slate-500 dark:text-slate-400 ' +
  'hover:bg-slate-900/5 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white ' +
  'transition-[background-color,color,transform] duration-100 active:scale-95 cursor-pointer ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A5A5]';

export const Navbar: React.FC<NavbarProps> = ({ activeView, onSelectView, onToggleSidebar }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <header className="material-bar sticky top-0 z-50 w-full border-b border-slate-200/60 dark:border-slate-800/60 select-none">
      <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              id="btn-sidebar-toggle-top"
              aria-label="Mostrar u ocultar la barra lateral"
              title="Mostrar / ocultar barra lateral"
              className={ghostButton}
            >
              <Menu className="h-[18px] w-[18px]" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onSelectView('monitor')}
            title="Volver al Monitor global"
            className="rounded-lg px-1.5 py-1 cursor-pointer transition-transform duration-100 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A5A5]"
          >
            <ArgosLogo className="h-6" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-sm font-semibold text-slate-500 dark:text-slate-400" aria-live="polite">
            {VIEW_TITLES[activeView]}
          </span>
          <button
            type="button"
            onClick={toggleTheme}
            id="btn-theme-toggle-nav"
            aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title={isDark ? 'Modo claro' : 'Modo oscuro'}
            className={ghostButton}
          >
            {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </div>
    </header>
  );
};
