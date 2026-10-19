import { jsPDF } from 'jspdf';
import { PerspectiveDeepDive, FilterState } from '../types';
import { formatPdfUrl } from './generatePdfReport';

export interface GeneratePerspectivePdfOptions {
  deepDive: PerspectiveDeepDive;
  entityName: string;
  mode: 'actores' | 'medios' | 'temas';
  dateRange?: { preset: string; start: string; end: string };
  filters?: FilterState;
}

type RGB = [number, number, number];

/**
 * Generates an executive, publication-ready PDF report for the Political & Governmental Intelligence module.
 * Built with native vector graphics and typography in jsPDF to ensure 100% reliability,
 * zero CSS-engine errors, and high-definition print quality.
 */
export async function generatePerspectivePdf({
  deepDive,
  entityName,
  mode,
  dateRange,
  filters
}: GeneratePerspectivePdfOptions): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  // Palette definition
  const navyBg: RGB = [15, 23, 42]; // #0f172a
  const cyanAccent: RGB = [6, 182, 212]; // #06b6d4
  const emeraldColor: RGB = [16, 185, 129]; // #10b981
  const roseColor: RGB = [239, 68, 68]; // #ef4444
  const slateDark: RGB = [30, 41, 59]; // #1e293b
  const slateMuted: RGB = [100, 116, 139]; // #64748b
  const slateLight: RGB = [248, 250, 252]; // #f8fafc
  const cardBorder: RGB = [226, 232, 240]; // #e2e8f0

  const modeLabel =
    mode === 'actores'
      ? 'MÓDULO 1: ACTORES MONITOREADOS'
      : mode === 'medios'
      ? 'MÓDULO 2: MEDIOS DE COMUNICACIÓN'
      : 'MÓDULO 3: TEMAS Y AGENDA PÚBLICA';

  const typeDesc =
    mode === 'actores'
      ? 'Actor Monitoreado'
      : mode === 'medios'
      ? 'Medio de Comunicación'
      : 'Tema / Asunto Público';

  const now = new Date();
  const dateStr = now.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const timeStr = now.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const periodLabel =
    dateRange?.preset && dateRange.preset !== 'all'
      ? `Periodo: ${dateRange.preset.toUpperCase()} (${dateRange.start || ''} al ${dateRange.end || ''})`
      : 'Periodo: HISTÓRICO COMPLETO';

  // Helper: Draw Header Bar
  const drawHeader = (isContinuation = false) => {
    doc.setFillColor(navyBg[0], navyBg[1], navyBg[2]);
    doc.rect(0, 0, pageWidth, isContinuation ? 16 : 22, 'F');

    doc.setFillColor(cyanAccent[0], cyanAccent[1], cyanAccent[2]);
    doc.rect(0, isContinuation ? 16 : 22, pageWidth, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isContinuation ? 9 : 10.5);
    doc.setTextColor(255, 255, 255);
    doc.text('INTELIGENCIA POLÍTICA Y ANÁLISIS GUBERNAMENTAL', margin, isContinuation ? 7 : 8.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(isContinuation ? 7 : 7.5);
    doc.setTextColor(203, 213, 225);
    doc.text(
      isContinuation
        ? `${modeLabel} • ${entityName.toUpperCase()}`
        : `${modeLabel} • ANÁLISIS REPUTACIONAL Y ESTRATÉGICO`,
      margin,
      isContinuation ? 12 : 14.5
    );

    doc.setFontSize(7);
    doc.setTextColor(226, 232, 240);
    doc.text(`EMISIÓN: ${dateStr} ${timeStr}`, pageWidth - margin, isContinuation ? 7 : 8.5, { align: 'right' });
    doc.text(periodLabel, pageWidth - margin, isContinuation ? 12 : 14.5, { align: 'right' });
  };

  // Helper: Draw Footer
  const drawFooter = (pageNum: number, totalPages: number) => {
    const footerY = pageHeight - 8;
    doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 2, pageWidth - margin, footerY - 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
    doc.text(
      'SISTEMA DE MONITOREO Y ANÁLISIS POLÍTICO ESTRATÉGICO — CONFIDENCIAL / USO INTERNO',
      margin,
      footerY + 2
    );
    doc.text(
      `PÁGINA ${pageNum} DE ${totalPages}`,
      pageWidth - margin,
      footerY + 2,
      { align: 'right' }
    );
  };

  // Rates calculation
  const totalNotes = Math.max(1, deepDive.total);
  const posRate = Math.round((deepDive.pos / totalNotes) * 100);
  const negRate = Math.round((deepDive.neg / totalNotes) * 100);
  const neuRate = Math.round((deepDive.neu / totalNotes) * 100);

  // ================= PAGE 1 =================
  drawHeader(false);

  let y = 30;

  // 1. Entity Title Box
  doc.setFillColor(slateLight[0], slateLight[1], slateLight[2]);
  doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, contentWidth, 16, 2.5, 2.5, 'FD');

  // Avatar Icon / Initials
  doc.setFillColor(6, 182, 212);
  doc.roundedRect(margin + 3.5, y + 2.5, 11, 11, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  const initials = entityName.substring(0, 2).toUpperCase();
  doc.text(initials, margin + 9, y + 9.5, { align: 'center' });

  // Entity Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(cyanAccent[0], cyanAccent[1], cyanAccent[2]);
  doc.text(typeDesc.toUpperCase(), margin + 18, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(navyBg[0], navyBg[1], navyBg[2]);
  doc.text(entityName, margin + 18, y + 12);

  // Total Notes Tag on right
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
  doc.roundedRect(pageWidth - margin - 35, y + 4, 31, 8, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
  doc.text(`Total: ${deepDive.total.toLocaleString()} notas`, pageWidth - margin - 19.5, y + 9.2, { align: 'center' });

  y += 20;

  // 2. 4 Executive KPI Cards
  const kpiCardWidth = (contentWidth - 6) / 4;
  const kpiCardHeight = 22;

  const kpis: Array<{
    title: string;
    badge: string;
    badgeColor: RGB;
    badgeBg: RGB;
    mainValue: string;
    mainColor: RGB;
    subDesc: string;
  }> = [
    {
      title: 'BALANCE POLÍTICO NETO',
      badge: `${deepDive.netSentiment >= 0 ? '+' : ''}${deepDive.netSentiment}%`,
      badgeColor: deepDive.netSentiment >= 0 ? emeraldColor : roseColor,
      badgeBg: deepDive.netSentiment >= 0 ? [236, 253, 245] : [254, 242, 242],
      mainValue: `${deepDive.netSentiment >= 0 ? '+' : ''}${deepDive.netSentiment} pts`,
      mainColor: deepDive.netSentiment >= 0 ? emeraldColor : roseColor,
      subDesc: 'Capital político y favorabilidad'
    },
    {
      title: 'RIESGO / DESGASTE',
      badge: `${negRate}%`,
      badgeColor: roseColor,
      badgeBg: [254, 242, 242],
      mainValue: `${deepDive.neg.toLocaleString()} notas`,
      mainColor: roseColor,
      subDesc: 'Señalamientos críticos y alertas'
    },
    {
      title: 'LOGROS / AFINIDAD',
      badge: `${posRate}%`,
      badgeColor: emeraldColor,
      badgeBg: [236, 253, 245],
      mainValue: `${deepDive.pos.toLocaleString()} notas`,
      mainColor: emeraldColor,
      subDesc: 'Impactos positivos capitalizables'
    },
    {
      title: 'VOLUMEN TOTAL',
      badge: '100%',
      badgeColor: cyanAccent,
      badgeBg: [236, 254, 255],
      mainValue: `${deepDive.total.toLocaleString()} notas`,
      mainColor: slateDark,
      subDesc: `${neuRate}% cobertura neutral`
    }
  ];

  kpis.forEach((kpi, idx) => {
    const cardX = margin + idx * (kpiCardWidth + 2);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(cardX, y, kpiCardWidth, kpiCardHeight, 2, 2, 'FD');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
    doc.text(kpi.title, cardX + 3, y + 4.5);

    // Badge
    doc.setFillColor(kpi.badgeBg[0], kpi.badgeBg[1], kpi.badgeBg[2]);
    doc.roundedRect(cardX + kpiCardWidth - 14, y + 2.5, 11, 3.8, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(kpi.badgeColor[0], kpi.badgeColor[1], kpi.badgeColor[2]);
    doc.text(kpi.badge, cardX + kpiCardWidth - 8.5, y + 5.2, { align: 'center' });

    // Main Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(kpi.mainColor[0], kpi.mainColor[1], kpi.mainColor[2]);
    doc.text(kpi.mainValue, cardX + 3, y + 12);

    // Sub Description
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
    const subLines = doc.splitTextToSize(kpi.subDesc, kpiCardWidth - 6);
    doc.text(subLines[0] || '', cardX + 3, y + 17.5);
  });

  y += kpiCardHeight + 5;

  // 3. Evolución Temporal del Clima Político y Ciclo de Vida (Chart)
  const chartBoxHeight = 65;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
  doc.roundedRect(margin, y, contentWidth, chartBoxHeight, 2.5, 2.5, 'FD');

  // Chart Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(navyBg[0], navyBg[1], navyBg[2]);
  doc.text(`Evolución Temporal del Clima Político: ${entityName}`, margin + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
  doc.text('Barras de volumen diario por calificación y curva de Balance Político Neto (%)', margin + 4, y + 10);

  // Legend
  const legendItems: Array<{ label: string; color: RGB }> = [
    { label: 'Positivas', color: emeraldColor },
    { label: 'Neutrales', color: [148, 163, 184] },
    { label: 'Alertas (Crítica)', color: roseColor },
    { label: 'Balance Neto', color: cyanAccent }
  ];
  let legendX = pageWidth - margin - 4;
  for (let i = legendItems.length - 1; i >= 0; i--) {
    const item = legendItems[i];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
    legendX -= doc.getTextWidth(item.label) + 2;
    doc.text(item.label, legendX + 2, y + 8.5);

    legendX -= 5;
    doc.setFillColor(item.color[0], item.color[1], item.color[2]);
    doc.rect(legendX, y + 6.2, 3.5, 2.8, 'F');
    legendX -= 3;
  }

  // Draw Vector Chart
  const timeline = deepDive.timeline && deepDive.timeline.length > 0 ? deepDive.timeline : [];
  const chartAreaX = margin + 12;
  const chartAreaY = y + 15;
  const chartAreaW = contentWidth - 24;
  const chartAreaH = chartBoxHeight - 24;

  // Find max total in timeline
  const maxDayTotal = Math.max(1, ...timeline.map((t) => t.total));

  // Draw Horizontal Gridlines
  doc.setDrawColor(241, 245, 249);
  doc.setLineWidth(0.2);
  for (let g = 0; g <= 4; g++) {
    const gridY = chartAreaY + (chartAreaH / 4) * g;
    doc.line(chartAreaX, gridY, chartAreaX + chartAreaW, gridY);

    const valLabel = Math.round(maxDayTotal * (1 - g / 4));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
    doc.text(String(valLabel), chartAreaX - 2, gridY + 1.5, { align: 'right' });
  }

  // Draw Bars & Line Points
  if (timeline.length > 0) {
    const colStep = chartAreaW / timeline.length;
    const barWidth = Math.max(2, Math.min(10, colStep * 0.65));
    const linePoints: Array<{ x: number; y: number; val: number }> = [];

    timeline.forEach((item, idx) => {
      const centerX = chartAreaX + idx * colStep + colStep / 2;
      const barX = centerX - barWidth / 2;

      const posH = (item.pos / maxDayTotal) * chartAreaH;
      const neuH = (item.neu / maxDayTotal) * chartAreaH;
      const negH = (item.neg / maxDayTotal) * chartAreaH;

      let currentBottom = chartAreaY + chartAreaH;

      // Positives bar (bottom)
      if (posH > 0) {
        doc.setFillColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
        doc.rect(barX, currentBottom - posH, barWidth, posH, 'F');
        currentBottom -= posH;
      }

      // Neutral bar (middle)
      if (neuH > 0) {
        doc.setFillColor(203, 213, 225);
        doc.rect(barX, currentBottom - neuH, barWidth, neuH, 'F');
        currentBottom -= neuH;
      }

      // Negative bar (top)
      if (negH > 0) {
        doc.setFillColor(roseColor[0], roseColor[1], roseColor[2]);
        doc.rect(barX, currentBottom - negH, barWidth, negH, 'F');
      }

      // Net Sentiment point (-100% to +100% mapped to 0 to chartAreaH)
      const netPct = Math.max(-100, Math.min(100, item.netSentiment));
      const netY = chartAreaY + chartAreaH / 2 - (netPct / 200) * chartAreaH;
      linePoints.push({ x: centerX, y: netY, val: item.netSentiment });

      // Date Label below axis (field is fecha in PoliticalTimelinePoint)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
      const dateParts = (item.fecha || '').split('-');
      const shortDate = dateParts.length >= 3 ? `${dateParts[2]}/${dateParts[1]}` : item.fecha || '';
      doc.text(shortDate, centerX, chartAreaY + chartAreaH + 4, { align: 'center' });
    });

    // Draw Connected Line for Balance Neto
    if (linePoints.length > 1) {
      doc.setDrawColor(cyanAccent[0], cyanAccent[1], cyanAccent[2]);
      doc.setLineWidth(0.8);
      for (let p = 0; p < linePoints.length - 1; p++) {
        doc.line(linePoints[p].x, linePoints[p].y, linePoints[p + 1].x, linePoints[p + 1].y);
      }
    }

    // Draw Data Points on Line
    linePoints.forEach((pt) => {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(cyanAccent[0], cyanAccent[1], cyanAccent[2]);
      doc.setLineWidth(0.6);
      doc.circle(pt.x, pt.y, 1.2, 'FD');
    });
  }

  y += chartBoxHeight + 5;

  // 4. Two Columns: Incidencia por Ejes de Gobierno & Radar de Medios
  const colWidth = (contentWidth - 5) / 2;
  const colHeight = 72;

  // Left Column: Incidencia Temática / Políticas Públicas
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
  doc.roundedRect(margin, y, colWidth, colHeight, 2.5, 2.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(navyBg[0], navyBg[1], navyBg[2]);
  doc.text('Incidencia por Ejes de Gobierno y Temas', margin + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
  doc.text('Desglose temático con balance de favorabilidad y crítica pública', margin + 4, y + 9.5);

  const topThemes = (deepDive.politicalThemes || []).slice(0, 7);
  let themeY = y + 13;

  topThemes.forEach((th) => {
    // Theme Label & count
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(navyBg[0], navyBg[1], navyBg[2]);
    const themeName = doc.splitTextToSize(th.theme.toUpperCase(), colWidth - 25);
    doc.text(themeName[0] || '', margin + 4, themeY + 3);

    // Total notes & Net Score Badge
    const netStr = `${th.netSentiment >= 0 ? '+' : ''}${th.netSentiment}%`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    const scoreColor = th.netSentiment >= 0 ? emeraldColor : roseColor;
    doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
    doc.text(`${th.total} notas  ${netStr}`, margin + colWidth - 4, themeY + 3, { align: 'right' });

    // Multi-segmented bar
    const barW = colWidth - 8;
    const barY = themeY + 4.5;
    const barH = 2.4;

    const pW = (th.pos / Math.max(1, th.total)) * barW;
    const nW = (th.neu / Math.max(1, th.total)) * barW;
    const rW = (th.neg / Math.max(1, th.total)) * barW;

    doc.setFillColor(241, 245, 249);
    doc.rect(margin + 4, barY, barW, barH, 'F');

    let curX = margin + 4;
    if (pW > 0) {
      doc.setFillColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
      doc.rect(curX, barY, pW, barH, 'F');
      curX += pW;
    }
    if (nW > 0) {
      doc.setFillColor(203, 213, 225);
      doc.rect(curX, barY, nW, barH, 'F');
      curX += nW;
    }
    if (rW > 0) {
      doc.setFillColor(roseColor[0], roseColor[1], roseColor[2]);
      doc.rect(curX, barY, rW, barH, 'F');
    }

    themeY += 7.8;
  });

  // Right Column: Radar de Medios / Postura Editorial
  const colRightX = margin + colWidth + 5;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
  doc.roundedRect(colRightX, y, colWidth, colHeight, 2.5, 2.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(navyBg[0], navyBg[1], navyBg[2]);
  doc.text('Radar de Presión Mediática & Sesgo', colRightX + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
  doc.text('Clasificación por tono: afín, balanceado o crítico de fiscalización', colRightX + 4, y + 9.5);

  const topMedios = (deepDive.mediaStance || []).slice(0, 7);
  let medioY = y + 13;

  topMedios.forEach((med) => {
    // Outlet label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(navyBg[0], navyBg[1], navyBg[2]);
    const medName = doc.splitTextToSize(med.medio.toUpperCase(), colWidth - 34);
    doc.text(medName[0] || '', colRightX + 4, medioY + 3);

    // Stance Pill
    const stanceColor: RGB =
      med.stance === 'crítico'
        ? roseColor
        : med.stance === 'afín'
        ? emeraldColor
        : slateMuted;
    const stanceBg: RGB =
      med.stance === 'crítico'
        ? [254, 242, 242]
        : med.stance === 'afín'
        ? [236, 253, 245]
        : [241, 245, 249];

    const stanceLabel =
      med.stance === 'crítico'
        ? 'CRÍTICO'
        : med.stance === 'afín'
        ? 'AFÍN'
        : 'NEUTRAL';

    const stanceW = 25;
    doc.setFillColor(stanceBg[0], stanceBg[1], stanceBg[2]);
    doc.roundedRect(colRightX + colWidth - stanceW - 4, medioY - 0.2, stanceW, 4, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.2);
    doc.setTextColor(stanceColor[0], stanceColor[1], stanceColor[2]);
    doc.text(
      `${stanceLabel} (${med.netSentiment >= 0 ? '+' : ''}${med.netSentiment}%)`,
      colRightX + colWidth - stanceW / 2 - 4,
      medioY + 2.8,
      { align: 'center' }
    );

    // Segmented bar
    const barW = colWidth - 8;
    const barY = medioY + 4.5;
    const barH = 2.4;

    const pW = (med.pos / Math.max(1, med.total)) * barW;
    const nW = (med.neu / Math.max(1, med.total)) * barW;
    const rW = (med.neg / Math.max(1, med.total)) * barW;

    doc.setFillColor(241, 245, 249);
    doc.rect(colRightX + 4, barY, barW, barH, 'F');

    let curX = colRightX + 4;
    if (pW > 0) {
      doc.setFillColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
      doc.rect(curX, barY, pW, barH, 'F');
      curX += pW;
    }
    if (nW > 0) {
      doc.setFillColor(203, 213, 225);
      doc.rect(curX, barY, nW, barH, 'F');
      curX += nW;
    }
    if (rW > 0) {
      doc.setFillColor(roseColor[0], roseColor[1], roseColor[2]);
      doc.rect(curX, barY, rW, barH, 'F');
    }

    medioY += 7.8;
  });

  drawFooter(1, 2);

  // ================= PAGE 2: EXPEDIENTE DE NOTAS RECIENTES =================
  doc.addPage();
  drawHeader(true);

  y = 23;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(navyBg[0], navyBg[1], navyBg[2]);
  doc.text(`EXPEDIENTE DE NOTAS RELEVANTES: ${entityName.toUpperCase()}`, margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
  doc.text(
    `Registro cronológico de notas vinculadas y análisis cualitativo (${deepDive.recentNotes.length} notas analizadas)`,
    margin,
    y + 4.5
  );

  y += 9;

  // Notes List
  const notesToShow = deepDive.recentNotes.slice(0, 10);
  notesToShow.forEach((note, idx) => {
    if (y + 22 > pageHeight - 14) {
      return;
    }

    const noteUrl = formatPdfUrl(note.link);
    const noteBoxHeight = noteUrl ? 21.5 : 18;
    doc.setFillColor(idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
    doc.setLineWidth(0.25);
    doc.roundedRect(margin, y, contentWidth, noteBoxHeight, 1.8, 1.8, 'FD');

    // Sentiment pill
    const sName = (note.calificacion || 'Neutral').toUpperCase();
    let sColor: RGB = slateMuted;
    let sBg: RGB = [241, 245, 249];
    if (sName.includes('POS')) {
      sColor = emeraldColor;
      sBg = [236, 253, 245];
    } else if (sName.includes('NEG')) {
      sColor = roseColor;
      sBg = [254, 242, 242];
    }

    doc.setFillColor(sBg[0], sBg[1], sBg[2]);
    doc.roundedRect(margin + 3, y + 2.2, 14, 4, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.setTextColor(sColor[0], sColor[1], sColor[2]);
    doc.text(sName.includes('POS') ? 'POSITIVA' : sName.includes('NEG') ? 'ALERTA' : 'NEUTRAL', margin + 10, y + 4.9, { align: 'center' });

    // Media
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(navyBg[0], navyBg[1], navyBg[2]);
    const reporteroStr = note.reportero && note.reportero.trim() && note.reportero.toLowerCase() !== 'redacción' ? ` • ${note.reportero.trim()}` : '';
    doc.text(`${note.medio || 'MEDIO'}${reporteroStr}`, margin + 19, y + 4.9);

    // Date & "Ver nota" button on top right
    if (noteUrl) {
      // Date placed to left of button
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.8);
      doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
      doc.text(`Fecha: ${note.fecha || 'N/A'}`, pageWidth - margin - 26, y + 4.9, { align: 'right' });

      // Action Button: "Ver nota ↗"
      const btnW = 22;
      const btnH = 4.2;
      const btnX = pageWidth - margin - btnW - 3;
      const btnY = y + 2.1;

      doc.setFillColor(236, 254, 255); // light cyan
      doc.setDrawColor(6, 182, 212); // cyan
      doc.setLineWidth(0.25);
      doc.roundedRect(btnX, btnY, btnW, btnH, 1, 1, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.8);
      doc.setTextColor(6, 182, 212);
      doc.text('Ver nota ↗', btnX + btnW / 2, btnY + 2.9, { align: 'center' });

      // Clickable link annotation on the button
      doc.link(btnX, btnY, btnW, btnH, { url: noteUrl });
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
      doc.text(`Fecha: ${note.fecha || 'N/A'}`, pageWidth - margin - 4, y + 4.9, { align: 'right' });
    }

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.3);
    doc.setTextColor(navyBg[0], navyBg[1], navyBg[2]);
    const titleText = note.titulo && note.titulo.trim() ? note.titulo : note.resumen;
    const titleLines = doc.splitTextToSize(titleText, contentWidth - 8);
    doc.text(titleLines[0] || '', margin + 3, y + 9.8);

    // If title has link, make title clickable too
    if (noteUrl) {
      const titleW = Math.min(doc.getTextWidth(titleLines[0] || ''), contentWidth - 8);
      doc.link(margin + 3, y + 7, titleW, 3.8, { url: noteUrl });
    }

    // Resumen excerpt
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
    const summaryLines = doc.splitTextToSize(note.resumen || '', contentWidth - 8);
    doc.text(summaryLines[0] || '', margin + 3, y + 14);

    // Direct link text at the bottom
    if (noteUrl) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.3);
      doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
      doc.text('Enlace a fuente original: ', margin + 3, y + 18.2);

      const prefW = doc.getTextWidth('Enlace a fuente original: ');
      const linkLabel = 'Ver nota en el portal web ↗';
      const linkX = margin + 3 + prefW;

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(6, 182, 212);
      doc.textWithLink(linkLabel, linkX, y + 18.2, { url: noteUrl });

      const linkW = doc.getTextWidth(linkLabel);
      doc.setDrawColor(6, 182, 212);
      doc.setLineWidth(0.2);
      doc.line(linkX, y + 18.7, linkX + linkW, y + 18.7);
      doc.link(linkX - 1, y + 15.5, linkW + 2, 3.8, { url: noteUrl });
    }

    y += noteBoxHeight + 2.2;
  });

  drawFooter(2, 2);

  // Save the PDF
  const safeName = entityName
    .replace(/[^a-zA-Z0-9_\-áéíóúÁÉÍÓÚñÑ]/g, '_')
    .substring(0, 35);
  const fileName = `Reporte_Politico_${safeName}_${new Date().toISOString().split('T')[0]}.pdf`;

  doc.save(fileName);
}
