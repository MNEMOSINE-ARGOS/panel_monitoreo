import React, { useState } from 'react';
import { FilterState, KPIStats, MediaRecord } from '../types';
import { generateGlobalMonitorPdf, GlobalReportOptions } from '../utils/generatePdfReport';
import {
  X,
  FileDown,
  FileText,
  Layers,
  CheckCircle2,
  Calendar,
  Users,
  Newspaper,
  Tag,
  Loader2,
  Sparkles,
  BarChart3,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';

interface GlobalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: MediaRecord[];
  stats: KPIStats;
  filters: FilterState;
  totalDatabaseCount: number;
  filteredCount: number;
}

export const GlobalReportModal: React.FC<GlobalReportModalProps> = ({
  isOpen,
  onClose,
  records,
  stats,
  filters,
  totalDatabaseCount,
  filteredCount,
}) => {
  const [reportType, setReportType] = useState<'executive' | 'complete'>('executive');
  const [title, setTitle] = useState('INFORME EJECUTIVO DE MONITOREO GLOBAL');
  const [subtitle, setSubtitle] = useState('Diagnóstico de Cobertura Informativa, Indicadores Reputacionales y Balance Noticioso');
  const [preparedFor, setPreparedFor] = useState('');
  const [notesLimit, setNotesLimit] = useState<number>(25);
  const [includeKpis, setIncludeKpis] = useState(true);
  const [includeBreakdowns, setIncludeBreakdowns] = useState(true);
  const [includeNotesList, setIncludeNotesList] = useState(true);
  const [includeLinks, setIncludeLinks] = useState(true);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationSuccess, setGenerationSuccess] = useState(false);

  if (!isOpen) return null;

  // Active period display
  const periodLabel = filters.dateRange.preset === 'today'
    ? 'Hoy'
    : filters.dateRange.preset === '7d'
    ? 'Últimos 7 días'
    : filters.dateRange.preset === '30d'
    ? 'Últimos 30 días'
    : filters.dateRange.preset === '60d'
    ? 'Últimos 60 días'
    : filters.dateRange.preset === '90d'
    ? 'Últimos 90 días'
    : filters.dateRange.preset === 'all'
    ? 'Histórico Completo'
    : `${filters.dateRange.start || 'Inicio'} al ${filters.dateRange.end || 'Hoy'}`;

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      setGenerationSuccess(false);

      const options: GlobalReportOptions = {
        title,
        subtitle,
        preparedFor: preparedFor.trim() || undefined,
        reportType,
        notesLimit: reportType === 'executive' ? Math.min(notesLimit, 10) : notesLimit,
        includeKpis,
        includeBreakdowns,
        includeNotesList,
        includeLinks,
      };

      // Generate the PDF
      await generateGlobalMonitorPdf(records, stats, filters, options);

      setGenerationSuccess(true);
      setTimeout(() => {
        setGenerationSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Error generating Global Monitor PDF:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const netScore = stats.netSentimentScore;
  const isNetPos = netScore > 0;
  const isNetNeg = netScore < 0;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Generar Reporte PDF del Monitor Global
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Exporta un informe ejecutivo consolidado con métricas reputacionales y cobertura filtrada
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {/* Active Dataset Scope Preview Banner */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-500" />
                Muestra activa:
              </span>
              <span className="font-bold text-cyan-600 dark:text-cyan-400">
                {records.length.toLocaleString()} notas
              </span>
              <span className="text-slate-400">de {filteredCount.toLocaleString()} encontradas</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-cyan-500" />
                {periodLabel}
              </span>

              <span
                className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                  isNetPos
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : isNetNeg
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                    : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/30'
                }`}
              >
                NSS: {netScore > 0 ? '+' : ''}{netScore}%
              </span>
            </div>

            {/* Filter chips summary */}
            {(filters.actores.length > 0 || filters.medios.length > 0 || filters.temas.length > 0 || (filters.estados && filters.estados.length > 0)) && (
              <div className="w-full pt-2 mt-1 border-t border-slate-200 dark:border-slate-700/60 flex flex-wrap gap-1.5 text-[11px]">
                {filters.actores.length > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 font-medium">
                    Actores: {filters.actores.join(', ')}
                  </span>
                )}
                {filters.medios.length > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 font-medium">
                    Medios: {filters.medios.length === 1 ? filters.medios[0] : `${filters.medios.length} seleccionados`}
                  </span>
                )}
                {filters.temas.length > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 font-medium">
                    Temas: {filters.temas.length === 1 ? filters.temas[0] : `${filters.temas.length} seleccionados`}
                  </span>
                )}
                {filters.estados && filters.estados.length > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium">
                    Estado: {filters.estados.join(', ')}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Format Selector: Executive vs Complete Dossier */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
              Tipo de Informe PDF
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Executive Brief */}
              <div
                onClick={() => setReportType('executive')}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  reportType === 'executive'
                    ? 'border-cyan-500 bg-cyan-500/5 dark:bg-cyan-500/10 ring-1 ring-cyan-500/30'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${reportType === 'executive' ? 'bg-cyan-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                      <FileText className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-sm text-slate-900 dark:text-white">Resumen Ejecutivo</span>
                  </div>
                  {reportType === 'executive' && <CheckCircle2 className="w-4 h-4 text-cyan-500" />}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Conciso (2-3 páginas). Tablero de KPIs, balance reputacional (NSS), radiografía de top actores/medios y 10 notas clave. Ideal para directivos y juntas.
                </p>
              </div>

              {/* Option 2: Complete Dossier */}
              <div
                onClick={() => setReportType('complete')}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  reportType === 'complete'
                    ? 'border-cyan-500 bg-cyan-500/5 dark:bg-cyan-500/10 ring-1 ring-cyan-500/30'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${reportType === 'complete' ? 'bg-cyan-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                      <Layers className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-sm text-slate-900 dark:text-white">Dossier Completo</span>
                  </div>
                  {reportType === 'complete' && <CheckCircle2 className="w-4 h-4 text-cyan-500" />}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Multipágina detallado. Incluye el diagnóstico estratégico más el catálogo completo de notas monitoreadas con síntesis, autores y enlaces a fuentes.
                </p>
              </div>
            </div>
          </div>

          {/* Customization Details */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Título del Informe
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="Ej. INFORME EJECUTIVO DE MONITOREO GLOBAL"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Destinatario / Dirigido a (Opcional)
                </label>
                <input
                  type="text"
                  value={preparedFor}
                  onChange={(e) => setPreparedFor(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Ej. Dirección General / Sala de Situación"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notas a Incluir en el Catálogo
                </label>
                <select
                  value={notesLimit}
                  onChange={(e) => setNotesLimit(Number(e.target.value))}
                  disabled={reportType === 'executive'}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-60 cursor-pointer"
                >
                  <option value={10}>Top 10 notas destacadas</option>
                  <option value={25}>Top 25 notas más relevantes</option>
                  <option value={50}>Top 50 notas</option>
                  <option value={100}>Hasta 100 notas (completo)</option>
                </select>
                {reportType === 'executive' && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    * El resumen ejecutivo se limita automáticamente a las 10 notas clave.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section Inclusions Checkboxes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Secciones del Documento
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeKpis}
                  onChange={(e) => setIncludeKpis(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 border-slate-300"
                />
                <span>Tablero de KPIs & Balance Neto (NSS)</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeBreakdowns}
                  onChange={(e) => setIncludeBreakdowns(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 border-slate-300"
                />
                <span>Top Actores, Medios & Temas</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeNotesList}
                  onChange={(e) => setIncludeNotesList(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 border-slate-300"
                />
                <span>Catálogo de Cobertura de Notas</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeLinks}
                  onChange={(e) => setIncludeLinks(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 border-slate-300"
                />
                <span>Enlaces a Fuentes Originales (Botón interactivo "Ver nota")</span>
              </label>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs shadow-md shadow-cyan-500/20 disabled:opacity-60 transition-all cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generando Informe PDF...</span>
              </>
            ) : generationSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>¡Reporte Descargado!</span>
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4" />
                <span>Descargar Reporte PDF</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
