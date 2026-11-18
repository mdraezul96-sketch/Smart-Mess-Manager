import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { localDb } from '../db/localDb';

export interface ExportColumn {
  header: string;
  key: string;
}

export function exportToExcel(
  filename: string,
  sheetName: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[]
): void {
  const data = rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (const col of columns) {
      obj[col.header] = row[col.key] ?? '';
    }
    return obj;
  });
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToCSV(
  filename: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[]
): void {
  const data = rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (const col of columns) {
      obj[col.header] = row[col.key] ?? '';
    }
    return obj;
  });
  const ws = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToPDF(
  filename: string,
  title: string,
  subtitle: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
  summaryLines: string[] = []
): void {
  const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.setTextColor(23, 54, 93);
  doc.text('Smart Mess Manager', 14, 16);

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 14, 24);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(subtitle, 14, 30);

  let y = 38;
  if (summaryLines.length > 0) {
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    for (const line of summaryLines) {
      doc.text(line, 14, y);
      y += 5;
    }
    y += 3;
  }

  const usableWidth = pageWidth - 28;
  const colWidth = usableWidth / Math.max(1, columns.length);

  // Header row
  doc.setFillColor(23, 54, 93);
  doc.rect(14, y, usableWidth, 8, 'F');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  columns.forEach((col, i) => {
    doc.text(String(col.header).slice(0, 20), 16 + i * colWidth, y + 5.5);
  });
  y += 8;

  doc.setTextColor(15, 23, 42);
  rows.forEach((row, idx) => {
    if (y > doc.internal.pageSize.getHeight() - 16) {
      doc.addPage();
      y = 16;
    }
    if (idx % 2 === 1) {
      doc.setFillColor(244, 247, 251);
      doc.rect(14, y, usableWidth, 7, 'F');
    }
    columns.forEach((col, i) => {
      const val = String(row[col.key] ?? '').slice(0, 24);
      doc.text(val, 16 + i * colWidth, y + 5);
    });
    y += 7;
  });

  doc.save(`${filename}.pdf`);
}

export async function exportFullBackupJSON(): Promise<void> {
  const backup = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    appName: 'Smart Mess Manager',
    data: {
      messSettings: await localDb.messSettings.toArray(),
      rooms: await localDb.rooms.toArray(),
      members: await localDb.members.toArray(),
      mealEntries: await localDb.mealEntries.toArray(),
      expenses: await localDb.expenses.toArray(),
      payments: await localDb.payments.toArray(),
      monthlyClosings: await localDb.monthlyClosings.toArray(),
      monthlyBills: await localDb.monthlyBills.toArray(),
      guests: await localDb.guests.toArray(),
      guestPayments: await localDb.guestPayments.toArray(),
      weeklyMenus: await localDb.weeklyMenus.toArray(),
      notices: await localDb.notices.toArray(),
      auditLogs: await localDb.auditLogs.toArray(),
    },
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `smart-mess-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
