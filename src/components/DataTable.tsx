import React, { useState } from 'react';
import { Calificacion, MediaRecord } from '../types';
import {
  ExternalLink,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  FileSpreadsheet,
  Download,
  Eye,
  Copy,
  Check,
  Smile,
  Meh,
  Frown,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Loader2
} from 'lucide-react';
import { generateRecordPdf } from '../utils/generatePdfReport';

interface DataTableProps {
  records: MediaRecord[];
  totalMatchedCount?: number;
  onSelectRecord: (record: MediaRecord) => void;
  sortField: keyof MediaRecord;
  sortDirection: 'asc' | 'desc';
  onSort: (field: keyof MediaRecord) => void;
  onOpenReportModal?: () => void;
}

export const DataTable: React.FC<DataTableProps> = ({
  records,
  totalMatchedCount,
  onSelectRecord,
  sortField,
  sortDirection,
  onSort,
  onOpenReportModal
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);

  const handleDownloadRowPdf = async (e: React.MouseEvent, record: MediaRecord) => {
    e.stopPropagation();
    try {
      setDownloadingPdfId(record.id);
      await generateRecordPdf(record);
    } catch (err) {
      console.error('Error generating PDF report:', err);
    } finally {
      setDownloadingPdfId(null);
    }
  };

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(records.length / rowsPerPage));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * rowsPerPage;
  const paginatedRecords = records.slice(startIndex, startIndex + rowsPerPage);

  const handleCopyResumen = (e: React.MouseEvent, id: string, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Fecha', 'Medio', 'Actor', 'Tema', 'Calificacion', 'Reportero', 'Link', 'Resumen'];
    const rows = records.map(r => [
      `"${r.id}"`,
      `"${r.fecha}"`,
      `"${r.medio.replace(/"/g, '""')}"`,
      `"${r.actor.replace(/"/g, '""')}"`,
      `"${(r.tema || r.categoria || '').replace(/"/g, '""')}"`,
      `"${r.calificacion}"`,
      `"${r.reportero.replace(/"/g, '""')}"`,
      `"${r.link}"`,
      `"${r.resumen.replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `media_monitoring_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderSortIcon = (field: keyof MediaRecord) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60 group-hover:opacity-100" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 text-cyan-500" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-cyan-500" />
    );
  };

  const getSentimentBadge = (calif: Calificacion) => {
    switch (calif) {
      case 'Positiva':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            <Smile className="w-3.5 h-3.5" />
            Positiva
          </span>
        );
      case 'Negativa':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
            <Frown className="w-3.5 h-3.5" />
            Negativa
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20">
            <Meh className="w-3.5 h-3.5" />
            Neutral
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-xs overflow-hidden">
      {/* Table Header Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-cyan-500" />
            Registro Detallado de Medios
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tabla dinámica con ordenamiento multi-columna y acceso directo al reporte
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenReportModal && (
            <button
              type="button"
              onClick={onOpenReportModal}
              id="btn-global-report-pdf"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-xs font-semibold text-cyan-700 dark:text-cyan-300 transition-all cursor-pointer shadow-xs"
              title="Generar informe PDF del monitor global con las notas filtradas"
            >
              <FileDown className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Reporte PDF</span>
            </button>
          )}

          {/* Export Button */}
          <button
            onClick={handleExportCSV}
            id="btn-export-csv"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition-all cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Exportar CSV</span>
          </button>

          {/* Rows per page selector */}
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 pl-2 border-l border-slate-200 dark:border-slate-800">
            <span>Filas:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider select-none">
              <th
                onClick={() => onSort('fecha')}
                className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white group transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Fecha</span>
                  {renderSortIcon('fecha')}
                </div>
              </th>

              <th
                onClick={() => onSort('medio')}
                className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white group transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Medio</span>
                  {renderSortIcon('medio')}
                </div>
              </th>

              <th
                onClick={() => onSort('actor')}
                className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white group transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Actor Monitoreado</span>
                  {renderSortIcon('actor')}
                </div>
              </th>

              <th
                onClick={() => onSort('tema')}
                className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white group transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Tema</span>
                  {renderSortIcon('tema')}
                </div>
              </th>

              <th
                onClick={() => onSort('calificacion')}
                className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white group transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Calificación</span>
                  {renderSortIcon('calificacion')}
                </div>
              </th>

              <th className="py-3 px-4 min-w-[280px]">
                <span>Resumen / Titular</span>
              </th>

              <th
                onClick={() => onSort('reportero')}
                className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white group transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Reportero</span>
                  {renderSortIcon('reportero')}
                </div>
              </th>

              <th className="py-3 px-4 text-right">
                <span>Acciones</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {paginatedRecords.length > 0 ? (
              paginatedRecords.map((record) => (
                <tr
                  key={record.id}
                  onClick={() => onSelectRecord(record)}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                >
                  {/* Fecha */}
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {record.fecha}
                  </td>

                  {/* Medio */}
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300">
                      {record.medio}
                    </span>
                  </td>

                  {/* Actor */}
                  <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center justify-center text-[10px] font-bold">
                        {record.actor.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="truncate max-w-[160px] font-semibold">{record.actor}</span>
                    </div>
                  </td>

                  {/* Tema */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-xs font-medium">
                      {record.tema || record.categoria || 'GENERAL'}
                    </span>
                  </td>

                  {/* Calificación */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {getSentimentBadge(record.calificacion)}
                  </td>

                  {/* Resumen */}
                  <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300">
                    <p className="line-clamp-2 leading-relaxed">
                      {record.resumen}
                    </p>
                  </td>

                  {/* Reportero */}
                  <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {record.reportero}
                  </td>

                  {/* Acciones */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {/* Copy Resumen */}
                      <button
                        type="button"
                        onClick={(e) => handleCopyResumen(e, record.id, record.resumen)}
                        title="Copiar resumen"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                      >
                        {copiedId === record.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Modal Details */}
                      <button
                        type="button"
                        onClick={() => onSelectRecord(record)}
                        title="Ver detalle"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 transition-all cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {/* Download PDF Report */}
                      <button
                        type="button"
                        onClick={(e) => handleDownloadRowPdf(e, record)}
                        disabled={downloadingPdfId === record.id}
                        title="Descargar Ficha en PDF"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {downloadingPdfId === record.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-600" />
                        ) : (
                          <FileDown className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* External Link */}
                      {record.link && record.link !== '#' && (
                        <a
                          href={record.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir nota original"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <FileSpreadsheet className="w-8 h-8 opacity-40 text-slate-400" />
                    <p className="text-sm font-medium">No se encontraron noticias con los filtros actuales</p>
                    <p className="text-xs text-slate-500">Prueba ajustando el texto de búsqueda o limpiando los filtros</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div>
          Mostrando <span className="font-semibold text-slate-800 dark:text-slate-200">{records.length > 0 ? (startIndex + 1).toLocaleString() : 0}</span> a{' '}
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {Math.min(startIndex + rowsPerPage, records.length).toLocaleString()}
          </span>{' '}
          de <span className="font-semibold text-slate-800 dark:text-slate-200">{records.length.toLocaleString()}</span> registros
          {totalMatchedCount && totalMatchedCount > records.length ? (
            <span className="text-slate-400 dark:text-slate-500 ml-1">
              (de {totalMatchedCount.toLocaleString()} totales encontrados)
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={validCurrentPage <= 1}
            id="btn-pagination-prev"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="px-3 py-1 font-mono font-medium">
            Página {validCurrentPage} de {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={validCurrentPage >= totalPages}
            id="btn-pagination-next"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
