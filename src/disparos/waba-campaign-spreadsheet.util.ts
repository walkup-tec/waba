import * as XLSX from "xlsx";

/** Extensões aceitas no intake de leads (wizard API Oficial). */
export const CAMPAIGN_LEADS_ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".txt"] as const;

export const isCampaignLeadsFileName = (fileName: string): boolean => {
  const lower = String(fileName || "").trim().toLowerCase();
  return CAMPAIGN_LEADS_ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
};

export const isCampaignLeadsTxtFileName = (fileName: string): boolean =>
  String(fileName || "").trim().toLowerCase().endsWith(".txt");

/** Conta linhas não vazias de um TXT (um contato por linha). */
export function countTxtImportedRows(buffer: Buffer): number {
  const text = buffer.toString("utf8");
  if (!text.trim()) return 0;
  return text
    .split(/\r\n|\n|\r/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

/** Mantém as primeiras `maxRows` linhas não vazias do TXT. */
export function trimTxtBufferToRowCount(buffer: Buffer, maxRows: number): Buffer {
  const rowLimit = Math.max(0, Math.round(Number(maxRows) || 0));
  const text = buffer.toString("utf8");
  const lines = text
    .split(/\r\n|\n|\r/)
    .map((line) => line.trim())
    .filter(Boolean);
  const trimmed = rowLimit > 0 ? lines.slice(0, rowLimit) : [];
  return Buffer.from(`${trimmed.join("\n")}${trimmed.length ? "\n" : ""}`, "utf8");
}

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

/** Conta leads conforme extensão do arquivo (.xlsx/.xls ou .txt). */
export function countLeadsImportedRows(buffer: Buffer, fileName: string): number {
  if (isCampaignLeadsTxtFileName(fileName)) {
    return countTxtImportedRows(buffer);
  }
  return countSpreadsheetImportedRows(buffer);
}

/** Corta o arquivo de leads ao limite de envios, preservando o tipo (Excel→xlsx / TXT→txt). */
export function trimLeadsBufferToRowCount(
  buffer: Buffer,
  maxRows: number,
  fileName: string,
): Buffer {
  if (isCampaignLeadsTxtFileName(fileName)) {
    return trimTxtBufferToRowCount(buffer, maxRows);
  }
  return trimSpreadsheetBufferToRowCount(buffer, maxRows);
}
