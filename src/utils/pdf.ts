import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Leg, Log, Profile } from '../types';
import {
  computeTotals,
  deriveLegs,
  maintenanceStatus,
  pilotSummaries
} from './calculations';
import { formatDateFriendly, formatHours } from './time';
import { sanitizeFilename, saveBlob } from './download';

export interface PdfExportInput {
  log: Log;
  legs: Leg[];
  profile: Profile;
}

/**
 * Render a Pilot Daily Flight Notes report. Layout follows the pilot's
 * Excel reference: aircraft + date header, Hobbs/TAFT/Hook block,
 * inspection summary, leg table, totals, and per-pilot air / flight time.
 */
export async function exportLogPdf({ log, legs, profile }: PdfExportInput): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Pilot Daily Flight Notes', pageWidth / 2, 50, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (profile.pilotName) {
    doc.text(profile.pilotName, pageWidth / 2, 66, { align: 'center' });
  }

  // Header row: Aircraft / Date
  let y = 86;
  const headerCol = (pageWidth - margin * 2) / 2;
  drawLabelValue(doc, margin, y, headerCol, 'Aircraft', log.aircraft || '—');
  drawLabelValue(
    doc,
    margin + headerCol,
    y,
    headerCol,
    'Date',
    formatDateFriendly(log.date) || '—'
  );

  y += 28;
  const blockCol = (pageWidth - margin * 2) / 3;
  drawLabelValue(
    doc,
    margin,
    y,
    blockCol,
    'Hobbs Start',
    log.hobbsStart != null ? formatHours(log.hobbsStart) : '—'
  );
  drawLabelValue(
    doc,
    margin + blockCol,
    y,
    blockCol,
    'TAFT',
    log.taft != null ? formatHours(log.taft) : '—'
  );
  drawLabelValue(
    doc,
    margin + blockCol * 2,
    y,
    blockCol,
    'Hook Time',
    log.hookTime != null ? formatHours(log.hookTime) : '—'
  );

  y += 32;
  const totals = computeTotals(log, legs);
  const maint = maintenanceStatus(log, totals);

  if (log.hobbsDueAt != null) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(
      `${log.inspectionInterval || 500} Hr Inspection`,
      margin,
      y
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const dueAt = formatHours(log.hobbsDueAt);
    const dueIn = maint.dueIn != null ? formatHours(maint.dueIn) : '—';
    const minus10 = formatHours(log.hobbsDueAt - 10);
    const plus10 = formatHours(log.hobbsDueAt + 10);
    doc.text(
      `Due at: ${dueAt}    Minus 10: ${minus10}    Plus 10: ${plus10}    Due in: ${dueIn}`,
      margin,
      y + 14
    );
    y += 30;
  }

  // Legs table
  const derived = deriveLegs(log, legs);
  autoTable(doc, {
    startY: y + 6,
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
      valign: 'middle'
    },
    headStyles: {
      fillColor: [42, 111, 181],
      textColor: 255,
      fontStyle: 'bold'
    },
    footStyles: {
      fillColor: [220, 232, 245],
      textColor: 30,
      fontStyle: 'bold'
    },
    alternateRowStyles: { fillColor: [241, 246, 251] },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' }
    }
  });

  let finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 200;
  finalY += 24;

  // End-of-day totals block: TAFT End / Hook Time End
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('End of day', margin, finalY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const endLine = [
    `TAFT End: ${totals.taftEnd != null ? formatHours(totals.taftEnd) : '—'}`,
    `Hook Time End: ${totals.hookTimeEnd != null ? formatHours(totals.hookTimeEnd) : '—'}`,
    `Total Air: ${formatHours(totals.totalAirTime)}`,
    `Total Flight: ${formatHours(totals.totalFlightTime)}`
  ].join('     ');
  doc.text(endLine, margin, finalY + 16);
  finalY += 36;

  // Pilot summaries
  const summaries = pilotSummaries(log, legs);
  if (summaries.length > 0) {
    autoTable(doc, {
      startY: finalY,
      margin: { left: margin, right: margin },
      head: [['Pilot', 'Air Time', 'Flight Time']],
      body: summaries.map((s) => [
        s.pilot,
        formatHours(s.airTime),
        formatHours(s.flightTime)
      ]),
      styles: {
        font: 'helvetica',
        fontSize: 10,
        cellPadding: 5
      },
      headStyles: {
        fillColor: [42, 111, 181],
        textColor: 255,
        fontStyle: 'bold'
      },
      tableWidth: 320,
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' }
      }
    });
  }

  const filename = `${sanitizeFilename(log.title)}.pdf`;
  const blob = doc.output('blob');
  saveBlob(blob, filename);
}

function drawLabelValue(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string
): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(label.toUpperCase(), x, y);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text(value, x, y + 16);
  doc.setDrawColor(220);
  doc.line(x, y + 22, x + width - 12, y + 22);
}
