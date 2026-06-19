import * as XLSX from "xlsx";

/** Conta linhas de dados da primeira aba (mesma regra do preview no painel). */
export function countSpreadsheetImportedRows(buffer: Buffer): number {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return 0;
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return rows.length;
}

/** Mantém somente as primeiras `maxRows` linhas de dados da primeira aba. */
export function trimSpreadsheetBufferToRowCount(buffer: Buffer, maxRows: number): Buffer {
  const rowLimit = Math.max(0, Math.round(Number(maxRows) || 0));
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0] || "Leads";
  const sheet = wb.Sheets[sheetName];
  const rows = sheet
    ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })
    : [];
  const trimmedRows = rowLimit > 0 ? rows.slice(0, rowLimit) : [];
  const nextSheet = XLSX.utils.json_to_sheet(trimmedRows);
  const nextWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(nextWorkbook, nextSheet, sheetName);
  return Buffer.from(XLSX.write(nextWorkbook, { type: "buffer", bookType: "xlsx" }));
}
