import { jsPDF } from 'jspdf';
import { FilterState, KPIStats, MediaRecord } from '../types';
import { repository } from '../services/repository';

// The record listing omits Contexto/Fragmento; load them on demand for the notes that go into a PDF
async function withDetails(records: MediaRecord[]): Promise<MediaRecord[]> {
  const pending = records.filter((r) => r.contexto === undefined).map((r) => r.id);
  if (pending.length === 0) return records;
  const details = await repository.getRecordDetails(pending);
  return records.map((r) => (details[r.id] ? { ...r, ...details[r.id] } : r));
}


export interface GlobalReportOptions {
  title?: string;
  subtitle?: string;
  preparedFor?: string;
  reportType?: 'executive' | 'complete';
  notesLimit?: number; // e.g. 10, 25, 50, 100
  includeKpis?: boolean;
  includeBreakdowns?: boolean;
  includeNotesList?: boolean;
  includeLinks?: boolean;
}

/**
 * Normalizes and validates URLs for PDF document hyperlinks.
 * Ensures URLs have valid protocol (https://) and are not placeholders like '#'.
 */
export function formatPdfUrl(url?: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (
    !trimmed ||
    trimmed === '#' ||
    trimmed.toLowerCase() === 'n/a' ||
    trimmed.toLowerCase() === 'sin enlace' ||
    trimmed.toLowerCase() === 'sin link' ||
    trimmed.toLowerCase() === 'no disponible'
  ) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }
  // If it's a domain/path without protocol (e.g. www.milenio.com/...), prepend https://
  if (/^[a-z0-9]+([-.][a-z0-9]+)*\.[a-z]{2,}(:\d+)?(\/.*)?$/i.test(trimmed) || trimmed.includes('.') || trimmed.includes('/')) {
    return `https://${trimmed}`;
  }
  return null;
}

/**
 * Generates an executive PDF report for a single media monitoring record (Ficha Ejecutiva).
 */
export async function generateRecordPdf(inputRecord: MediaRecord): Promise<void> {
  const [record] = await withDetails([inputRecord]);
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;

  // Colors
  const navyColor = [15, 23, 42] as const; // #0f172a
  const cyanColor = [8, 145, 178] as const; // #0891b2
  const slateDark = [51, 65, 85] as const; // #334155
  const slateLight = [241, 245, 249] as const; // #f1f5f9
  const borderGray = [226, 232, 240] as const; // #e2e8f0

  // 1. Corporate Top Banner Bar
  doc.setFillColor(...navyColor);
  doc.rect(0, 0, pageWidth, 22, 'F');

  // Accent gradient indicator line
  doc.setFillColor(...cyanColor);
  doc.rect(0, 22, pageWidth, 1.8, 'F');

  // Top header brand text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('MEDIA MONITORING & REPUTATION BUSINESS INTELLIGENCE', margin, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text('SISTEMA INTEGRADO DE MONITOREO DE MEDIOS Y ANÁLISIS DE CONTENIDO', margin, 17);

  // Top Right: Emission Date & ID
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });

  doc.setFontSize(7.5);
  doc.text(`EMISIÓN: ${dateStr} ${timeStr}`, pageWidth - margin, 12, { align: 'right' });
  doc.text(`REGISTRO ID: #${record.id}`, pageWidth - margin, 17, { align: 'right' });

  let y = 32;

  // 2. Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...navyColor);
  doc.text('FICHA EJECUTIVA DE MONITOREO DE PRENSA', margin, y);

  y += 7;

  // 3. Sentiment & Priority Box
  const sentiment = (record.calificacion || 'Neutral').toUpperCase();
  let badgeBg: [number, number, number] = [241, 245, 249];
  let badgeTextColor: [number, number, number] = [71, 85, 105];
  let badgeBorder: [number, number, number] = [203, 213, 225];

  if (sentiment.includes('POS')) {
    badgeBg = [236, 253, 245]; // emerald 50
    badgeTextColor = [5, 150, 105]; // emerald 600
    badgeBorder = [167, 243, 208]; // emerald 200
  } else if (sentiment.includes('NEG')) {
    badgeBg = [255, 241, 242]; // rose 50
    badgeTextColor = [225, 29, 72]; // rose 600
    badgeBorder = [254, 205, 211]; // rose 200
  }

  // Draw sentiment badge
  doc.setFillColor(...badgeBg);
  doc.setDrawColor(...badgeBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, 11, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...badgeTextColor);
  doc.text(`CALIFICACIÓN REPUTACIONAL: ${sentiment}`, margin + 5, y + 7.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...slateDark);
  doc.text(`FECHA DE PUBLICACIÓN: ${record.fecha || 'N/A'}`, pageWidth - margin - 5, y + 7.2, { align: 'right' });

  y += 16;

  // 4. Headline / Titular
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...borderGray);
  doc.setLineWidth(0.3);

  const titular = record.titulo && record.titulo.trim() ? record.titulo.trim() : record.resumen.substring(0, 140);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...navyColor);

  const titularLines = doc.splitTextToSize(titular, contentWidth - 8);
  const titularBoxHeight = Math.max(12, titularLines.length * 5 + 7);
  doc.roundedRect(margin, y, contentWidth, titularBoxHeight, 2, 2, 'FD');
  doc.text(titularLines, margin + 4, y + 6);

  y += titularBoxHeight + 5;

  // 5. Metadata Table Grid
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...cyanColor);
  doc.text('METADATOS CLAVE DEL REGISTRO', margin, y);

  y += 3;

  const metadataItems: Array<{ label: string; value: string }> = [
    { label: 'Actor Monitoreado:', value: record.actor || 'Sin actor' },
    { label: 'Medio Informativo:', value: record.medio || 'N/A' },
    { label: 'Reportero / Autor:', value: record.reportero || 'Redacción' },
    { label: 'Categoría:', value: record.categoria || record.tema || record.tipo || 'General' },
    { label: 'Estado / Región:', value: record.estado || record.region || 'Estatal' },
    { label: 'Municipio:', value: record.municipio || 'No especificado' },
    { label: 'Tema Principal:', value: record.tema || record.categoria || 'N/A' },
    { label: 'Dependencia:', value: record.dependencia || 'No especificada' },
  ];

  const colWidth = contentWidth / 2;
  const rowHeight = 6.5;

  for (let i = 0; i < metadataItems.length; i += 2) {
    const itemLeft = metadataItems[i];
    const itemRight = metadataItems[i + 1];
    const rowY = y + (i / 2) * rowHeight;

    // Background alternating row
    if ((i / 2) % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, rowY, contentWidth, rowHeight, 'F');
    }

    // Left column
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...slateDark);
    doc.text(itemLeft.label, margin + 3, rowY + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...navyColor);
    const valLeft = doc.splitTextToSize(itemLeft.value, colWidth - 45);
    doc.text(valLeft[0] || '', margin + 40, rowY + 4.5);

    // Right column
    if (itemRight) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...slateDark);
      doc.text(itemRight.label, margin + colWidth + 3, rowY + 4.5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...navyColor);
      const valRight = doc.splitTextToSize(itemRight.value, colWidth - 45);
      doc.text(valRight[0] || '', margin + colWidth + 40, rowY + 4.5);
    }
  }

  y += (metadataItems.length / 2) * rowHeight + 6;

  // 6. Resumen Ejecutivo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...cyanColor);
  doc.text('RESUMEN EJECUTIVO DE LA NOTICIA', margin, y);

  y += 3.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...navyColor);

  const resumenLines = doc.splitTextToSize(record.resumen || 'Sin resumen registrado.', contentWidth - 6);
  const resumenBoxHeight = Math.max(16, resumenLines.length * 4.2 + 8);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...borderGray);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, resumenBoxHeight, 2, 2, 'FD');
  doc.text(resumenLines, margin + 4, y + 6);

  y += resumenBoxHeight + 6;

  // 7. Contexto Noticioso (if available)
  if (record.contexto && record.contexto.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...slateDark);
    doc.text('CONTEXTO Y ANÁLISIS DE FONDO:', margin, y);

    y += 3.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...slateDark);

    const contextoLines = doc.splitTextToSize(record.contexto.trim(), contentWidth - 6);
    const contextoHeight = contextoLines.length * 3.8 + 6;

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, contentWidth, contextoHeight, 2, 2, 'FD');
    doc.text(contextoLines, margin + 4, y + 5);

    y += contextoHeight + 5;
  }

  // 8. Citations / Personajes & Instituciones (if available)
  if (record.personajes || record.instituciones) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...slateDark);

    if (record.personajes) {
      doc.text('Personajes citados: ', margin, y);
      doc.setFont('helvetica', 'normal');
      const persLines = doc.splitTextToSize(record.personajes, contentWidth - 35);
      doc.text(persLines, margin + 30, y);
      y += persLines.length * 4 + 2;
    }

    if (record.instituciones) {
      doc.setFont('helvetica', 'bold');
      doc.text('Instituciones: ', margin, y);
      doc.setFont('helvetica', 'normal');
      const instLines = doc.splitTextToSize(record.instituciones, contentWidth - 35);
      doc.text(instLines, margin + 30, y);
      y += instLines.length * 4 + 3;
    }
  }

  // 9. Source Link preview with interactive "Ver nota" button
  const validRecordUrl = formatPdfUrl(record.link);
  if (validRecordUrl) {
    const boxH = 9.5;
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(...borderGray);
    doc.setLineWidth(0.25);
    doc.roundedRect(margin, y, contentWidth, boxH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...slateDark);
    doc.text('ENLACE A FUENTE ORIGINAL:', margin + 4, y + 6.2);

    // Clickable "Ver nota ↗" button badge
    const btnX = margin + 50;
    const btnY = y + 2.2;
    const btnW = 27;
    const btnH = 5.2;

    doc.setFillColor(...cyanColor);
    doc.roundedRect(btnX, btnY, btnW, btnH, 1, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(255, 255, 255);
    doc.textWithLink('Ver nota ↗', btnX + 4, btnY + 3.7, { url: validRecordUrl });
    doc.link(btnX, btnY, btnW, btnH, { url: validRecordUrl });

    // Hostname preview
    try {
      const hostname = new URL(validRecordUrl).hostname.replace(/^www\./, '');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(100, 116, 139);
      doc.text(`(${hostname})`, btnX + btnW + 3.5, y + 6.2);
    } catch {
      // ignore
    }

    y += boxH + 5;
  }

  // 10. Footer Section
  const footerY = pageHeight - 16;
  doc.setDrawColor(...borderGray);
  doc.setLineWidth(0.4);
  doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(
    'CONFIDENCIAL • Ficha generada automáticamente por la Plataforma de Business Intelligence & Media Monitoring.',
    margin,
    footerY + 1
  );
  doc.text(
    'Cálculo e índices respaldados en el repositorio central de monitoreo. Prohibida su alteración.',
    margin,
    footerY + 4.5
  );

  doc.setFont('helvetica', 'bold');
  doc.text(`Página 1 / 1  •  ID #${record.id}`, pageWidth - margin, footerY + 1, { align: 'right' });

  // Save the PDF file cleanly
  const cleanId = String(record.id).replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanDate = record.fecha || dateStr.replace(/[^0-9-]/g, '');
  const fileName = `Ficha_Monitoreo_${cleanId}_${cleanDate}.pdf`;

  doc.save(fileName);
}

/**
 * Generates an executive intelligence PDF report from the Global Monitor (Monitor Global).
 * Formats:
 * - Executive Brief (Resumen Ejecutivo)
 * - Complete Intelligence Dossier (Dossier Completo con Catálogo de Notas)
 */
export async function generateGlobalMonitorPdf(
  records: MediaRecord[],
  stats: KPIStats,
  filters: FilterState,
  options?: GlobalReportOptions
): Promise<void> {
  const notesToLoad = options?.includeNotesList === false ? 0 : (options?.notesLimit ?? (options?.reportType === 'executive' ? 10 : 35));
  records = [...(await withDetails(records.slice(0, notesToLoad))), ...records.slice(notesToLoad)];

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm
  const bottomLimit = pageHeight - 15;

  // Corporate Theme Colors
  const navyColor = [15, 23, 42] as const; // #0f172a
  const cyanColor = [8, 145, 178] as const; // #0891b2
  const slateDark = [51, 65, 85] as const; // #334155
  const slateLight = [248, 250, 252] as const; // #f8fafc
  const slateBorder = [226, 232, 240] as const; // #e2e8f0
  const emeraldColor = [5, 150, 105] as const; // #059669
  const roseColor = [225, 29, 72] as const; // #e11d48

  const now = new Date();
  const dateStr = now.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Calculate Period Description
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

  // Helper for running header on subsequent pages
  const renderRunningHeader = () => {
    doc.setFillColor(...navyColor);
    doc.rect(0, 0, pageWidth, 13, 'F');

    doc.setFillColor(...cyanColor);
    doc.rect(0, 13, pageWidth, 1.2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text('MONITOR GLOBAL • REPORTE EJECUTIVO DE MEDIOS & REPUTACIÓN', margin, 8.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(203, 213, 225);
    doc.text(`EMISIÓN: ${dateStr} ${timeStr}  |  PERÍODO: ${periodLabel}`, pageWidth - margin, 8.5, { align: 'right' });
  };

  let y = 0;

  // ==========================================
  // PAGE 1: COVER & EXECUTIVE DASHBOARD
  // ==========================================

  // 1. Corporate Top Header Banner (Height 26mm)
  doc.setFillColor(...navyColor);
  doc.rect(0, 0, pageWidth, 26, 'F');

  // Accent Line
  doc.setFillColor(...cyanColor);
  doc.rect(0, 26, pageWidth, 2, 'F');

  // Brand Name & System Text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text('MEDIA MONITORING & REPUTATION BUSINESS INTELLIGENCE', margin, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text('SISTEMA INTEGRADO DE MONITOREO DE PRENSA, MEDIOS DIGITALES & ANÁLISIS DE IMPACTO', margin, 17);

  // Top Right Meta Info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`EMISIÓN: ${dateStr} ${timeStr}`, pageWidth - margin, 10.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`PERÍODO: ${periodLabel.toUpperCase()}`, pageWidth - margin, 15.5, { align: 'right' });

  if (options?.preparedFor) {
    doc.text(`DESTINATARIO: ${options.preparedFor.substring(0, 32)}`, pageWidth - margin, 20.5, { align: 'right' });
  }

  y = 35;

  // 2. Report Main Title
  const reportMainTitle = options?.title && options.title.trim()
    ? options.title.trim()
    : 'INFORME EJECUTIVO DE MONITOREO GLOBAL';
  const reportSubtitle = options?.subtitle && options.subtitle.trim()
    ? options.subtitle.trim()
    : 'Diagnóstico de Cobertura Informativa, Indicadores Reputacionales y Balance Noticioso';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...navyColor);
  doc.text(reportMainTitle, margin, y);

  y += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...slateDark);
  doc.text(reportSubtitle, margin, y);

  y += 7.5;

  // 3. Filter Scope & Parameters Box
  const isMultiActor = filters.actores.length >= 2;
  const colW = contentWidth / 3;

  const medioStr = filters.medios.length > 0
    ? filters.medios.join(', ')
    : 'Todos los medios';

  const temaStr = filters.temas.length > 0
    ? filters.temas.join(', ')
    : 'Todos los temas';

  const geoStr = filters.estados && filters.estados.length > 0
    ? filters.estados.join(', ')
    : 'Nacional / Todos los estados';

  const califStr = filters.calificaciones.length > 0
    ? filters.calificaciones.join(', ')
    : 'Todas las calificaciones';

  // Dynamic box height and actor layout calculation
  let paramBoxH = 18;
  let multiActorLines: string[] = [];
  const multiActorLabel = `ACTORES (${filters.actores.length}): `;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  const multiActorLabelW = doc.getTextWidth(multiActorLabel);

  if (isMultiActor) {
    const actorNamesStr = filters.actores.join('   •   ');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    multiActorLines = doc.splitTextToSize(actorNamesStr, contentWidth - 10 - multiActorLabelW);
    paramBoxH = 22 + (multiActorLines.length - 1) * 4;
  }

  doc.setFillColor(...slateLight);
  doc.setDrawColor(...slateBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, paramBoxH, 2, 2, 'FD');

  // Left vertical accent stripe
  doc.setFillColor(...cyanColor);
  doc.rect(margin, y, 1.8, paramBoxH, 'F');

  if (isMultiActor) {
    // Multi-Actor Mode: Row 1 has PERÍODO, COBERTURA, SENTIMIENTO (3 columns)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...cyanColor);
    doc.text('PERÍODO:', margin + 4, y + 4.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...navyColor);
    doc.text(periodLabel, margin + 20, y + 4.8);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...cyanColor);
    doc.text('COBERTURA:', margin + colW + 2, y + 4.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...navyColor);
    const geoLines = doc.splitTextToSize(geoStr, colW - 23);
    doc.text(geoLines[0] || 'Nacional', margin + colW + 22, y + 4.8);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...cyanColor);
    doc.text('SENTIMIENTO:', margin + colW * 2 + 2, y + 4.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...navyColor);
    doc.text(califStr, margin + colW * 2 + 23, y + 4.8);

    // Row 2: MEDIOS and TEMAS
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...cyanColor);
    doc.text('MEDIOS:', margin + 4, y + 9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...navyColor);
    const medioLines = doc.splitTextToSize(medioStr, colW + 15);
    doc.text(medioLines[0] || 'Todos', margin + 18, y + 9.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...cyanColor);
    doc.text('TEMAS:', margin + colW + 2, y + 9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...navyColor);
    const temaLines = doc.splitTextToSize(temaStr, colW * 2 - 20);
    doc.text(temaLines[0] || 'Todos', margin + colW + 16, y + 9.5);

    // Row 3: Dedicated Full-Width Multi-Actor Row (Displays ALL selected actors without truncation)
    const actorRowY = y + 14.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...cyanColor);
    doc.text(multiActorLabel, margin + 4, actorRowY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...navyColor);
    multiActorLines.forEach((line, idx) => {
      doc.text(line, margin + 4 + multiActorLabelW, actorRowY + idx * 4);
    });

    // Row 4: Sample Universe
    const sampleY = actorRowY + multiActorLines.length * 4 + 1.2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...slateDark);
    doc.text(
      `UNIVERSO MUESTRAL: ${records.length.toLocaleString()} notas filtradas  •  Base de datos: ${stats.totalMenciones.toLocaleString()} notas analizadas`,
      margin + 4,
      sampleY
    );
  } else {
    // Single Actor or All Actores Mode (Classic 3-column)
    const actorStr = filters.actores.length === 1 ? filters.actores[0] : 'Todos los actores';

    // Row 1
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...cyanColor);
    doc.text('PERÍODO:', margin + 4, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...navyColor);
    doc.text(periodLabel, margin + 20, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...cyanColor);
    doc.text('ACTORES:', margin + colW + 2, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...navyColor);
    const singleActorLines = doc.splitTextToSize(actorStr, colW - 20);
    doc.text(singleActorLines[0] || 'Todos', margin + colW + 18, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...cyanColor);
    doc.text('MEDIOS:', margin + colW * 2 + 2, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...navyColor);
    const medioLines = doc.splitTextToSize(medioStr, colW - 18);
    doc.text(medioLines[0] || 'Todos', margin + colW * 2 + 16, y + 5);

    // Row 2
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...cyanColor);
    doc.text('TEMAS:', margin + 4, y + 10.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...navyColor);
    const temaLines = doc.splitTextToSize(temaStr, colW - 18);
    doc.text(temaLines[0] || 'Todos', margin + 17, y + 10.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...cyanColor);
    doc.text('COBERTURA:', margin + colW + 2, y + 10.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...navyColor);
    const geoLines = doc.splitTextToSize(geoStr, colW - 23);
    doc.text(geoLines[0] || 'Nacional', margin + colW + 22, y + 10.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...cyanColor);
    doc.text('SENTIMIENTO:', margin + colW * 2 + 2, y + 10.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...navyColor);
    doc.text(califStr, margin + colW * 2 + 23, y + 10.5);

    // Row 3: Sample info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...slateDark);
    doc.text(
      `UNIVERSO MUESTRAL: ${records.length.toLocaleString()} notas filtradas  •  Base de datos: ${stats.totalMenciones.toLocaleString()} notas analizadas`,
      margin + 4,
      y + 15.5
    );
  }

  y += paramBoxH + 5.5;

  // 4. Executive KPI Grid (4 Modern Dashboard Cards)
  const kpiCardWidth = (contentWidth - 9) / 4;
  const kpiCardHeight = 27;

  // Card 1: Total Menciones
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...slateBorder);
  doc.roundedRect(margin, y, kpiCardWidth, kpiCardHeight, 2, 2, 'FD');
  doc.setFillColor(...cyanColor);
  doc.rect(margin, y, kpiCardWidth, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...slateDark);
  doc.text('TOTAL MENCIONES', margin + 4, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...navyColor);
  doc.text(records.length.toLocaleString(), margin + 4, y + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Impacto Informativo Global', margin + 4, y + 21);

  // Card 2: Net Sentiment Score (NSS)
  const netScore = stats.netSentimentScore;
  const isNetPos = netScore > 0;
  const isNetNeg = netScore < 0;
  const netBadgeColor: [number, number, number] = isNetPos
    ? [...emeraldColor]
    : isNetNeg
    ? [...roseColor]
    : [100, 116, 139];

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin + kpiCardWidth + 3, y, kpiCardWidth, kpiCardHeight, 2, 2, 'FD');
  doc.setFillColor(...netBadgeColor);
  doc.rect(margin + kpiCardWidth + 3, y, kpiCardWidth, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...slateDark);
  doc.text('BALANCE NETO (NSS)', margin + kpiCardWidth + 7, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...netBadgeColor);
  const netStr = (netScore > 0 ? '+' : '') + netScore + '%';
  doc.text(netStr, margin + kpiCardWidth + 7, y + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(isNetPos ? 'Tendencia Favorable' : isNetNeg ? 'Alerta Crítica' : 'Balance Equilibrado', margin + kpiCardWidth + 7, y + 21);

  // Card 3: Sentiment Breakdown (Pos / Neu / Neg)
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin + (kpiCardWidth + 3) * 2, y, kpiCardWidth, kpiCardHeight, 2, 2, 'FD');
  doc.setFillColor(...cyanColor);
  doc.rect(margin + (kpiCardWidth + 3) * 2, y, kpiCardWidth, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...slateDark);
  doc.text('CALIFICACIÓN (%)', margin + (kpiCardWidth + 3) * 2 + 4, y + 6);

  // Micro progress indicator bar
  const barX = margin + (kpiCardWidth + 3) * 2 + 4;
  const barY = y + 9.5;
  const barW = kpiCardWidth - 8;
  const posW = Math.max(1, (stats.positivePct / 100) * barW);
  const neuW = Math.max(1, (stats.neutralPct / 100) * barW);
  const negW = Math.max(1, (stats.negativePct / 100) * barW);

  doc.setFillColor(...emeraldColor);
  doc.rect(barX, barY, posW, 3, 'F');
  doc.setFillColor(148, 163, 184);
  doc.rect(barX + posW, barY, neuW, 3, 'F');
  doc.setFillColor(...roseColor);
  doc.rect(barX + posW + neuW, barY, negW, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...emeraldColor);
  doc.text(`+ ${stats.positivePct}% (${stats.positivas})`, barX, y + 17);

  doc.setTextColor(100, 116, 139);
  doc.text(`= ${stats.neutralPct}% (${stats.neutrales})`, barX, y + 21);

  doc.setTextColor(...roseColor);
  doc.text(`- ${stats.negativePct}% (${stats.negativas})`, barX + barW, y + 17, { align: 'right' });

  // Card 4: Diversity & Reach
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin + (kpiCardWidth + 3) * 3, y, kpiCardWidth, kpiCardHeight, 2, 2, 'FD');
  doc.setFillColor(...cyanColor);
  doc.rect(margin + (kpiCardWidth + 3) * 3, y, kpiCardWidth, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...slateDark);
  doc.text('FUENTES Y ACTORES', margin + (kpiCardWidth + 3) * 3 + 4, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...navyColor);
  doc.text(`${stats.actoresUnicos} Actores Únicos`, margin + (kpiCardWidth + 3) * 3 + 4, y + 12);
  doc.text(`${stats.mediosUnicos} Medios Monitoreados`, margin + (kpiCardWidth + 3) * 3 + 4, y + 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${stats.reporterosUnicos} Periodistas/Autores`, margin + (kpiCardWidth + 3) * 3 + 4, y + 22);

  y += kpiCardHeight + 7;

  // 5. Compute Breakdown Analytics from records
  const actorMap = new Map<string, { total: number; pos: number; neg: number; neu: number }>();
  const medioMap = new Map<string, { total: number; pos: number; neg: number; neu: number }>();
  const temaMap = new Map<string, number>();

  records.forEach((r) => {
    // Actors
    const actor = r.actor && r.actor.trim() !== '' && r.actor.toLowerCase() !== 'sin actor' ? r.actor.trim() : null;
    if (actor) {
      const cur = actorMap.get(actor) || { total: 0, pos: 0, neg: 0, neu: 0 };
      cur.total++;
      if (r.calificacion === 'Positiva') cur.pos++;
      else if (r.calificacion === 'Negativa') cur.neg++;
      else cur.neu++;
      actorMap.set(actor, cur);
    }

    // Medios
    const medio = r.medio && r.medio.trim() !== '' ? r.medio.trim() : 'Medio no esp.';
    const curM = medioMap.get(medio) || { total: 0, pos: 0, neg: 0, neu: 0 };
    curM.total++;
    if (r.calificacion === 'Positiva') curM.pos++;
    else if (r.calificacion === 'Negativa') curM.neg++;
    else curM.neu++;
    medioMap.set(medio, curM);

    // Temas
    const tema = r.tema || r.categoria || 'General';
    temaMap.set(tema, (temaMap.get(tema) || 0) + 1);
  });

  const topActores = Array.from(actorMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const topMedios = Array.from(medioMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const topTemas = Array.from(temaMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Helper to strictly truncate single line text to maxWidth
  const fitTextToWidth = (text: string, maxWidth: number): string => {
    if (doc.getTextWidth(text) <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 3 && doc.getTextWidth(truncated + '...') > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated.trim() + '...';
  };

  // 6. Section: Executive Rankings & Breakdown (3 columns)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...navyColor);
  doc.text('RADIOGRAFÍA DE COBERTURA: TOP ACTORES, MEDIOS Y TEMAS', margin, y);

  y += 4;

  const tableColWidth = (contentWidth - 6) / 3;
  const tableH = 43;
  const colRightAlign = tableColWidth - 3;
  const colNotasAlign = tableColWidth - 14;
  const maxItemNameWidth = 32;

  // Box 1: Top Actores
  const box1X = margin;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...slateBorder);
  doc.roundedRect(box1X, y, tableColWidth, tableH, 1.5, 1.5, 'FD');

  doc.setFillColor(...slateLight);
  doc.rect(box1X, y, tableColWidth, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...navyColor);
  doc.text('TOP ACTORES', box1X + 3, y + 4.5);
  doc.text('NOTAS', box1X + colNotasAlign, y + 4.5, { align: 'right' });
  doc.text('NSS', box1X + colRightAlign, y + 4.5, { align: 'right' });

  topActores.forEach((act, idx) => {
    const rowY = y + 7 + idx * 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...slateDark);
    const shortName = fitTextToWidth(`${idx + 1}. ${act.name}`, maxItemNameWidth);
    doc.text(shortName, box1X + 3, rowY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.text(String(act.total), box1X + colNotasAlign, rowY + 4.5, { align: 'right' });

    const actNss = Math.round(((act.pos - act.neg) / (act.total || 1)) * 100);
    const actNssColor: [number, number, number] = actNss > 0 ? [...emeraldColor] : actNss < 0 ? [...roseColor] : [100, 116, 139];
    doc.setTextColor(...actNssColor);
    doc.text((actNss > 0 ? '+' : '') + actNss + '%', box1X + colRightAlign, rowY + 4.5, { align: 'right' });
  });

  if (topActores.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.8);
    doc.setTextColor(148, 163, 184);
    doc.text('Sin registros específicos de actores', box1X + 3, y + 14);
  }

  // Box 2: Top Medios
  const box2X = margin + tableColWidth + 3;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(box2X, y, tableColWidth, tableH, 1.5, 1.5, 'FD');

  doc.setFillColor(...slateLight);
  doc.rect(box2X, y, tableColWidth, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...navyColor);
  doc.text('TOP MEDIOS', box2X + 3, y + 4.5);
  doc.text('NOTAS', box2X + colNotasAlign, y + 4.5, { align: 'right' });
  doc.text('TEND.', box2X + colRightAlign, y + 4.5, { align: 'right' });

  topMedios.forEach((med, idx) => {
    const rowY = y + 7 + idx * 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...slateDark);
    const shortMed = fitTextToWidth(`${idx + 1}. ${med.name}`, maxItemNameWidth);
    doc.text(shortMed, box2X + 3, rowY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.text(String(med.total), box2X + colNotasAlign, rowY + 4.5, { align: 'right' });

    const dominant = med.pos >= med.neg && med.pos >= med.neu ? 'Pos' : med.neg > med.pos && med.neg >= med.neu ? 'Neg' : 'Neu';
    const domColor: [number, number, number] = dominant === 'Pos' ? [...emeraldColor] : dominant === 'Neg' ? [...roseColor] : [100, 116, 139];
    doc.setTextColor(...domColor);
    doc.text(dominant, box2X + colRightAlign, rowY + 4.5, { align: 'right' });
  });

  if (topMedios.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.8);
    doc.setTextColor(148, 163, 184);
    doc.text('Sin registros específicos de medios', box2X + 3, y + 14);
  }

  // Box 3: Top Temas
  const box3X = margin + (tableColWidth + 3) * 2;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(box3X, y, tableColWidth, tableH, 1.5, 1.5, 'FD');

  doc.setFillColor(...slateLight);
  doc.rect(box3X, y, tableColWidth, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...navyColor);
  doc.text('TOP TEMAS', box3X + 3, y + 4.5);
  doc.text('NOTAS', box3X + colNotasAlign, y + 4.5, { align: 'right' });
  doc.text('PART.', box3X + colRightAlign, y + 4.5, { align: 'right' });

  topTemas.forEach((tem, idx) => {
    const rowY = y + 7 + idx * 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...slateDark);
    const shortTem = fitTextToWidth(`${idx + 1}. ${tem.name}`, maxItemNameWidth);
    doc.text(shortTem, box3X + 3, rowY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.text(String(tem.count), box3X + colNotasAlign, rowY + 4.5, { align: 'right' });

    const pctPart = Math.round((tem.count / (records.length || 1)) * 100);
    doc.setTextColor(...slateDark);
    doc.text(`${pctPart}%`, box3X + colRightAlign, rowY + 4.5, { align: 'right' });
  });

  if (topTemas.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.8);
    doc.setTextColor(148, 163, 184);
    doc.text('Sin registros específicos de temas', box3X + 3, y + 14);
  }

  y += tableH + 7;

  // 7. Automated Strategic Diagnosis Callout Box
  doc.setFillColor(...slateLight);
  doc.setDrawColor(...slateBorder);
  doc.roundedRect(margin, y, contentWidth, 23, 2, 2, 'FD');

  doc.setFillColor(...cyanColor);
  doc.rect(margin, y, 2, 23, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...cyanColor);
  doc.text('SÍNTESIS ESTRATÉGICA Y DIAGNÓSTICO SITUACIONAL:', margin + 5, y + 5);

  const topActorName = topActores[0] ? topActores[0].name : 'los actores monitoreados';
  const topMedioName = topMedios[0] ? topMedios[0].name : 'medios principales';
  const topTemaName = topTemas[0] ? topTemas[0].name : 'agenda general';
  const diagnosisMood = netScore > 10 ? 'predominantemente favorable' : netScore < -10 ? 'crítica o adversa' : 'equilibrada';

  const actorScopeText = isMultiActor
    ? `El análisis comparativo incluye a los actores: ${filters.actores.join(', ')}.`
    : '';

  const diagnosticText =
    `Durante el período analizado se registraron ${records.length.toLocaleString()} notas informativas con una tendencia reputacional ${diagnosisMood} (Balance Neto de ${netStr}). ${actorScopeText} El actor con mayor volumen de menciones fue "${topActorName}", mientras que la cobertura mediática estuvo liderada por "${topMedioName}". El eje temático de mayor repercusión se concentró en "${topTemaName}", con ${stats.positivePct}% de favorabilidad frente a ${stats.negativePct}% de percepciones negativas.`;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...navyColor);
  const diagLines = doc.splitTextToSize(diagnosticText, contentWidth - 10);
  doc.text(diagLines, margin + 5, y + 10);

  y += 28;

  // 8. Key Highlights / Notas Destacadas Preview on Page 1
  const previewNotes = records.slice(0, 3);
  if (previewNotes.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...navyColor);
    doc.text('TITULARES CLAVE DE MAYOR IMPACTO', margin, y);

    y += 4;

    previewNotes.forEach((rec) => {
      const noteUrl = formatPdfUrl(rec.link);
      const cardH = noteUrl ? 23 : 19;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...slateBorder);
      doc.roundedRect(margin, y, contentWidth, cardH, 1.5, 1.5, 'FD');

      // Accent stripe
      const recSentiment = (rec.calificacion || 'Neutral').toLowerCase();
      const recColor: [number, number, number] = recSentiment.includes('pos')
        ? [...emeraldColor]
        : recSentiment.includes('neg')
        ? [...roseColor]
        : [148, 163, 184];

      doc.setFillColor(...recColor);
      doc.rect(margin, y, 1.5, cardH, 'F');

      // Top line
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(...slateDark);
      doc.text(`${rec.fecha || 'N/A'}  •  ${rec.medio || 'Medio'}  •  ${rec.actor || 'Actor'}`, margin + 4, y + 4.5);

      doc.setTextColor(...recColor);
      doc.text(rec.calificacion.toUpperCase(), pageWidth - margin - 4, y + 4.5, { align: 'right' });

      // Title
      const noteTitular = rec.titulo && rec.titulo.trim() ? rec.titulo.trim() : rec.resumen.substring(0, 110);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...navyColor);
      const titleLines = doc.splitTextToSize(noteTitular, contentWidth - 10);
      doc.text(titleLines[0] || '', margin + 4, y + 9.5);

      // Brief
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(...slateDark);
      const briefLines = doc.splitTextToSize(rec.resumen || '', contentWidth - 10);
      doc.text(briefLines[0] || '', margin + 4, y + 14.5);

      if (noteUrl) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...slateDark);
        doc.text('Enlace a fuente: ', margin + 4, y + 18.5);

        const lblW = doc.getTextWidth('Enlace a fuente: ');
        const linkX = margin + 4 + lblW;

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...cyanColor);
        const linkText = 'Ver nota ↗';
        const linkW = doc.getTextWidth(linkText);

        doc.textWithLink(linkText, linkX, y + 18.5, { url: noteUrl });

        // Underline and explicit click target for high reliability
        doc.setDrawColor(...cyanColor);
        doc.setLineWidth(0.2);
        doc.line(linkX, y + 19, linkX + linkW, y + 19);
        doc.link(linkX - 1, y + 15, linkW + 3, 5, { url: noteUrl });
      }

      y += cardH + 3;
    });
  }

  // ==========================================
  // PAGE 2+: DETAILED CATALOG OF MONITORED NOTES (IF ENABLED)
  // ==========================================
  const shouldIncludeNotesList = options?.includeNotesList !== false;
  const notesLimit = options?.notesLimit ?? (options?.reportType === 'executive' ? 10 : 35);
  const catalogNotes = records.slice(0, notesLimit);

  if (shouldIncludeNotesList && catalogNotes.length > 0) {
    doc.addPage();
    renderRunningHeader();
    y = 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...navyColor);
    doc.text('CATÁLOGO DETALLADO DE COBERTURA INFORMATIVA', margin, y);

    y += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...slateDark);
    doc.text(
      `Listado de las principales ${catalogNotes.length} notas monitoreadas en el período según criterios de relevancia y orden cronológico.`,
      margin,
      y
    );

    y += 6;

    for (let i = 0; i < catalogNotes.length; i++) {
      const rec = catalogNotes[i];
      const recSentiment = (rec.calificacion || 'Neutral').toLowerCase();
      const recColor: [number, number, number] = recSentiment.includes('pos')
        ? [...emeraldColor]
        : recSentiment.includes('neg')
        ? [...roseColor]
        : [148, 163, 184];

      // Prepare text lines to calculate height dynamically
      const titular = rec.titulo && rec.titulo.trim() ? rec.titulo.trim() : rec.resumen.substring(0, 120);
      const titleLines = doc.splitTextToSize(titular, contentWidth - 12);

      const resumen = rec.resumen && rec.resumen.trim() ? rec.resumen.trim() : 'Sin resumen.';
      const resumenLines = doc.splitTextToSize(resumen, contentWidth - 12);

      const hasContext = Boolean(rec.contexto && rec.contexto.trim());
      const contextLines = hasContext ? doc.splitTextToSize(rec.contexto!.trim(), contentWidth - 12) : [];

      const validNoteUrl = formatPdfUrl(rec.link);
      const hasLink = Boolean(options?.includeLinks !== false && validNoteUrl);

      // Calculate card height
      const titleH = titleLines.length * 3.8;
      const resumenH = Math.min(resumenLines.length * 3.4, 24); // Cap at ~7 lines
      const contextH = hasContext ? Math.min(contextLines.length * 3.2, 16) : 0;
      const linkH = hasLink ? 4.8 : 0;
      const metaFooterH = 5;

      const cardH = 9 + titleH + resumenH + (hasContext ? contextH + 3 : 0) + metaFooterH + linkH;

      // Check if we need a page break
      if (y + cardH > bottomLimit) {
        doc.addPage();
        renderRunningHeader();
        y = 20;
      }

      // Draw Note Card Container
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...slateBorder);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, contentWidth, cardH, 1.8, 1.8, 'FD');

      // Left Color Accent
      doc.setFillColor(...recColor);
      doc.rect(margin, y, 1.8, cardH, 'F');

      let currentInnerY = y + 5;

      // Top line metadata
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(...cyanColor);
      doc.text(`REGISTRO #${rec.id}  •  ${rec.fecha || 'N/A'}  •  ${rec.medio || 'Medio'}`, margin + 5, currentInnerY);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...recColor);
      doc.text(rec.calificacion.toUpperCase(), pageWidth - margin - 5, currentInnerY, { align: 'right' });

      currentInnerY += 4.5;

      // Headline
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...navyColor);
      doc.text(titleLines, margin + 5, currentInnerY);

      currentInnerY += titleH + 1.5;

      // Resumen
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(...slateDark);
      doc.text(resumenLines.slice(0, 7), margin + 5, currentInnerY);

      currentInnerY += resumenH + 1.5;

      // Context if any
      if (hasContext) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6.8);
        doc.setTextColor(100, 116, 139);
        doc.text(contextLines.slice(0, 4), margin + 5, currentInnerY);
        currentInnerY += contextH + 2;
      }

      // Metadata Tag Line
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      const metaRow = `Actor: ${rec.actor || 'N/A'}  |  Tema: ${rec.tema || rec.categoria || 'N/A'}  |  Reportero: ${rec.reportero || 'Redacción'}  |  Región: ${rec.estado || rec.region || 'Estatal'}`;
      doc.text(metaRow, margin + 5, currentInnerY);

      currentInnerY += metaFooterH;

      // Source Link with intact interactive "Ver nota ↗"
      if (hasLink && validNoteUrl) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(...slateDark);
        doc.text('Fuente original: ', margin + 5, currentInnerY);

        const lblW = doc.getTextWidth('Fuente original: ');
        const linkX = margin + 5 + lblW;

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...cyanColor);
        const linkText = 'Ver nota ↗';
        const linkW = doc.getTextWidth(linkText);

        doc.textWithLink(linkText, linkX, currentInnerY, { url: validNoteUrl });

        // Underline and explicit link area for maximum viewer compatibility
        doc.setDrawColor(...cyanColor);
        doc.setLineWidth(0.2);
        doc.line(linkX, currentInnerY + 0.6, linkX + linkW, currentInnerY + 0.6);
        doc.link(linkX - 1, currentInnerY - 3.2, linkW + 3, 5, { url: validNoteUrl });
      }

      y += cardH + 4;
    }
  }

  // ==========================================
  // FINAL PASS: PAGE NUMBERING & FOOTERS ON ALL PAGES
  // ==========================================
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    const footerY = pageHeight - 10;
    doc.setDrawColor(...slateBorder);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 2.5, pageWidth - margin, footerY - 2.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      'CONFIDENCIAL • Informe emitido por la Plataforma de Business Intelligence & Media Monitoring.',
      margin,
      footerY + 1.5
    );

    doc.setFont('helvetica', 'bold');
    doc.text(`Página ${p} de ${totalPages}`, pageWidth - margin, footerY + 1.5, { align: 'right' });
  }

  // Generate clean filename
  const cleanDate = now.toISOString().split('T')[0];
  const cleanTime = now.toTimeString().split(' ')[0].replace(/:/g, '');
  const reportFileName = `Reporte_Monitor_Global_${cleanDate}_${cleanTime}.pdf`;

  doc.save(reportFileName);
}

export interface ActorComparisonPdfOptions {
  actors: Array<{
    actor: string;
    total: number;
    pos: number;
    neu: number;
    neg: number;
    posPct: number;
    neuPct: number;
    negPct: number;
    netSentiment: number;
    peakDate: string;
    peakVol: number;
  }>;
  timeline: Array<{
    fecha: string;
    displayFecha: string;
    shortFecha: string;
    isToday: boolean;
    totalCombined: number;
    actorStats: Record<string, {
      Positivas: number;
      Neutrales: number;
      Negativas: number;
      total: number;
      posPct: number;
      neuPct: number;
      negPct: number;
      netSentiment: number;
    }>;
  }>;
  title?: string;
  subtitle?: string;
  metric?: string;
}

/**
 * Generates an executive comparative PDF report for multiple actors (Landscape A4 format).
 */
export async function generateActorComparisonPdf(
  options: ActorComparisonPdfOptions
): Promise<{ fileName: string; blob: Blob }> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 269mm

  const navyColor = [15, 23, 42] as const;
  const cyanColor = [8, 145, 178] as const;
  const slateDark = [51, 65, 85] as const;
  const slateLight = [248, 250, 252] as const;
  const slateBorder = [226, 232, 240] as const;

  const now = new Date();
  const dateStr = now.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const drawHeader = () => {
    // 1. Corporate Top Banner Bar
    doc.setFillColor(...navyColor);
    doc.rect(0, 0, pageWidth, 18, 'F');

    // Accent line
    doc.setFillColor(...cyanColor);
    doc.rect(0, 18, pageWidth, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text('SISTEMA INTEGRADO DE MONITOREO • ANÁLISIS COMPARATIVO DE ACTORES', margin, 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(203, 213, 225);
    doc.text('INTELIGENCIA REPUTACIONAL Y SEGUIMIENTO TEMPORAL DE SENTIMIENTO', margin, 14);

    doc.setFontSize(7.5);
    doc.text(`EMISIÓN: ${dateStr} ${timeStr}`, pageWidth - margin, 11, { align: 'right' });
  };

  drawHeader();

  let y = 26;

  // Title & Subtitle
  const reportTitle = options.title || 'INFORME COMPARATIVO DE TENDENCIAS Y SENTIMIENTO';
  const reportSubtitle = options.subtitle || `Comparativa analítica entre ${options.actors.length} actores con tendencias individuales preservadas.`;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...navyColor);
  doc.text(reportTitle, margin, y);

  y += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...slateDark);
  doc.text(reportSubtitle, margin, y);

  y += 6.5;

  // Parameters & Summary Strip
  const totalCombinedNotes = options.actors.reduce((acc, a) => acc + a.total, 0);
  const firstDate = options.timeline.length > 0 ? options.timeline[0].fecha : '-';
  const lastDate = options.timeline.length > 0 ? options.timeline[options.timeline.length - 1].fecha : '-';

  doc.setFillColor(...slateLight);
  doc.setDrawColor(...slateBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'FD');

  // Cyan vertical accent
  doc.setFillColor(...cyanColor);
  doc.rect(margin, y, 1.8, 14, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...cyanColor);
  doc.text('ACTORES ANALIZADOS:', margin + 4, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...navyColor);
  doc.text(`${options.actors.length} actores seleccionados`, margin + 38, y + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...cyanColor);
  doc.text('NOTAS TOTALES:', margin + 95, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...navyColor);
  doc.text(`${totalCombinedNotes.toLocaleString()} notas comparadas`, margin + 120, y + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...cyanColor);
  doc.text('VENTANA TEMPORAL:', margin + 185, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...navyColor);
  doc.text(`${firstDate} a ${lastDate} (${options.timeline.length} cortes)`, margin + 215, y + 5.5);

  // List of actor names in strip
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('ACTORES:', margin + 4, y + 10.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...navyColor);
  const actorNamesList = options.actors.map(a => `${a.actor} (${a.total})`).join('   •   ');
  const truncatedNames = doc.splitTextToSize(actorNamesList, contentWidth - 30);
  doc.text(truncatedNames[0] || actorNamesList, margin + 22, y + 10.5);

  y += 18;

  // SECTION 1: Resumen Ejecutivo Comparativo (Head-to-Head Table)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...navyColor);
  doc.text('1. CUADRO COMPARATIVO GENERAL DE ACTORES', margin, y);

  y += 4;

  const tableHeaders = [
    { label: 'ACTOR', width: 68, align: 'left' as const },
    { label: 'TOTAL NOTAS', width: 28, align: 'right' as const },
    { label: '% POSITIVA', width: 28, align: 'right' as const },
    { label: '% NEUTRAL', width: 28, align: 'right' as const },
    { label: '% ALERTA', width: 28, align: 'right' as const },
    { label: 'BALANCE NETO', width: 33, align: 'right' as const },
    { label: 'PICO DE EXPOSICIÓN', width: 56, align: 'center' as const },
  ];

  // Header row
  doc.setFillColor(...navyColor);
  doc.rect(margin, y, contentWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);

  let curX = margin;
  tableHeaders.forEach(th => {
    const xPos = th.align === 'right' ? curX + th.width - 3 : th.align === 'center' ? curX + th.width / 2 : curX + 3;
    doc.text(th.label, xPos, y + 4.8, { align: th.align });
    curX += th.width;
  });

  y += 7;

  // Actor Rows
  options.actors.forEach((act, idx) => {
    const isEven = idx % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(margin, y, contentWidth, 7.5, 'F');

    doc.setDrawColor(...slateBorder);
    doc.setLineWidth(0.2);
    doc.line(margin, y + 7.5, margin + contentWidth, y + 7.5);

    let cellX = margin;

    // Col 1: Actor Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...navyColor);
    const shortActor = act.actor.length > 36 ? act.actor.substring(0, 34) + '...' : act.actor;
    doc.text(shortActor, cellX + 3, y + 5);
    cellX += tableHeaders[0].width;

    // Col 2: Total Notas
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(act.total.toLocaleString(), cellX + tableHeaders[1].width - 3, y + 5, { align: 'right' });
    cellX += tableHeaders[1].width;

    // Col 3: % Positiva
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129); // green
    doc.text(`${act.posPct}% (${act.pos})`, cellX + tableHeaders[2].width - 3, y + 5, { align: 'right' });
    cellX += tableHeaders[2].width;

    // Col 4: % Neutral
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`${act.neuPct}% (${act.neu})`, cellX + tableHeaders[3].width - 3, y + 5, { align: 'right' });
    cellX += tableHeaders[3].width;

    // Col 5: % Alerta
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(239, 68, 68); // red
    doc.text(`${act.negPct}% (${act.neg})`, cellX + tableHeaders[4].width - 3, y + 5, { align: 'right' });
    cellX += tableHeaders[4].width;

    // Col 6: Balance Neto
    const isNetPos = act.netSentiment >= 0;
    doc.setTextColor(isNetPos ? 16 : 225, isNetPos ? 185 : 29, isNetPos ? 129 : 72);
    doc.text(isNetPos ? `+${act.netSentiment}%` : `${act.netSentiment}%`, cellX + tableHeaders[5].width - 3, y + 5, { align: 'right' });
    cellX += tableHeaders[5].width;

    // Col 7: Pico
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...slateDark);
    doc.text(`${act.peakDate} (${act.peakVol} notas)`, cellX + tableHeaders[6].width / 2, y + 5, { align: 'center' });

    y += 7.5;
  });

  y += 7;

  // SECTION 2: Matriz Temporal Detallada
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...navyColor);
  doc.text('2. EVOLUCIÓN TEMPORAL DIARIA POR ACTOR', margin, y);

  y += 4;

  // Subheader columns for matrix
  const dateColW = 32;
  const remW = contentWidth - dateColW;
  const actorColW = remW / options.actors.length;

  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, contentWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);

  doc.text('FECHA', margin + 3, y + 4.8);

  options.actors.forEach((act, idx) => {
    const startX = margin + dateColW + idx * actorColW;
    const actorHeaderTitle = act.actor.length > 20 ? act.actor.substring(0, 18) + '...' : act.actor;
    doc.text(actorHeaderTitle, startX + actorColW / 2, y + 4.8, { align: 'center' });
  });

  y += 7;

  // Render each date row in timeline
  const matrixDates = [...options.timeline].reverse(); // Most recent first
  matrixDates.forEach((pt, rowIdx) => {
    // Check if new page needed
    if (y + 8 > pageHeight - 16) {
      doc.addPage();
      drawHeader();
      y = 26;

      // Repeat table header on next page
      doc.setFillColor(30, 41, 59);
      doc.rect(margin, y, contentWidth, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text('FECHA', margin + 3, y + 4.8);
      options.actors.forEach((act, idx) => {
        const startX = margin + dateColW + idx * actorColW;
        const actorHeaderTitle = act.actor.length > 20 ? act.actor.substring(0, 18) + '...' : act.actor;
        doc.text(actorHeaderTitle, startX + actorColW / 2, y + 4.8, { align: 'center' });
      });
      y += 7;
    }

    const isEven = rowIdx % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(margin, y, contentWidth, 6.5, 'F');

    doc.setDrawColor(...slateBorder);
    doc.setLineWidth(0.15);
    doc.line(margin, y + 6.5, margin + contentWidth, y + 6.5);

    doc.setFont('helvetica', pt.isToday ? 'bold' : 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...navyColor);
    doc.text(pt.isToday ? `${pt.shortFecha} (Hoy)` : pt.shortFecha, margin + 3, y + 4.5);

    options.actors.forEach((act, idx) => {
      const startX = margin + dateColW + idx * actorColW;
      const s = pt.actorStats?.[act.actor] || { total: 0, netSentiment: 0, posPct: 0, negPct: 0 };

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      if (s.total > 0) {
        const isPos = s.netSentiment >= 0;
        doc.setTextColor(...slateDark);
        doc.text(`${s.total} notas`, startX + 4, y + 4.5);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(isPos ? 16 : 225, isPos ? 185 : 29, isPos ? 129 : 72);
        doc.text(isPos ? `+${s.netSentiment}%` : `${s.netSentiment}%`, startX + actorColW - 4, y + 4.5, { align: 'right' });
      } else {
        doc.setTextColor(148, 163, 184);
        doc.text('-', startX + actorColW / 2, y + 4.5, { align: 'center' });
      }
    });

    y += 6.5;
  });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const footerY = pageHeight - 8;
    doc.setDrawColor(...slateBorder);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 2, pageWidth - margin, footerY - 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      'CONFIDENCIAL • Informe Comparativo de Actores emitido por la Plataforma de Business Intelligence & Media Monitoring.',
      margin,
      footerY + 1.5
    );

    doc.setFont('helvetica', 'bold');
    doc.text(`Página ${p} de ${totalPages}`, pageWidth - margin, footerY + 1.5, { align: 'right' });
  }

  const cleanDate = now.toISOString().split('T')[0];
  const cleanTime = now.toTimeString().split(' ')[0].replace(/:/g, '');
  const fileName = `Comparativa_Actores_${cleanDate}_${cleanTime}.pdf`;

  const blob = doc.output('blob');
  doc.save(fileName);

  return { fileName, blob };
}

