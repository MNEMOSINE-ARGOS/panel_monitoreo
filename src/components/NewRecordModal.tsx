import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calificacion, MediaRecord } from '../types';
import { getOperationalTodayDate } from '../utils/dateUtils';
import {
  X,
  PlusCircle,
  Calendar,
  Building2,
  Newspaper,
  UserCheck,
  Link as LinkIcon,
  FileText,
  Smile,
  Meh,
  Frown
} from 'lucide-react';

interface NewRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (record: Omit<MediaRecord, 'id'>) => Promise<void>;
  commonActores: string[];
  commonMedios: string[];
}

export const NewRecordModal: React.FC<NewRecordModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  commonActores,
  commonMedios
}) => {
  const [fecha, setFecha] = useState<string>(getOperationalTodayDate());
  const [medio, setMedio] = useState<string>('');
  const [actor, setActor] = useState<string>('');
  const [calificacion, setCalificacion] = useState<Calificacion>('Positiva');
  const [resumen, setResumen] = useState<string>('');
  const [link, setLink] = useState<string>('');
  const [reportero, setReportero] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medio || !actor || !resumen) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        fecha,
        medio,
        actor,
        calificacion,
        resumen,
        link: link || '#',
        reportero: reportero || 'Redacción Especializada'
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 sm:p-8 overflow-hidden"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Registrar Nueva Mención
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Agrega una nota al repositorio de monitoreo
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Fecha */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-cyan-500" /> Fecha
                </label>
                <input
                  type="date"
                  required
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                />
              </div>

              {/* Calificación */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Calificación (Sentimiento)
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {(['Positiva', 'Neutral', 'Negativa'] as Calificacion[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCalificacion(c)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${
                        calificacion === c
                          ? c === 'Positiva'
                            ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs'
                            : c === 'Negativa'
                            ? 'bg-rose-500 text-white border-rose-500 shadow-xs'
                            : 'bg-slate-600 text-white border-slate-600 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Actor */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-cyan-500" /> Actor / Empresa
                </label>
                <input
                  type="text"
                  required
                  list="actores-list"
                  placeholder="Ej. BBVA México, Pemex..."
                  value={actor}
                  onChange={(e) => setActor(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                />
                <datalist id="actores-list">
                  {commonActores.map(a => <option key={a} value={a} />)}
                </datalist>
              </div>

              {/* Medio */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Newspaper className="w-3.5 h-3.5 text-cyan-500" /> Medio de Comunicación
                </label>
                <input
                  type="text"
                  required
                  list="medios-list"
                  placeholder="Ej. El Economista, Reforma..."
                  value={medio}
                  onChange={(e) => setMedio(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                />
                <datalist id="medios-list">
                  {commonMedios.map(m => <option key={m} value={m} />)}
                </datalist>
              </div>
            </div>

            {/* Reportero & Link */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-cyan-500" /> Periodista / Reportero
                </label>
                <input
                  type="text"
                  placeholder="Ej. Carmen Aristegui, Redacción..."
                  value={reportero}
                  onChange={(e) => setReportero(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-cyan-500" /> Enlace URL de la Nota
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Resumen */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-cyan-500" /> Resumen Ejecutivo / Impacto
              </label>
              <textarea
                required
                rows={3}
                placeholder="Describe el contenido clave de la mención y el contexto reputacional..."
                value={resumen}
                onChange={(e) => setResumen(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
              />
            </div>

            {/* Submit */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Guardando...' : 'Guardar Mención'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
