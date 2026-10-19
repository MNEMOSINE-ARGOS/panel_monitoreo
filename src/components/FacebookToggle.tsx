import React from 'react';

interface FacebookToggleProps {
  active: boolean;
  onToggle: () => void;
}

/** Interruptor global de fuente: apagado = tabla monitoreo, encendido = monitoreo_total (incluye Facebook). */
export const FacebookToggle: React.FC<FacebookToggleProps> = ({ active, onToggle }) => (
  <button
    type="button"
    role="switch"
    aria-checked={active}
    onClick={onToggle}
    title={active ? 'Mostrando datos con Facebook (monitoreo_total)' : 'Mostrando datos sin Facebook (monitoreo)'}
    className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-[background-color,transform] duration-100 active:scale-[0.97] cursor-pointer ${
      active
        ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-500'
        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700'
    }`}
  >
    <span className={`h-2 w-2 rounded-full ${active ? 'bg-white' : 'bg-slate-400'}`} />
    <span>Incluir Facebook</span>
  </button>
);
