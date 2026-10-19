import React, { useEffect, useState } from 'react';
import { MediaRecord } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ExternalLink,
  Copy,
  Check,
  Building2,
  Newspaper,
  Calendar,
  UserCheck,
  Tag,
  MapPin,
  Smile,
  Meh,
  Frown,
  ShieldCheck,
  Users,
  Layers,
  FileDown,
  Loader2
} from 'lucide-react';
import { generateRecordPdf } from '../utils/generatePdfReport';
import { getTemaMetadata } from '../data/temasCatalogo';
import { repository } from '../services/repository';

interface RecordModalProps {
  record: MediaRecord | null;
  onClose: () => void;
}

export const RecordModal: React.FC<RecordModalProps> = ({ record: listRecord, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [detail, setDetail] = useState<{ id: string; contexto?: string; fragmento?: string } | null>(null);

  // The listing omits Contexto/Fragmento: load them when a record is opened
  useEffect(() => {
    if (!listRecord || listRecord.contexto !== undefined) return;
    let cancelled = false;
    repository.getRecordDetails([listRecord.id]).then((d) => {
      if (!cancelled && d[listRecord.id]) setDetail({ id: listRecord.id, ...d[listRecord.id] });
    });
    return () => {
      cancelled = true;
    };
  }, [listRecord?.id]);

  if (!listRecord) return null;
  const record = detail && detail.id === listRecord.id ? { ...listRecord, ...detail } : listRecord;

  const handleDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      await generateRecordPdf(record);
    } catch (err) {
      console.error('Error generating PDF report:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleCopy = () => {
    const text = `
📌 [MONITOREO DE MEDIOS - REGISTRO #${record.id}]
Fecha: ${record.fecha}
Medio: ${record.medio}
Actor: ${record.actor}
Tema: ${record.tema || record.categoria || 'N/A'}
Calificación: ${record.calificacion}
Reportero: ${record.reportero}
Dependencia: ${record.dependencia || 'N/A'}
Región / Estado: ${record.region || record.estado || 'N/A'}

Titular:
${record.titulo || record.resumen}

Resumen Ejecutivo:
${record.resumen}

${record.contexto ? `Contexto:\n${record.contexto}\n` : ''}
${record.link && record.link !== '#' ? `Enlace: ${record.link}` : ''}
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSentimentPill = () => {
    const cal = (record.calificacion || '').toLowerCase();
    if (cal.includes('positiv')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
          <Smile className="w-4 h-4" /> Calificación Positiva
        </span>
      );
    }
    if (cal.includes('negativ')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
          <Frown className="w-4 h-4" /> Calificación Negativa
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-500/10 text-slate-600 dark:text-slate-300 border border-slate-500/30">
        <Meh className="w-4 h-4" /> Calificación Neutral
      </span>
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 sm:p-8 space-y-6"
        >
          {/* Header Close */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              {getSentimentPill()}
              <span className="text-xs font-mono text-slate-400">ID: #{record.id}</span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                <ShieldCheck className="w-3 h-3" /> PostgreSQL
              </span>
            </div>
            <button
              onClick={onClose}
              id="btn-close-record-modal"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Title & Core Summary */}
          <div className="space-y-3">
            {record.titulo && (
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-snug">
                {record.titulo}
              </h3>
            )}
            <div>
              <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider block mb-1">
                Resumen de Monitoreo
              </span>
              <p className="text-sm sm:text-base text-slate-800 dark:text-slate-200 leading-relaxed">
                {record.resumen}
              </p>
            </div>
          </div>

          {/* Core 3-Way Perspective Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. Actor */}
            <div className="p-3.5 rounded-xl bg-cyan-50/70 dark:bg-cyan-950/30 border border-cyan-200/60 dark:border-cyan-800/40">
              <span className="text-[11px] font-semibold text-cyan-700 dark:text-cyan-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                <Building2 className="w-3.5 h-3.5" /> 1. Actor
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-white block truncate">
                {record.actor || 'Sin actor'}
              </span>
            </div>

            {/* 2. Medio */}
            <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40">
              <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                <Newspaper className="w-3.5 h-3.5" /> 2. Medio
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-white block truncate">
                {record.medio || 'N/A'}
              </span>
            </div>

            {/* 3. Tema & Categorías */}
            {(() => {
              const meta = getTemaMetadata(record.tema || '');
              const catPrimaria = record.categoria || meta?.categoria;
              const catSecundaria = record.categoriaSecundaria || meta?.categoria_secundaria;

              return (
                <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                      <Tag className="w-3.5 h-3.5" /> 3. Tema
                    </span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white block truncate">
                      {record.tema || catPrimaria || 'N/A'}
                    </span>
                  </div>
                  {(catPrimaria || catSecundaria) && (
                    <div className="mt-2 pt-2 border-t border-amber-200/50 dark:border-amber-800/40 flex flex-col gap-1 text-[10px]">
                      {catPrimaria && (
                        <div className="text-slate-600 dark:text-slate-300 truncate">
                          <strong className="text-cyan-700 dark:text-cyan-400">Cat. Princ:</strong> {catPrimaria}
                        </div>
                      )}
                      {catSecundaria && (
                        <div className="text-slate-600 dark:text-slate-300 truncate">
                          <strong className="text-amber-700 dark:text-amber-400">Cat. Sec:</strong> {catSecundaria}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Secondary Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 text-xs">
            <div>
              <span className="text-slate-400 flex items-center gap-1 mb-1">
                <Calendar className="w-3.5 h-3.5 text-cyan-500" /> Fecha
              </span>
              <span className="font-bold text-slate-900 dark:text-white font-mono block">
                {record.fecha}
              </span>
            </div>

            <div>
              <span className="text-slate-400 flex items-center gap-1 mb-1">
                <UserCheck className="w-3.5 h-3.5 text-cyan-500" /> Reportero
              </span>
              <span className="font-bold text-slate-900 dark:text-white truncate block">
                {record.reportero || 'Redacción'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 flex items-center gap-1 mb-1">
                <MapPin className="w-3.5 h-3.5 text-cyan-500" /> Región / Estado
              </span>
              <span className="font-bold text-slate-900 dark:text-white truncate block">
                {record.region || record.estado || 'Estatal'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 flex items-center gap-1 mb-1">
                <Layers className="w-3.5 h-3.5 text-cyan-500" /> Dependencia
              </span>
              <span className="font-bold text-slate-900 dark:text-white truncate block">
                {record.dependencia || 'No especificada'}
              </span>
            </div>
          </div>

          {/* Contexto & Personajes if available */}
          {(record.contexto || record.personajes || record.instituciones) && (
            <div className="space-y-3 p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-700/50 text-xs">
              {record.contexto && (
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Contexto Noticioso:
                  </span>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    {record.contexto}
                  </p>
                </div>
              )}
              {record.personajes && (
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                    Personajes Citados:
                  </span>
                  <p className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                    {record.personajes}
                  </p>
                </div>
              )}
              {record.instituciones && (
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                    Instituciones:
                  </span>
                  <p className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                    {record.instituciones}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Link Preview */}
          {record.link && record.link !== '#' && (
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-between gap-3">
              <div className="truncate text-xs font-mono text-slate-500 dark:text-slate-400">
                {record.link}
              </div>
              <a
                href={record.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shrink-0 transition-all shadow-xs"
              >
                <span>Abrir Nota Original</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                id="btn-download-pdf-report"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-600/60 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                title="Descargar reporte oficial en formato PDF"
              >
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Generando PDF...</span>
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" />
                    <span>Generar Reporte PDF</span>
                  </>
                )}
              </button>

              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span>Copiado al portapapeles</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar Ficha</span>
                  </>
                )}
              </button>
            </div>

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold transition-all cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
