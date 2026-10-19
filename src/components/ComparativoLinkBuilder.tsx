import React, { useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Search, X } from 'lucide-react';

// Arma la URL pública del comparativo: /comparativo?actores=A|B&periodo=30
// (mismas reglas que /api/postgres/comparativo: 2 a 4 actores, periodo 7 | 30 | 90).

const MIN_ACTORES = 2;
const MAX_ACTORES = 4;
const PERIODOS = [
  { dias: 7, label: '7 días' },
  { dias: 30, label: '30 días' },
  { dias: 90, label: '90 días' },
];

interface Props {
  availableActores: Array<string | { name: string; count?: number }>;
}

export const ComparativoLinkBuilder: React.FC<Props> = ({ availableActores }) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [periodo, setPeriodo] = useState(30);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  const options = useMemo(
    () => availableActores
      .map(a => (typeof a === 'string' ? { name: a, count: undefined as number | undefined } : a))
      .filter(a => a.name && a.name !== 'Sin actor'),
    [availableActores]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (q ? options.filter(o => o.name.toLowerCase().includes(q)) : options).slice(0, 100);
  }, [options, search]);

  const valid = selected.length >= MIN_ACTORES && selected.length <= MAX_ACTORES;
  const url = useMemo(() => {
    if (!valid) return '';
    const qs = `actores=${selected.map(encodeURIComponent).join('|')}&periodo=${periodo}`;
    return `${window.location.origin}/comparativo?${qs}`;
  }, [selected, periodo, valid]);

  const toggle = (name: string) => {
    setCopied(false);
    setSelected(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : prev.length >= MAX_ACTORES ? prev : [...prev, name]
    );
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const card = 'rounded-3xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-sm';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Enlace Comparativo</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Elige de {MIN_ACTORES} a {MAX_ACTORES} actores y el periodo para generar un enlace público al comparativo.
        </p>
      </div>

      <section className={`${card} space-y-4`}>
        <h2 className="text-base font-bold">1. Actores ({selected.length}/{MAX_ACTORES})</h2>

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selected.map(n => (
              <button key={n} type="button" onClick={() => toggle(n)}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-1 text-xs font-semibold cursor-pointer">
                {n}<X className="h-3.5 w-3.5" aria-label="Quitar" />
              </button>
            ))}
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar actor…"
            className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-sm"
          />
        </div>

        <ul className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
          {filtered.length === 0 && <li className="px-3 py-4 text-sm text-slate-500">Sin resultados.</li>}
          {filtered.map(o => {
            const on = selected.includes(o.name);
            const disabled = !on && selected.length >= MAX_ACTORES;
            return (
              <li key={o.name}>
                <label className={`flex items-center gap-3 px-3 py-2 text-sm ${disabled ? 'opacity-40' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                  <input type="checkbox" checked={on} disabled={disabled} onChange={() => toggle(o.name)} />
                  <span className="flex-1 truncate">{o.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={`${card} space-y-3`}>
        <h2 className="text-base font-bold">2. Periodo</h2>
        <div className="flex gap-2" role="radiogroup" aria-label="Periodo">
          {PERIODOS.map(p => (
            <button key={p.dias} type="button" role="radio" aria-checked={periodo === p.dias}
              onClick={() => { setPeriodo(p.dias); setCopied(false); }}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold cursor-pointer ${
                periodo === p.dias
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                  : 'border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <section className={`${card} space-y-3`}>
        <h2 className="text-base font-bold">3. Enlace</h2>
        <textarea
          readOnly
          rows={3}
          value={url}
          placeholder={`Selecciona al menos ${MIN_ACTORES} actores para generar el enlace.`}
          onFocus={e => e.currentTarget.select()}
          className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 p-3 text-xs font-mono break-all"
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copy} disabled={!valid}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2 text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copiado' : 'Copiar enlace'}
          </button>
          <a href={valid ? url : undefined} target="_blank" rel="noreferrer" aria-disabled={!valid}
            className={`inline-flex items-center gap-2 rounded-full border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-semibold ${valid ? '' : 'opacity-50 pointer-events-none'}`}>
            <ExternalLink className="h-4 w-4" />Abrir
          </a>
        </div>
      </section>
    </div>
  );
};
