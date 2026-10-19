import React from 'react';
import { CheckCircle2, AlertCircle, XCircle, X } from 'lucide-react';

export type StatusToastKind = 'loading' | 'success' | 'warning' | 'error';

interface StatusToastProps {
  kind: StatusToastKind;
  title: string;
  detail?: string;
  onClose?: () => void;
}

const ICON_RING: Record<StatusToastKind, string> = {
  loading: 'text-blue-ink dark:text-blue-glow',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  error: 'text-rose-600 dark:text-rose-400',
};

export const StatusToast: React.FC<StatusToastProps> = ({ kind, title, detail, onClose }) => (
  <div className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex justify-center px-4">
    {/* key por tipo: al pasar de spinner a check se reanima la entrada */}
    <div
      key={kind}
      role="status"
      aria-live="polite"
      className="status-pill pointer-events-auto flex max-w-full items-center gap-3 rounded-full border border-white/60 dark:border-white/10 bg-white/75 dark:bg-slate-900/75 py-2 pl-2.5 pr-4 shadow-[0_8px_32px_-8px_rgba(15,23,42,0.28)] backdrop-blur-xl backdrop-saturate-150"
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900/[0.05] dark:bg-white/10 ${ICON_RING[kind]}`}>
        {kind === 'loading' && (
          <svg className="status-spinner h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ animationDuration: '0.8s' }}>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}
        {kind === 'success' && <CheckCircle2 className="status-check h-5 w-5" strokeWidth={2.2} aria-hidden="true" />}
        {kind === 'warning' && <AlertCircle className="status-check h-5 w-5" strokeWidth={2.2} aria-hidden="true" />}
        {kind === 'error' && <XCircle className="status-check h-5 w-5" strokeWidth={2.2} aria-hidden="true" />}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[13px] font-semibold tracking-[-0.01em] text-slate-900 dark:text-white">{title}</span>
        {detail && (
          <span className="block truncate text-xs tracking-[0.005em] text-slate-600 dark:text-slate-300">{detail}</span>
        )}
      </span>
      {onClose && kind !== 'loading' && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar aviso"
          className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-500 transition-[background-color,transform] duration-100 hover:bg-slate-900/[0.06] dark:hover:bg-white/10 active:scale-90 cursor-pointer"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  </div>
);
