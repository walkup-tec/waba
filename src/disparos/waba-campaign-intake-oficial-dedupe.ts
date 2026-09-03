import * as XLSX from "xlsx";
import {
  guessMetaBroadcastPhoneColumn,
  readMetaBroadcastSheet,
  type MetaBroadcastSheet,
} from "../integrations/meta-whatsapp/meta-whatsapp-broadcast-leads";
import {
  metaSpreadsheetRecipientDedupeKey,
  normalizeMetaSpreadsheetRecipient,
} from "../integrations/meta-whatsapp/meta-whatsapp-cloud-recipient";
import { isCampaignLeadsTxtFileName } from "./waba-campaign-spreadsheet.util";

export type OfficialCampaignLeadsDedupe = {
  buffer: Buffer;
  uniqueCount: number;
  duplicatesRemoved: number;
};

export type OfficialCampaignLeadsUniqueSheet = {
  sheet: MetaBroadcastSheet;
  uniqueCount: number;
  duplicatesRemoved: number;
};

function rowDedupeKey(row: Record<string, unknown>, phoneColumn: string): string {
  const raw = phoneColumn ? row[phoneColumn] : "";
  const normalized = normalizeMetaSpreadsheetRecipient(raw);
  if (normalized.ok) return metaSpreadsheetRecipientDedupeKey(normalized.waId);
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits || "";
}

function uniqueOfficialLeadRows(sheet: MetaBroadcastSheet): {
  rows: Record<string, unknown>[];
  duplicatesRemoved: number;
} {
  const phoneColumn = guessMetaBroadcastPhoneColumn(sheet.columns);
  const seen = new Set<string>();
  const rows: Record<string, unknown>[] = [];
  let duplicatesRemoved = 0;
  for (const row of sheet.rows) {
    const key = rowDedupeKey(row, phoneColumn);
    if (!key) continue;
    if (seen.has(key)) {
      duplicatesRemoved += 1;
      continue;
    }
    seen.add(key);
    rows.push(row);
  }
  return { rows, duplicatesRemoved };
}

function writeOfficialLeadsSheet(sheet: MetaBroadcastSheet, fileName: string): Buffer {
  if (isCampaignLeadsTxtFileName(fileName)) {
    if (sheet.columns.length <= 1) {
      const column = sheet.columns[0] || "telefone";
      const lines = sheet.rows.map((row) => String(row[column] ?? "").trim()).filter(Boolean);
      return Buffer.from(lines.length ? `${lines.join("\n")}\n` : "", "utf8");
    }
    const header = sheet.columns.join(";");
    const lines = sheet.rows.map((row) =>
      sheet.columns.map((column) => String(row[column] ?? "").trim()).join(";"),
    );
    return Buffer.from(`${[header, ...lines].join("\n")}\n`, "utf8");
  }
  const nextSheet = XLSX.utils.json_to_sheet(sheet.rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, nextSheet, "Leads");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

/** API Oficial: 1 telefone por campanha (mesmo número com/sem 9º dígito). */
export function parseOfficialCampaignLeadsUnique(
  buffer: Buffer,
  fileName: string,
): OfficialCampaignLeadsUniqueSheet {
  const sheet = readMetaBroadcastSheet(buffer, fileName);
  const unique = uniqueOfficialLeadRows(sheet);
  return {
    sheet: { columns: sheet.columns, rows: unique.rows },
    uniqueCount: unique.rows.length,
    duplicatesRemoved: unique.duplicatesRemoved,
  };
}

export function writeOfficialCampaignLeadsFile(
  sheet: MetaBroadcastSheet,
  fileName: string,
  maxRows?: number,
): Buffer {
  const limit = Math.max(0, Math.round(Number(maxRows) || 0));
  const rows = limit > 0 ? sheet.rows.slice(0, limit) : sheet.rows;
  return writeOfficialLeadsSheet({ columns: sheet.columns, rows }, fileName);
}

export function dedupeOfficialCampaignLeadsFile(
  buffer: Buffer,
  fileName: string,
  maxRows?: number,
): OfficialCampaignLeadsDedupe {
  const unique = parseOfficialCampaignLeadsUnique(buffer, fileName);
  return {
    buffer: writeOfficialCampaignLeadsFile(unique.sheet, fileName, maxRows),
    uniqueCount: unique.uniqueCount,
    duplicatesRemoved: unique.duplicatesRemoved,
  };
}
