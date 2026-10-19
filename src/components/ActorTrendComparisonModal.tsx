import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { MediaRecord, FilterOptionItem, FilterState } from '../types';
import { repository } from '../services/repository';
import { useTheme } from '../context/ThemeContext';
import { getOperationalTodayDate } from '../utils/dateUtils';
import {
  Scale,
  X,
  Maximize2,
  Minimize2,
  Calendar,
  Layers,
  TrendingUp,
  Activity,
  Award,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Info,
  Plus,
  Search,
  Mail,
  Send,
  Share2,
  Check,
  CheckCircle2,
  Loader2,
  Sparkles,
  Users,
  RotateCcw
} from 'lucide-react';
import { generateActorComparisonPdf } from '../utils/generatePdfReport';

interface ActorTrendComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: MediaRecord[];
  actores: string[];
  allAvailableActores?: Array<string | FilterOptionItem>;
  onUpdateActores?: (newActores: string[]) => void;
  dateRange?: FilterState['dateRange'];
  filters?: FilterState;
}

const ACTOR_PALETTE = [
  '#06B6D4', // Cyan
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#E11D48', // Rose
  '#6366F1'  // Indigo
];

export const ActorTrendComparisonModal: React.FC<ActorTrendComparisonModalProps> = ({
  isOpen,
  onClose,
  records,
  actores,
  allAvailableActores = [],
  onUpdateActores,
  dateRange,
  filters
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [metric, setMetric] = useState<'net' | 'positive' | 'negative' | 'volume'>('net');
  const [showVolumeBars, setShowVolumeBars] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'chart' | 'matrix'>('chart');

  // Dynamic actor list editable inside this window
  const [selectedActoresList, setSelectedActoresList] = useState<string[]>(actores);
  const [isAddActorOpen, setIsAddActorOpen] = useState<boolean>(false);
  const [searchActorQuery, setSearchActorQuery] = useState<string>('');
  const addActorDropdownRef = useRef<HTMLDivElement>(null);

  // Additional records fetched directly for actors added inside this window
  const [extraActorRecords, setExtraActorRecords] = useState<MediaRecord[]>([]);
  const [fetchingActors, setFetchingActors] = useState<Record<string, boolean>>({});
  const attemptedFetchRef = useRef<Set<string>>(new Set());

  // PDF & Email States
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState<boolean>(false);
  const [emailRecipient, setEmailRecipient] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailMessage, setEmailMessage] = useState<string>('');
  const [emailFeedback, setEmailFeedback] = useState<string | null>(null);
  const [isSyncSuccess, setIsSyncSuccess] = useState<boolean>(false);

  // Sync internal actor list whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      if (actores.length > 0) {
        setSelectedActoresList((prev) => {
          const union = Array.from(new Set([...actores, ...prev])).filter(
            (a) => a && a.trim() && a.toLowerCase() !== 'sin actor'
          );
          return union.length > 0 ? union : actores;
        });
      }
      setIsAddActorOpen(false);
      setSearchActorQuery('');
      setEmailFeedback(null);
    }
  }, [isOpen, actores]);

  // Combine parent records with extra fetched records for actors added dynamically
  const effectiveRecords = useMemo(() => {
    const map = new Map<string, MediaRecord>();
    records.forEach((r) => {
      if (r && r.id) map.set(r.id, r);
    });
    extraActorRecords.forEach((r) => {
      if (r && r.id) map.set(r.id, r);
    });
    return Array.from(map.values());
  }, [records, extraActorRecords]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        addActorDropdownRef.current &&
        !addActorDropdownRef.current.contains(event.target as Node)
      ) {
        setIsAddActorOpen(false);
      }
    };
    if (isAddActorOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAddActorOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (isEmailModalOpen) {
          setIsEmailModalOpen(false);
        } else if (isAddActorOpen) {
          setIsAddActorOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isEmailModalOpen, isAddActorOpen]);

  // Clean active actors list
  const cleanActores = useMemo(() => {
    return selectedActoresList.filter((a) => a && a.trim() && a.toLowerCase() !== 'sin actor');
  }, [selectedActoresList]);

  // Fetch records for an actor specifically so their timeline and stats show up immediately
  const fetchRecordsForActor = useCallback(
    async (actorName: string) => {
      if (!actorName || !actorName.trim() || actorName.toLowerCase() === 'sin actor') return;
      const cleanName = actorName.trim();
      setFetchingActors((prev) => ({ ...prev, [cleanName]: true }));

      try {
        const queryFilters: Partial<FilterState> = {
          ...filters,
          actores: [cleanName],
          dateRange: dateRange || filters?.dateRange
        };
        const res = await repository.queryRecords(queryFilters, 1000, 0);
        if (res && res.records && res.records.length > 0) {
          setExtraActorRecords((prev) => {
            const existingIds = new Set(prev.map((r) => r.id));
            const newRecords = res.records.filter((r) => !existingIds.has(r.id));
            return newRecords.length > 0 ? [...prev, ...newRecords] : prev;
          });
        }
      } catch (err) {
        console.error(`Error fetching records for actor "${cleanName}":`, err);
      } finally {
        setFetchingActors((prev) => ({ ...prev, [cleanName]: false }));
      }
    },
    [filters, dateRange]
  );

  // Auto-fetch for any active actor that doesn't have records in the current set
  useEffect(() => {
    if (!isOpen) return;

    cleanActores.forEach((actor) => {
      const clean = actor.trim().toLowerCase();
      const existingCount = effectiveRecords.filter(
        (r) => (r.actor || '').trim().toLowerCase() === clean
      ).length;

      if (
        existingCount === 0 &&
        !fetchingActors[actor.trim()] &&
        !attemptedFetchRef.current.has(clean)
      ) {
        attemptedFetchRef.current.add(clean);
        fetchRecordsForActor(actor);
      }
    });
  }, [isOpen, cleanActores, effectiveRecords, fetchRecordsForActor, fetchingActors]);

  // Extract all available actors from options and records
  const availableActorsPool = useMemo(() => {
    const countMap = new Map<string, number>();

    // 1. From records & effectiveRecords
    effectiveRecords.forEach((r) => {
      const act = r.actor ? r.actor.trim() : '';
      if (act && act.toLowerCase() !== 'sin actor') {
        countMap.set(act, (countMap.get(act) || 0) + 1);
      }
    });

    // 2. From allAvailableActores prop
    if (allAvailableActores && allAvailableActores.length > 0) {
      allAvailableActores.forEach((item) => {
        const name = typeof item === 'string' ? item.trim() : item.name.trim();
        const count = typeof item === 'string' ? 0 : item.count;
        if (name && name.toLowerCase() !== 'sin actor') {
          countMap.set(name, Math.max(countMap.get(name) || 0, count));
        }
      });
    }

    return Array.from(countMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [allAvailableActores, effectiveRecords]);

  // Filtered available actors not yet selected
  const unselectedActors = useMemo(() => {
    const q = searchActorQuery.toLowerCase().trim();
    return availableActorsPool.filter((a) => {
      const isAlready = cleanActores.some(
        (selected) => selected.toLowerCase() === a.name.toLowerCase()
      );
      if (isAlready) return false;
      if (!q) return true;
      return a.name.toLowerCase().includes(q);
    });
  }, [availableActorsPool, cleanActores, searchActorQuery]);

  // Add actor handler: updates local list, initiates immediate record fetch, and syncs parent
  const handleAddActor = (actorName: string) => {
    if (!actorName || cleanActores.some((a) => a.toLowerCase() === actorName.toLowerCase())) return;
    const nextActores = [...cleanActores, actorName];
    setSelectedActoresList(nextActores);
    setSearchActorQuery('');
    setIsAddActorOpen(false);

    // Immediately fetch records for this actor
    fetchRecordsForActor(actorName);

    // Also update parent so main filters stay synchronized
    if (onUpdateActores) {
      onUpdateActores(nextActores);
    }
  };

  // Remove actor handler
  const handleRemoveActor = (actorName: string) => {
    if (cleanActores.length <= 1) return; // keep at least 1 actor
    const nextActores = cleanActores.filter(
      (a) => a.toLowerCase() !== actorName.toLowerCase()
    );
    setSelectedActoresList(nextActores);
    if (onUpdateActores) {
      onUpdateActores(nextActores);
    }
  };

  // Sync back to main dashboard filter
  const handleSyncFilters = () => {
    if (onUpdateActores) {
      onUpdateActores(cleanActores);
      setIsSyncSuccess(true);
      setTimeout(() => setIsSyncSuccess(false), 2500);
    }
  };

  // Today identification
  const todayISO = getOperationalTodayDate();
  const localToday = todayISO;

  // Executive summary per actor (purely reactive to cleanActores and effectiveRecords)
  const actorsSummary = useMemo(() => {
    return cleanActores.map((actor, idx) => {
      const color = ACTOR_PALETTE[idx % ACTOR_PALETTE.length];
      const clean = actor.trim().toLowerCase();
      const actorNotes = effectiveRecords.filter(
        (r) => (r.actor || '').trim().toLowerCase() === clean
      );
      const total = actorNotes.length;

      let pos = 0;
      let neu = 0;
      let neg = 0;
      const dailyCounts: Record<string, number> = {};

      actorNotes.forEach((r) => {
        if (r.calificacion === 'Positiva') pos++;
        else if (r.calificacion === 'Negativa') neg++;
        else neu++;

        const f = r.fecha ? r.fecha.trim() : '';
        if (f && f !== 'Sin fecha') {
          dailyCounts[f] = (dailyCounts[f] || 0) + 1;
        }
      });

      const posPct = total > 0 ? Number(((pos / total) * 100).toFixed(1)) : 0;
      const neuPct = total > 0 ? Number(((neu / total) * 100).toFixed(1)) : 0;
      const negPct = total > 0 ? Number(((neg / total) * 100).toFixed(1)) : 0;
      const netSentiment = Number((posPct - negPct).toFixed(1));

      // Peak date
      let peakDate = '-';
      let peakVol = 0;
      Object.entries(dailyCounts).forEach(([d, v]) => {
        if (v > peakVol) {
          peakVol = v;
          peakDate = d;
        }
      });

      return {
        actor,
        color,
        total,
        pos,
        neu,
        neg,
        posPct,
        neuPct,
        negPct,
        netSentiment,
        peakDate,
        peakVol,
        isFetching: Boolean(fetchingActors[actor.trim()])
      };
    });
  }, [cleanActores, effectiveRecords, fetchingActors]);

  // Daily unified timeline for comparative graph & matrix
  const comparativeTimeline = useMemo(() => {
    if (cleanActores.length === 0) return [];

    const dateActorMap: Record<
      string,
      Record<string, { Positivas: number; Neutrales: number; Negativas: number; total: number }>
    > = {};

    effectiveRecords.forEach((r) => {
      const f = r.fecha ? r.fecha.trim() : '';
      if (!f || f === 'Sin fecha') return;
      const rActor = (r.actor || '').trim().toLowerCase();
      const matchedActor = cleanActores.find((a) => a.trim().toLowerCase() === rActor);
      if (!matchedActor) return;

      if (!dateActorMap[f]) {
        dateActorMap[f] = {};
        cleanActores.forEach((a) => {
          dateActorMap[f][a] = { Positivas: 0, Neutrales: 0, Negativas: 0, total: 0 };
        });
      }

      if (!dateActorMap[f][matchedActor]) {
        dateActorMap[f][matchedActor] = { Positivas: 0, Neutrales: 0, Negativas: 0, total: 0 };
      }

      if (r.calificacion === 'Positiva') dateActorMap[f][matchedActor].Positivas += 1;
      else if (r.calificacion === 'Negativa') dateActorMap[f][matchedActor].Negativas += 1;
      else dateActorMap[f][matchedActor].Neutrales += 1;
      dateActorMap[f][matchedActor].total += 1;
    });

    const sortedDates = Object.keys(dateActorMap).sort((a, b) => a.localeCompare(b));
    const lastDate = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : '';

    return sortedDates.map((f) => {
      const isToday =
        f === todayISO ||
        f === localToday ||
        (f === lastDate && lastDate >= localToday);
      const parts = f.split('-');
      const shortFecha = parts.length === 3 ? `${parts[2]}/${parts[1]}` : f;
      let displayFecha = f;
      if (parts.length === 3) {
        const d = new Date(`${f}T12:00:00`);
        if (!isNaN(d.getTime())) {
          displayFecha = d.toLocaleDateString('es-MX', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          });
        }
      }

      const point: any = {
        fecha: f,
        displayFecha,
        shortFecha,
        isToday,
        totalCombined: 0,
        actorStats: {}
      };

      cleanActores.forEach((actor, idx) => {
        const s = dateActorMap[f]?.[actor] || { Positivas: 0, Neutrales: 0, Negativas: 0, total: 0 };
        const tot = s.total;
        point.totalCombined += tot;
        const posPct = tot > 0 ? Number(((s.Positivas / tot) * 100).toFixed(1)) : 0;
        const neuPct = tot > 0 ? Number(((s.Neutrales / tot) * 100).toFixed(1)) : 0;
        const negPct = tot > 0 ? Number(((s.Negativas / tot) * 100).toFixed(1)) : 0;
        const netSentiment = Number((posPct - negPct).toFixed(1));

        point.actorStats[actor] = {
          Positivas: s.Positivas,
          Neutrales: s.Neutrales,
          Negativas: s.Negativas,
          total: tot,
          posPct,
          neuPct,
          negPct,
          netSentiment
        };

        // Keys for Recharts lines & side-by-side bars (NEVER stacked)
        point[`vol_${idx}`] = tot;
        point[`net_${idx}`] = tot > 0 ? netSentiment : null;
        point[`pos_${idx}`] = tot > 0 ? posPct : null;
        point[`neg_${idx}`] = tot > 0 ? negPct : null;
      });

      return point;
    });
  }, [cleanActores, effectiveRecords, todayISO, localToday]);

  // PDF Export Function
  const handleExportPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      await generateActorComparisonPdf({
        actors: actorsSummary,
        timeline: comparativeTimeline,
        title: 'INFORME COMPARATIVO DE TENDENCIAS Y SENTIMIENTO',
        subtitle: `Análisis comparativo simultáneo de ${cleanActores.length} actores con tendencias individuales preservadas.`,
        metric
      });
    } catch (err) {
      console.error('Error al generar PDF comparativo:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Open Email Modal with prefilled subject and executive text
  const handleOpenEmailModal = () => {
    const dateFormatted = new Date().toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const actorNames = cleanActores.join(' vs ');
    setEmailSubject(`Informe Comparativo de Tendencias: ${actorNames} - ${dateFormatted}`);

    const summaryText =
      `Estimado(a),\n\n` +
      `Comparto el informe comparativo de monitoreo y tendencias reputacionales generado el ${dateFormatted} para los siguientes actores:\n\n` +
      actorsSummary
        .map(
          (a) =>
            `• ${a.actor}:\n` +
            `   - Cobertura Total: ${a.total} notas publicadas\n` +
            `   - Balance Neto: ${a.netSentiment >= 0 ? '+' : ''}${a.netSentiment}%\n` +
            `   - Distribución: ${a.posPct}% Positiva, ${a.neuPct}% Neutral, ${a.negPct}% Alerta\n` +
            `   - Pico Máximo: ${a.peakVol} notas (${a.peakDate})`
        )
        .join('\n\n') +
      `\n\nCortes temporales analizados: ${comparativeTimeline.length} fechas.\n` +
      `Adjunto encontrará el informe analítico en formato PDF.\n\n` +
      `Saludos cordiales,\nSistema de Business Intelligence & Media Monitoring.`;

    setEmailMessage(summaryText);
    setEmailFeedback(null);
    setIsEmailModalOpen(true);
  };

  // Execute Email Action (Download PDF + Launch mailto: client)
  const handleSendEmail = async () => {
    try {
      setIsGeneratingPdf(true);
      // Generate and download PDF so the user has the file ready to attach
      await generateActorComparisonPdf({
        actors: actorsSummary,
        timeline: comparativeTimeline,
        metric
      });

      // Launch mailto
      const mailtoUrl = `mailto:${encodeURIComponent(emailRecipient.trim())}?subject=${encodeURIComponent(
        emailSubject
      )}&body=${encodeURIComponent(emailMessage)}`;

      window.location.href = mailtoUrl;

      setEmailFeedback('✓ PDF descargado y cliente de correo abierto listo para enviar.');
      setTimeout(() => {
        setIsEmailModalOpen(false);
        setEmailFeedback(null);
      }, 3000);
    } catch (err) {
      console.error('Error al procesar envío por correo:', err);
      setEmailFeedback('Ocurrió un error al preparar el envío.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Web Share API if supported
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        setIsGeneratingPdf(true);
        const { blob, fileName } = await generateActorComparisonPdf({
          actors: actorsSummary,
          timeline: comparativeTimeline,
          metric
        });

        const file = new File([blob], fileName, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: emailSubject,
            text: emailMessage,
            files: [file]
          });
        } else {
          await navigator.share({
            title: emailSubject,
            text: emailMessage
          });
        }
        setIsEmailModalOpen(false);
      } catch (err) {
        console.log('Compartir cancelado o no disponible:', err);
      } finally {
        setIsGeneratingPdf(false);
      }
    } else {
      handleSendEmail();
    }
  };

  if (!isOpen) return null;

  // Custom Comparative Tooltip
  const renderTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;

    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/95 p-3.5 shadow-2xl backdrop-blur-md text-slate-100 min-w-[320px] max-w-[420px] z-50">
        <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800">
          <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-200 capitalize">
            <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>{data.displayFecha}</span>
          </div>
          {data.isToday && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Día en progreso
            </span>
          )}
        </div>

        <div className="text-[11px] font-semibold text-slate-400 mb-2">
          Comparativa por Actor —{' '}
          {metric === 'net'
            ? 'Balance Neto (%Pos - %Alerta)'
            : metric === 'positive'
            ? '% Favorable'
            : metric === 'negative'
            ? '% Alerta'
            : 'Volumen de Menciones'}
          :
        </div>

        <div className="space-y-2">
          {cleanActores.map((actor, idx) => {
            const color = ACTOR_PALETTE[idx % ACTOR_PALETTE.length];
            const stats = data.actorStats?.[actor] || {
              Positivas: 0,
              Neutrales: 0,
              Negativas: 0,
              total: 0,
              posPct: 0,
              neuPct: 0,
              negPct: 0,
              netSentiment: 0
            };
            return (
              <div key={actor} className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="font-bold text-xs text-white truncate">{actor}</span>
                  </div>
                  <span className="font-mono text-xs font-semibold text-cyan-300 shrink-0">
                    {stats.total} notas
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 pt-1 border-t border-slate-700/40">
                  <span className="text-[#10B981] font-semibold">{stats.posPct}% Pos</span>
                  <span className="text-[#94A3B8]">{stats.neuPct}% Neu</span>
                  <span className="text-[#EF4444] font-semibold">{stats.negPct}% Alerta</span>
                  <span
                    className={`font-bold ${stats.netSentiment >= 0 ? 'text-cyan-400' : 'text-amber-400'}`}
                  >
                    Net: {stats.netSentiment >= 0 ? `+${stats.netSentiment}%` : `${stats.netSentiment}%`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 md:p-4 bg-slate-950/85 backdrop-blur-md overflow-hidden animate-in fade-in duration-200">
      {/* Modal Container: Full Screen Width by Default */}
      <div
        className={`w-full ${
          isMaximized
            ? 'h-screen w-screen max-w-none max-h-none rounded-none'
            : 'w-[98vw] max-w-[98vw] h-[95vh] max-h-[96vh] rounded-2xl'
        } bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden transition-all duration-300`}
      >
        {/* 1. Modal Top Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0 shadow-xs">
              <Scale className="w-5 h-5 text-cyan-500" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Ventana Independiente: Análisis Comparativo de Tendencias
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                  {cleanActores.length} Actores en Comparativa
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden md:inline">
                  (Pantalla ancha completa)
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-2xl">
                Tendencias comparadas simultáneas manteniendo intactos los datos individuales de cada actor
              </p>
            </div>
          </div>

          {/* Action Buttons: Export PDF, Send Email, Maximize & Close */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Download PDF Button */}
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-xs disabled:opacity-60"
              title="Descargar informe comparativo en PDF (A4 Apaisado)"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-500" />
              ) : (
                <Download className="w-3.5 h-3.5 text-cyan-500" />
              )}
              <span>Descargar PDF</span>
            </button>

            {/* Send PDF by Email Button */}
            <button
              type="button"
              onClick={handleOpenEmailModal}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold transition-all cursor-pointer shadow-md shadow-cyan-500/20 hover:shadow-cyan-500/30 disabled:opacity-60"
              title="Enviar informe PDF por correo electrónico o compartir"
            >
              <Mail className="w-3.5 h-3.5 text-cyan-200" />
              <span>Enviar PDF</span>
              <Send className="w-3 h-3 text-cyan-200" />
            </button>

            <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

            {/* Window Size Toggle */}
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={isMaximized ? 'Restaurar ancho de pantalla' : 'Maximizar a pantalla completa'}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Cerrar ventana independiente (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Sub-Header: Dynamic Actor Management Strip (Add, Remove & Quick Select) */}
        <div className="px-5 py-2.5 bg-slate-100/90 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mr-1">
              <Users className="w-3.5 h-3.5 text-cyan-500" />
              <span>Actores en Comparación:</span>
            </span>

            {/* Active Actor Chips with Remove Button */}
            {cleanActores.map((actor, idx) => {
              const color = ACTOR_PALETTE[idx % ACTOR_PALETTE.length];
              const summary = actorsSummary.find((s) => s.actor === actor);
              return (
                <div
                  key={actor}
                  className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border shadow-xs transition-all"
                  style={{ borderColor: `${color}60` }}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-slate-900 dark:text-white max-w-[160px] truncate" title={actor}>
                    {actor}
                  </span>
                  {summary && (
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded flex items-center gap-1">
                      {summary.isFetching && (
                        <Loader2 className="w-2.5 h-2.5 animate-spin text-cyan-500" />
                      )}
                      <span>{summary.total}</span>
                    </span>
                  )}
                  {cleanActores.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveActor(actor)}
                      className="p-0.5 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 cursor-pointer transition-colors ml-0.5"
                      title={`Quitar a ${actor} de esta comparativa`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* "+ Agregar Actor" Popover Dropdown */}
            <div className="relative" ref={addActorDropdownRef}>
              <button
                type="button"
                onClick={() => setIsAddActorOpen(!isAddActorOpen)}
                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                title="Agregar más actores a esta ventana comparativa"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar Actor</span>
              </button>

              {isAddActorOpen && (
                <div className="absolute top-full left-0 mt-2 w-72 sm:w-80 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-3 z-50 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-cyan-500" />
                      Agregar a la Comparativa
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddActorOpen(false)}
                      className="text-slate-400 hover:text-slate-200 p-0.5 rounded cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Search Input inside Dropdown */}
                  <div className="relative mb-2.5">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchActorQuery}
                      onChange={(e) => setSearchActorQuery(e.target.value)}
                      placeholder="Buscar actor por nombre..."
                      className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      autoFocus
                    />
                  </div>

                  {/* Available Actors List */}
                  <div className="max-h-56 overflow-y-auto space-y-1">
                    {unselectedActors.length > 0 ? (
                      unselectedActors.map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => handleAddActor(item.name)}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-cyan-500/10 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors cursor-pointer group"
                        >
                          <span className="truncate mr-2 font-medium">{item.name}</span>
                          <span className="font-mono text-[11px] text-slate-400 group-hover:text-cyan-500 shrink-0">
                            {item.count.toLocaleString()} notas
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="py-4 text-center text-xs text-slate-400">
                        {searchActorQuery ? 'No se encontraron más actores' : 'Todos los actores están agregados'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {Object.values(fetchingActors).some(Boolean) && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Cargando notas de actor...</span>
              </span>
            )}

            {/* Sync with Main Monitor Filters Button */}
            {onUpdateActores && (
              <button
                type="button"
                onClick={handleSyncFilters}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                  isSyncSuccess
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-cyan-500'
                }`}
                title="Aplica esta selección de actores al Monitor Principal"
              >
                {isSyncSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>¡Filtros Sincronizados!</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 text-cyan-500" />
                    <span>Sincronizar con Monitor Principal</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* 3. Modal Body: Wide Scrollable Area */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Executive Head-to-Head Cards (Responsive Grid across Wide Screen) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3.5">
            {actorsSummary.map((item) => (
              <div
                key={item.actor}
                className="p-4 rounded-xl border transition-all flex flex-col justify-between relative overflow-hidden shadow-xs hover:shadow-md"
                style={{
                  borderColor: `${item.color}50`,
                  backgroundColor: isDark ? `${item.color}10` : `${item.color}08`
                }}
              >
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: item.color }}
                />
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <h3
                        className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate"
                        title={item.actor}
                      >
                        {item.actor}
                      </h3>
                    </div>
                    {cleanActores.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveActor(item.actor)}
                        className="text-slate-400 hover:text-rose-400 p-0.5 cursor-pointer"
                        title="Quitar"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Total Notas:</span>
                      {item.isFetching ? (
                        <span className="font-mono text-xs text-cyan-500 flex items-center gap-1 animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Cargando...</span>
                        </span>
                      ) : (
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {item.total.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Balance Neto:</span>
                      <span
                        className={`font-mono font-bold ${
                          item.netSentiment >= 0 ? 'text-emerald-500' : 'text-rose-500'
                        }`}
                      >
                        {item.netSentiment >= 0 ? `+${item.netSentiment}%` : `${item.netSentiment}%`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-0.5 border-t border-slate-200/50 dark:border-slate-800">
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{item.posPct}% Pos</span>
                      <span className="text-slate-500">{item.neuPct}% Neu</span>
                      <span className="text-rose-600 dark:text-rose-400 font-semibold">{item.negPct}% Alerta</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[10px] text-slate-500 flex items-center justify-between">
                  <span>Pico: {item.peakVol} notas</span>
                  <span className="font-mono">{item.peakDate !== '-' ? item.peakDate : 'N/A'}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Controls Bar: Metric Switcher, Grouped Bars Toggle & View Mode */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-semibold px-1">
                Métrica Comparativa:
              </span>
              <button
                type="button"
                onClick={() => setMetric('net')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  metric === 'net'
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Balance Neto
              </button>
              <button
                type="button"
                onClick={() => setMetric('positive')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  metric === 'positive'
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                % Favorable
              </button>
              <button
                type="button"
                onClick={() => setMetric('negative')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  metric === 'negative'
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                % Alerta
              </button>
              <button
                type="button"
                onClick={() => setMetric('volume')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  metric === 'volume'
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Volumen Notas
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs flex-wrap">
              <button
                type="button"
                onClick={() => setShowVolumeBars(!showVolumeBars)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold border transition-all cursor-pointer ${
                  showVolumeBars
                    ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30'
                    : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700'
                }`}
                title="Barras agrupadas de volumen en paralelo lado a lado (independientes, no apiladas)"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Barras Agrupadas (Lado a Lado)</span>
              </button>

              <div className="flex items-center p-0.5 rounded-lg bg-slate-200/80 dark:bg-slate-900 border border-slate-300 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setActiveTab('chart')}
                  className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    activeTab === 'chart'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Gráfico
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('matrix')}
                  className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    activeTab === 'matrix'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Tabla Comparativa
                </button>
              </div>
            </div>
          </div>

          {/* View Tab 1: Comprehensive Landscape Chart */}
          {activeTab === 'chart' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-2 border-b border-slate-200/60 dark:border-slate-800 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  {cleanActores.map((actor, idx) => {
                    const color = ACTOR_PALETTE[idx % ACTOR_PALETTE.length];
                    return (
                      <span key={actor} className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                        <span className="w-3 h-1 rounded-full" style={{ backgroundColor: color }} />
                        <span className="truncate max-w-[150px]">{actor}</span>
                      </span>
                    );
                  })}
                  <span className="text-[11px] text-slate-400 italic">
                    * Barras agrupadas en paralelo (independientes, no apiladas)
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-amber-500 font-medium">
                  <span className="w-2 h-2 rounded-full border border-dashed border-amber-400 bg-amber-400/40 animate-pulse" />
                  <span>Día en progreso</span>
                </div>
              </div>

              {/* Large Chart Container */}
              <div className="h-96 w-full min-h-[380px]">
                {comparativeTimeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={comparativeTimeline}
                      margin={{ top: 15, right: 15, left: -5, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke={isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.8)'}
                      />
                      <XAxis
                        dataKey="fecha"
                        tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }}
                        axisLine={{ stroke: isDark ? '#475569' : '#cbd5e1' }}
                        tickLine={false}
                        tickFormatter={(val: string) => {
                          const parts = val.split('-');
                          return parts.length === 3 ? `${parts[2]}/${parts[1]}` : val;
                        }}
                      />

                      {/* Left Y-Axis: Volume */}
                      <YAxis
                        yAxisId="volume"
                        orientation="left"
                        tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 10 }}
                        axisLine={{ stroke: isDark ? '#334155' : '#cbd5e1' }}
                        tickLine={false}
                        allowDecimals={false}
                      />

                      {/* Right Y-Axis: Percentage / Net */}
                      {metric !== 'volume' ? (
                        <YAxis
                          yAxisId="percent"
                          orientation="right"
                          domain={metric === 'net' ? [-100, 100] : [0, 100]}
                          tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }}
                          axisLine={{ stroke: isDark ? '#475569' : '#cbd5e1' }}
                          tickLine={false}
                          unit="%"
                          tickFormatter={(val) => (metric === 'net' && val > 0 ? `+${val}%` : `${val}%`)}
                        />
                      ) : null}

                      <Tooltip content={renderTooltip} cursor={{ stroke: isDark ? '#475569' : '#cbd5e1', strokeDasharray: '4 4' }} />

                      {/* Side-by-side grouped bars for each actor (NOT stacked, independent) */}
                      {showVolumeBars &&
                        cleanActores.map((actor, idx) => {
                          const color = ACTOR_PALETTE[idx % ACTOR_PALETTE.length];
                          return (
                            <Bar
                              key={`bar-vol-${actor}`}
                              yAxisId="volume"
                              dataKey={`vol_${idx}`}
                              name={`Volumen: ${actor}`}
                              fill={color}
                              fillOpacity={isDark ? 0.35 : 0.25}
                              stroke={color}
                              strokeWidth={1}
                              maxBarSize={22}
                            />
                          );
                        })}

                      {/* Independent linear curves for each actor */}
                      {cleanActores.map((actor, idx) => {
                        const color = ACTOR_PALETTE[idx % ACTOR_PALETTE.length];
                        const dataKey =
                          metric === 'volume'
                            ? `vol_${idx}`
                            : metric === 'net'
                            ? `net_${idx}`
                            : metric === 'positive'
                            ? `pos_${idx}`
                            : `neg_${idx}`;
                        const yAxis = metric === 'volume' ? 'volume' : 'percent';

                        return (
                          <Line
                            key={`line-curve-${actor}`}
                            yAxisId={yAxis}
                            type="linear"
                            connectNulls={true}
                            dataKey={dataKey}
                            name={actor}
                            stroke={color}
                            strokeWidth={2.8}
                            dot={{ r: 4, stroke: color, strokeWidth: 1.5, fill: isDark ? '#0f172a' : '#ffffff' }}
                            activeDot={{ r: 6, stroke: color, strokeWidth: 2, fill: color }}
                          />
                        );
                      })}
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-slate-400">
                    Sin datos temporales para los actores seleccionados
                  </div>
                )}
              </div>
            </div>
          )}

          {/* View Tab 2: Granular Matrix Table */}
          {activeTab === 'matrix' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold sticky top-0 z-10">
                    <tr>
                      <th className="px-3.5 py-2.5">Fecha</th>
                      {cleanActores.map((actor, idx) => {
                        const color = ACTOR_PALETTE[idx % ACTOR_PALETTE.length];
                        return (
                          <th key={actor} className="px-3.5 py-2.5" style={{ color }}>
                            {actor} (Vol / Pos% / Alerta% / Net)
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {comparativeTimeline.map((row) => (
                      <tr key={row.fecha} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-3.5 py-2 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {row.shortFecha} {row.isToday && <span className="text-amber-500 font-bold">(Hoy)</span>}
                        </td>
                        {cleanActores.map((actor) => {
                          const s = row.actorStats?.[actor] || { total: 0, posPct: 0, negPct: 0, netSentiment: 0 };
                          return (
                            <td key={actor} className="px-3.5 py-2 whitespace-nowrap font-mono">
                              <span className="font-bold text-slate-900 dark:text-white">{s.total}</span>
                              <span className="text-slate-400 mx-1">|</span>
                              <span className="text-emerald-500 font-semibold">{s.posPct}%</span>
                              <span className="text-slate-400 mx-1">|</span>
                              <span className="text-rose-500 font-semibold">{s.negPct}%</span>
                              <span className="text-slate-400 mx-1">|</span>
                              <span
                                className={
                                  s.netSentiment >= 0 ? 'text-cyan-400 font-bold' : 'text-amber-400 font-bold'
                                }
                              >
                                {s.netSentiment >= 0 ? `+${s.netSentiment}%` : `${s.netSentiment}%`}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Analytical Takeaways */}
          <div className="p-3.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/40 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-cyan-900 dark:text-cyan-300">
                Observaciones Analíticas de la Comparativa ({cleanActores.length} actores):
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Las curvas muestran el progreso temporal independiente de cada actor. Los datos personales de cada uno permanecen intactos y las barras se disponen en paralelo lado a lado sin apilamiento artificial.
              </p>
            </div>
          </div>
        </div>

        {/* 4. Modal Footer: Status & Actions */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {comparativeTimeline.length} cortes temporales analizados • {cleanActores.length} actores en ventana
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5 text-cyan-500" />
              <span>Descargar PDF</span>
            </button>

            <button
              type="button"
              onClick={handleOpenEmailModal}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Enviar PDF por Correo</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Cerrar Ventana
            </button>
          </div>
        </div>
      </div>

      {/* 5. Dedicated "Enviar PDF por Correo / Compartir" Modal */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-cyan-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Enviar Informe Comparativo por Correo
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {cleanActores.length} actores incluidos en el informe PDF
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEmailModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <div className="p-5 space-y-4 text-xs">
              {emailFeedback && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{emailFeedback}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Destinatario(s):
                </label>
                <input
                  type="email"
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                  placeholder="ejemplo@organizacion.com, direccion@analisis.com"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Puedes ingresar múltiples correos separados por comas.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Asunto del Correo:
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mensaje y Resumen Ejecutivo:
                </label>
                <textarea
                  rows={6}
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-[11px] leading-relaxed resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-cyan-500" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Documento PDF Adjunto:
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Comparativa_Actores_{cleanActores.length}_actores.pdf (A4 Apaisado)
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-mono text-[10px] font-bold">
                  Listo para descargar
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleNativeShare}
                disabled={isGeneratingPdf}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer disabled:opacity-60"
                title="Compartir enlace o archivo mediante opciones nativas del sistema"
              >
                <Share2 className="w-3.5 h-3.5 text-cyan-500" />
                <span>Compartir</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEmailModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSendEmail}
                  disabled={isGeneratingPdf}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 cursor-pointer disabled:opacity-60"
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Descargar y Abrir Correo</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
