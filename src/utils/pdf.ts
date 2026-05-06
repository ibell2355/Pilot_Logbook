import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Leg, Log, Profile } from '../types';
import {
  computeTotals,
  deriveLegs,
  pilotSummaries
} from './calculations';
import { formatDateFriendly, formatHours, round1 } from './time';
import { sanitizeFilename, saveBlob } from './download';

export interface PdfExportInput {
  log: Log;
  legs: Leg[];
  profile: Profile;
}

const GREEN_HEAD: [number, number, number] = [136, 184, 96]; // muted aviation green
const GREEN_FILL: [number, number, number] = [216, 234, 199]; // pale green for highlighted cells
const GREY_FILL: [number, number, number] = [222, 222, 222];
const BORDER: [number, number, number] = [120, 120, 120];

/**
 * Render a Pilot Daily Flight Notes report styled after the pilot's Excel
 * reference: title block with Aircraft / Date / Inspection grid on top,
 * Hobbs Start / TAFT / Hook Time as a left labeled column, leg table with
 * green-highlighted Air Time and Flight Time columns, and pilot summaries.
 */
export async function exportLogPdf({ log, legs, profile }: PdfExportInput): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;

  // ────────────────────────── HEADER GRID ──────────────────────────
  // Two-row header: title spans top, then a 5-col inspection grid below it.
  // Column widths (in pt) – tuned so the title sits on the left and the
  // Aircraft / Date row + Inspection columns mirror the Excel reference.
  const inspectColCount = 5;
  const inspectColW = 78;
  const titleW = contentWidth - inspectColW * inspectColCount;
  const headerY = 36;

  // Title cell
  drawCell(doc, margin, headerY, titleW, 36, {
    fill: [255, 255, 255],
    border: BORDER
  });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20);
  doc.text('Pilot Daily Flight Notes', margin + titleW / 2, headerY + 24, {
    align: 'center'
  });

  // Aircraft / Date row inside the inspection grid (top row, 2 columns + 3 placeholders)
  // We'll mirror the reference more literally:
  //   [ Aircraft label | Aircraft value | Date label | Date value (spans 2) ]
  const gridX = margin + titleW;
  const cellH = 18;
  const r1Y = headerY;
  // Aircraft label
  drawCell(doc, gridX, r1Y, inspectColW, cellH, { fill: GREY_FILL, border: BORDER });
  drawLabel(doc, 'Aircraft', gridX + inspectColW / 2, r1Y + 12, 'center');
  // Aircraft value
  drawCell(doc, gridX + inspectColW, r1Y, inspectColW, cellH, { fill: [255, 255, 255], border: BORDER });
  drawValue(doc, log.aircraft || '—', gridX + inspectColW + inspectColW / 2, r1Y + 12, 'center');
  // Date label
  drawCell(doc, gridX + inspectColW * 2, r1Y, inspectColW, cellH, { fill: GREY_FILL, border: BORDER });
  drawLabel(doc, 'Date', gridX + inspectColW * 2 + inspectColW / 2, r1Y + 12, 'center');
  // Date value – span 2 columns
  drawCell(doc, gridX + inspectColW * 3, r1Y, inspectColW * 2, cellH, { fill: [255, 255, 255], border: BORDER });
  drawValue(
    doc,
    formatDateFriendly(log.date) || '—',
    gridX + inspectColW * 3 + inspectColW,
    r1Y + 12,
    'center'
  );

  // Inspection labels row (below the Aircraft/Date row, still inside the grid)
  const r2Y = r1Y + cellH;
  // Col 1: "Next Inspection" stack label (taller cell, spans rows 2 and 3)
  const inspectCellH = 36;
  drawCell(doc, gridX, r2Y, inspectColW, inspectCellH, {
    fill: GREEN_FILL,
    border: BORDER
  });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(40);
  doc.text('Next', gridX + inspectColW / 2, r2Y + 14, { align: 'center' });
  doc.text('Inspection', gridX + inspectColW / 2, r2Y + 26, { align: 'center' });

  // Cols 2..5: small label cells (row 2)
  const labels = ['Due at (Hobbs)', 'Minus 10', 'Due in', 'Plus 10'];
  labels.forEach((label, i) => {
    const x = gridX + inspectColW * (i + 1);
    drawCell(doc, x, r2Y, inspectColW, cellH, { fill: GREY_FILL, border: BORDER });
    drawLabel(doc, label, x + inspectColW / 2, r2Y + 12, 'center');
  });

  // Inspection values row
  const r3Y = r2Y + cellH;
  const dueAt = log.hobbsDueAt;
  const totals = computeTotals(log, legs);
  const currentHobbs = totals.currentHobbs;
  const minus10 = dueAt != null ? round1(dueAt - 10) : null;
  const plus10 = dueAt != null ? round1(dueAt + 10) : null;
  const dueIn =
    dueAt != null && currentHobbs != null ? round1(dueAt - currentHobbs) : null;

  const values: (string | null)[] = [
    dueAt != null ? formatHours(dueAt) : null,
    minus10 != null ? formatHours(minus10) : null,
    dueIn != null ? formatHours(dueIn) : null,
    plus10 != null ? formatHours(plus10) : null
  ];
  values.forEach((v, i) => {
    const x = gridX + inspectColW * (i + 1);
    // Highlight the "Due in" cell if dueIn is set, like the reference's bold cell
    const fill = i === 2 && dueIn != null ? GREEN_FILL : ([255, 255, 255] as [number, number, number]);
    drawCell(doc, x, r3Y, inspectColW, cellH, { fill, border: BORDER });
    drawValue(doc, v ?? '—', x + inspectColW / 2, r3Y + 12, 'center');
  });

  // ────────────────────────── LEFT-COLUMN HOBBS / TAFT / HOOK BLOCK ──────────────────────────
  // Below the title cell, mirroring the reference's left side: three labeled rows.
  const leftBlockY = headerY + 36; // starts where the title cell ends
  const leftLabelW = 90;
  const leftValueW = titleW - leftLabelW;
  const rows: { label: string; value: string }[] = [
    { label: 'Hobbs Start', value: log.hobbsStart != null ? formatHours(log.hobbsStart) : '—' },
    { label: 'TAFT', value: log.taft != null ? formatHours(log.taft) : '—' },
    { label: 'Hook Time', value: log.hookTime != null ? formatHours(log.hookTime) : '—' }
  ];
  rows.forEach((r, i) => {
    const y = leftBlockY + i * cellH;
    drawCell(doc, margin, y, leftLabelW, cellH, { fill: GREY_FILL, border: BORDER });
    drawLabel(doc, r.label, margin + 8, y + 12, 'left');
    drawCell(doc, margin + leftLabelW, y, leftValueW, cellH, { fill: [255, 255, 255], border: BORDER });
    drawValue(doc, r.value, margin + leftLabelW + 12, y + 12, 'left');
  });

  // The bottom of header is whichever block reaches further down.
  const headerBottom = Math.max(
    r3Y + cellH,
    leftBlockY + rows.length * cellH
  );

  // Generous gap before the table so no divider intersects label text.
  const tableStartY = headerBottom + 18;

  // ────────────────────────── LEG TABLE ──────────────────────────
  const derived = deriveLegs(log, legs);
  autoTable(doc, {
    startY: tableStartY,
    margin: { left: margin, right: margin },
    head: [[
      'Pilot',
      'From',
      'To',
      'Hobbs Reading',
      'Air Time',
      'Landings',
      'Start Up',
      'Shutdown',
      'Flight Time'
    ]],
    body: legs.map((leg, i) => [
      leg.pilot || '',
      leg.from || '',
      leg.to || '',
      leg.hobbsReading != null ? formatHours(leg.hobbsReading) : '',
      derived[i]?.airTime != null ? formatHours(derived[i].airTime!) : '',
      String(leg.landings || 0),
      String(leg.startUpCount || 0),
      String(leg.shutdownCount || 0),
      derived[i]?.flightTime != null ? formatHours(derived[i].flightTime!) : ''
    ]),
    foot: [[
      'Totals',
      '',
      '',
      '',
      formatHours(totals.totalAirTime),
      String(totals.totalLandings),
      String(totals.totalStartUps),
      String(totals.totalShutdowns),
      formatHours(totals.totalFlightTime)
    ]],
    styles: {
      font: 'helvetica',
      fontSize: 9.5,
      cellPadding: 5,
      overflow: 'linebreak',
      valign: 'middle',
      lineColor: BORDER,
      lineWidth: 0.4
    },
    headStyles: {
      fillColor: GREEN_HEAD,
      textColor: 20,
      fontStyle: 'bold',
      halign: 'center'
    },
    footStyles: {
      fillColor: GREEN_FILL,
      textColor: 20,
      fontStyle: 'bold'
    },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { fontStyle: 'bold' },
      3: { halign: 'right' },
      4: { halign: 'right', fillColor: GREEN_FILL, fontStyle: 'bold' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right', fillColor: GREEN_FILL, fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      // Keep totals row's totals cells emphasised in green
      if (data.section === 'foot') {
        if (data.column.index === 4 || data.column.index === 8) {
          data.cell.styles.fillColor = GREEN_HEAD;
          data.cell.styles.textColor = 255;
        }
      }
    }
  });

  let finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? tableStartY + 200;
  finalY += 18;

  // ────────────────────────── END-OF-DAY + PILOT SUMMARIES ──────────────────────────
  // Two-column layout under the table: left = end of day totals, right = pilot summary.
  const halfW = (contentWidth - 12) / 2;

  // Left card
  const eodRows: { label: string; value: string; emphasis?: boolean }[] = [
    {
      label: 'Total Air Time',
      value: formatHours(totals.totalAirTime),
      emphasis: true
    },
    {
      label: 'Total Flight Time',
      value: formatHours(totals.totalFlightTime),
      emphasis: true
    },
    {
      label: 'TAFT End',
      value: totals.taftEnd != null ? formatHours(totals.taftEnd) : '—'
    },
    {
      label: 'Hook Time End',
      value: totals.hookTimeEnd != null ? formatHours(totals.hookTimeEnd) : '—'
    }
  ];
  drawSectionTitle(doc, 'End of day', margin, finalY);
  let y = finalY + 6;
  eodRows.forEach((row) => {
    drawCell(doc, margin, y, leftLabelW, cellH, { fill: GREY_FILL, border: BORDER });
    drawLabel(doc, row.label, margin + 8, y + 12, 'left');
    drawCell(doc, margin + leftLabelW, y, halfW - leftLabelW, cellH, {
      fill: row.emphasis ? GREEN_FILL : [255, 255, 255],
      border: BORDER
    });
    drawValue(doc, row.value, margin + halfW - 8, y + 12, 'right');
    y += cellH;
  });

  // Right card – pilot summaries
  const summaries = pilotSummaries(log, legs);
  const rightX = margin + halfW + 12;
  drawSectionTitle(doc, 'Pilot summaries', rightX, finalY);

  if (summaries.length === 0) {
    drawCell(doc, rightX, finalY + 6, halfW, cellH, { fill: [255, 255, 255], border: BORDER });
    drawValue(doc, 'No pilots entered yet', rightX + 8, finalY + 18, 'left');
  } else {
    // Header row
    let py = finalY + 6;
    const colP = halfW * 0.5;
    const colA = halfW * 0.25;
    const colF = halfW * 0.25;
    drawCell(doc, rightX, py, colP, cellH, { fill: GREEN_HEAD, border: BORDER });
    drawCell(doc, rightX + colP, py, colA, cellH, { fill: GREEN_HEAD, border: BORDER });
    drawCell(doc, rightX + colP + colA, py, colF, cellH, { fill: GREEN_HEAD, border: BORDER });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(20);
    doc.text('Pilot', rightX + 8, py + 12, { align: 'left' });
    doc.text('Air Time', rightX + colP + colA - 8, py + 12, { align: 'right' });
    doc.text('Flight Time', rightX + colP + colA + colF - 8, py + 12, { align: 'right' });
    py += cellH;

    summaries.forEach((s, i) => {
      const fill = i % 2 === 0 ? ([255, 255, 255] as [number, number, number]) : ([245, 245, 245] as [number, number, number]);
      drawCell(doc, rightX, py, colP, cellH, { fill, border: BORDER });
      drawCell(doc, rightX + colP, py, colA, cellH, { fill: GREEN_FILL, border: BORDER });
      drawCell(doc, rightX + colP + colA, py, colF, cellH, { fill: GREEN_FILL, border: BORDER });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(20);
      doc.text(s.pilot, rightX + 8, py + 12, { align: 'left' });
      doc.setFont('helvetica', 'normal');
      doc.text(formatHours(s.airTime), rightX + colP + colA - 8, py + 12, { align: 'right' });
      doc.text(formatHours(s.flightTime), rightX + colP + colA + colF - 8, py + 12, { align: 'right' });
      py += cellH;
    });
  }

  // Pilot name footer (centered), no timestamps / IDs / dev wording.
  if (profile.pilotName) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(profile.pilotName, pageWidth / 2, doc.internal.pageSize.getHeight() - 18, {
      align: 'center'
    });
  }

  const filename = `${sanitizeFilename(log.title)}.pdf`;
  const blob = doc.output('blob');
  saveBlob(blob, filename);
}

function drawCell(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { fill: [number, number, number]; border: [number, number, number] }
): void {
  doc.setDrawColor(opts.border[0], opts.border[1], opts.border[2]);
  doc.setFillColor(opts.fill[0], opts.fill[1], opts.fill[2]);
  doc.setLineWidth(0.4);
  doc.rect(x, y, w, h, 'FD');
}

function drawLabel(
  doc: jsPDF,
  label: string,
  x: number,
  y: number,
  align: 'left' | 'center' | 'right' = 'left'
): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(40);
  doc.text(label, x, y, { align });
}

function drawValue(
  doc: jsPDF,
  value: string,
  x: number,
  y: number,
  align: 'left' | 'center' | 'right' = 'left'
): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text(value, x, y, { align });
}

function drawSectionTitle(doc: jsPDF, title: string, x: number, y: number): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(40);
  doc.text(title, x, y);
}
