import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Leg, Log, Profile } from '../types';
import { formatDateFriendly, sumDurations } from './time';
import { sanitizeFilename, saveBlob } from './download';

export interface PdfExportInput {
  log: Log;
  legs: Leg[];
  profile: Profile;
}

/**
 * Render a practical pilot log PDF. This renderer is intentionally isolated so
 * it can later be swapped for a company-specific template without touching the
 * rest of the app.
 */
export async function exportLogPdf({ log, legs, profile }: PdfExportInput): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Pilot Flight Log', margin, 54);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const headerLines = buildHeaderLines(profile, log, legs);
  let y = 76;
  for (const line of headerLines) {
    doc.text(line, margin, y);
    y += 14;
  }

  const totalTime = sumDurations(legs.map((l) => l.totalFlightTime)) || '0:00';
  const actualInst = sumDurations(legs.map((l) => l.actualInstrument)) || '0:00';
  const simInst = sumDurations(legs.map((l) => l.simulatedInstrument)) || '0:00';

  doc.setFont('helvetica', 'bold');
  doc.text(
    `Total flight time: ${totalTime}   ·   Actual IFR: ${actualInst}   ·   Simulated IFR: ${simInst}`,
    margin,
    y + 4
  );

  autoTable(doc, {
    startY: y + 18,
    margin: { left: margin, right: margin },
    head: [[
      '#',
      'Date',
      'Aircraft',
      'Reg.',
      'Route',
      'Dep',
      'Arr',
      'Total',
      'Role',
      'D/N',
      'Rules',
      'Act. IFR',
      'Sim. IFR',
      'Co-pilot',
      'Remarks'
    ]],
    body: legs.map((leg, i) => [
      String(i + 1),
      leg.date,
      leg.aircraftType || '',
      leg.aircraftReg || '',
      `${leg.depLocation || ''} → ${leg.arrLocation || ''}`,
      leg.depTime || '',
      leg.arrTime || '',
      leg.totalFlightTime || '',
      leg.role || '',
      leg.dayNight || '',
      leg.flightRules || '',
      leg.actualInstrument || '',
      leg.simulatedInstrument || '',
      leg.copilot || '',
      leg.remarks || ''
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 4,
      overflow: 'linebreak',
      valign: 'middle'
    },
    headStyles: {
      fillColor: [42, 111, 181],
      textColor: 255,
      fontStyle: 'bold'
    },
    alternateRowStyles: { fillColor: [241, 246, 251] },
    columnStyles: {
      0: { cellWidth: 22, halign: 'right' },
      1: { cellWidth: 62 },
      4: { cellWidth: 100 },
      14: { cellWidth: 'auto' }
    }
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(110);
  doc.text(
    'I certify that the entries above are a true record of the flights described.',
    margin,
    finalY + 36
  );
  doc.line(margin, finalY + 64, margin + 200, finalY + 64);
  doc.text('Pilot signature', margin, finalY + 78);
  doc.line(pageWidth - margin - 200, finalY + 64, pageWidth - margin, finalY + 64);
  doc.text('Date', pageWidth - margin - 200, finalY + 78);
  doc.setTextColor(0);

  const filename = `${sanitizeFilename(log.title)}.pdf`;
  const blob = doc.output('blob');
  saveBlob(blob, filename);
}

function buildHeaderLines(profile: Profile, log: Log, legs: Leg[]): string[] {
  const dates = legs.map((l) => l.date).filter(Boolean).sort();
  const first = dates[0] || log.startDate;
  const last = dates[dates.length - 1] || log.startDate;
  const range =
    first && last && first !== last
      ? `${formatDateFriendly(first)} – ${formatDateFriendly(last)}`
      : formatDateFriendly(first);

  const lines: string[] = [];
  if (profile.pilotName) lines.push(`Pilot: ${profile.pilotName}`);
  const ids: string[] = [];
  if (profile.licenceNumber) ids.push(`Licence ${profile.licenceNumber}`);
  if (profile.employeeNumber) ids.push(`Employee ${profile.employeeNumber}`);
  if (ids.length) lines.push(ids.join('   ·   '));
  const orgLine: string[] = [];
  if (profile.defaultCompany) orgLine.push(`Company: ${profile.defaultCompany}`);
  if (profile.homeBase) orgLine.push(`Home base: ${profile.homeBase}`);
  if (orgLine.length) lines.push(orgLine.join('   ·   '));
  lines.push(`Period: ${range}`);
  return lines;
}
