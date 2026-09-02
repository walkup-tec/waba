import * as XLSX from "xlsx";
import { isCampaignLeadsTxtFileName } from "../../disparos/waba-campaign-spreadsheet.util";
import {
  metaSpreadsheetRecipientDedupeKey,
  normalizeMetaSpreadsheetRecipient,
} from "./meta-whatsapp-cloud-recipient";
import type { MetaBroadcastBodyVariable } from "./meta-whatsapp-broadcast-template";
import type { MetaBroadcastLead } from "./meta-whatsapp-broadcast.store";

export const META_BROADCAST_MAX_LEADS = 5000;

export type MetaBroadcastSheet = {
  columns: string[];
  rows: Record<string, unknown>[];
};

export type MetaBroadcastLeadMapping = {
  phoneColumn: string;
  nomeColumn?: string;
  numeroColumn?: string;
  textoColumn?: string;
};

export type MetaBroadcastInvalidLead = {
  raw: string;
  error: string;
};

export type MetaBroadcastParseResult = {
  leads: MetaBroadcastLead[];
  invalid: MetaBroadcastInvalidLead[];
  duplicatesRemoved: number;
  truncated: boolean;
  samples: {
    valid: Array<{ raw: string; waId: string }>;
    invalid: MetaBroadcastInvalidLead[];
  };
};

const PHONE_HEADER_RE = /^(telefone|phone|celular|whatsapp|whats|mobile|tel|n[uú]mero|numero|destino)$/i;
const NAME_HEADER_RE = /^(nome|name|cliente|contato|lead)$/i;
const NUMERO_VAR_HEADER_RE = /^(n[uú]mero|numero|protocolo|pedido|os)$/i;

function cellLabel(raw: unknown): string {
  return String(raw ?? "").trim().slice(0, 80);
}

function uniqueColumns(headers: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const header of headers) {
    const name = String(header || "").trim() || "coluna";
    let next = name;
    let n = 2;
    while (seen.has(next)) {
      next = `${name}_${n}`;
      n += 1;
    }
    seen.add(next);
    out.push(next);
  }
  return out;
}

function parseTxtRows(buffer: Buffer): MetaBroadcastSheet {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const lines = text
    .split(/\r\n|\n|\r/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return { columns: ["telefone"], rows: [] };
  const first = lines[0];
  const delimiter = first.includes(";") ? ";" : first.includes("\t") ? "\t" : first.includes(",") ? "," : "";
  if (delimiter) {
    const headers = uniqueColumns(first.split(delimiter).map((item) => item.trim()));
    const looksHeader = headers.some((item) => PHONE_HEADER_RE.test(item) || NAME_HEADER_RE.test(item));
    if (looksHeader) {
      const rows = lines.slice(1).map((line) => {
        const parts = line.split(delimiter);
        const row: Record<string, unknown> = {};
        headers.forEach((header, index) => {
          row[header] = String(parts[index] ?? "").trim();
        });
        return row;
      });
      return { columns: headers, rows };
    }
  }
  return {
    columns: ["telefone"],
    rows: lines.map((line) => ({ telefone: line })),
  };
}

export function readMetaBroadcastSheet(buffer: Buffer, fileName: string): MetaBroadcastSheet {
  if (!buffer?.length) return { columns: [], rows: [] };
  if (isCampaignLeadsTxtFileName(fileName)) {
    return parseTxtRows(buffer);
  }
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { columns: [], rows: [] };
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
  const columns = rows[0] ? Object.keys(rows[0]) : [];
  return { columns, rows };
}

export function guessMetaBroadcastPhoneColumn(columns: string[]): string {
  const list = columns.map((item) => String(item || "").trim()).filter(Boolean);
  const exact = list.find((item) => PHONE_HEADER_RE.test(item));
  if (exact) return exact;
  const fuzzy = list.find((item) => /tel|phone|whats|cel/i.test(item));
  return fuzzy || list[0] || "";
}

export function guessMetaBroadcastNomeColumn(columns: string[]): string {
  return columns.map((item) => String(item || "").trim()).find((item) => NAME_HEADER_RE.test(item)) || "";
}

export function guessMetaBroadcastNumeroColumn(columns: string[], phoneColumn: string): string {
  return (
    columns
      .map((item) => String(item || "").trim())
      .find((item) => item !== phoneColumn && NUMERO_VAR_HEADER_RE.test(item)) || ""
  );
}

function mappingNeeded(bodyVariables: MetaBroadcastBodyVariable[], key: MetaBroadcastBodyVariable["key"]): boolean {
  return bodyVariables.some((item) => item.key === key);
}

export function parseMetaBroadcastLeads(input: {
  sheet: MetaBroadcastSheet;
  mapping: MetaBroadcastLeadMapping;
  bodyVariables?: MetaBroadcastBodyVariable[];
  maxLeads?: number;
}): MetaBroadcastParseResult {
  const maxLeads = Math.max(1, Math.round(Number(input.maxLeads) || META_BROADCAST_MAX_LEADS));
  const phoneColumn = String(input.mapping.phoneColumn || "").trim();
  const nomeColumn = String(input.mapping.nomeColumn || "").trim();
  const numeroColumn = String(input.mapping.numeroColumn || "").trim();
  const textoColumn = String(input.mapping.textoColumn || "").trim();
  const needNome = mappingNeeded(input.bodyVariables || [], "nome");
  const needNumero = mappingNeeded(input.bodyVariables || [], "numero");
  const needTexto = mappingNeeded(input.bodyVariables || [], "texto");
  const leads: MetaBroadcastLead[] = [];
  const invalid: MetaBroadcastInvalidLead[] = [];
  const validSamples: Array<{ raw: string; waId: string }> = [];
  const seen = new Set<string>();
  let duplicatesRemoved = 0;
  let truncated = false;

  if (!phoneColumn) {
    return {
      leads: [],
      invalid: [{ raw: "", error: "Selecione a coluna de telefone da planilha." }],
      duplicatesRemoved: 0,
      truncated: false,
      samples: { valid: [], invalid: [{ raw: "", error: "Selecione a coluna de telefone da planilha." }] },
    };
  }

  for (const row of input.sheet.rows) {
    if (leads.length >= maxLeads) {
      truncated = true;
      break;
    }
    const rawPhone = row[phoneColumn];
    const rawLabel = cellLabel(rawPhone);
    const normalized = normalizeMetaSpreadsheetRecipient(rawPhone);
    if (!normalized.ok) {
      if (rawLabel) invalid.push({ raw: rawLabel, error: normalized.error });
      continue;
    }
    const dedupeKey = metaSpreadsheetRecipientDedupeKey(normalized.waId);
    if (seen.has(dedupeKey)) {
      duplicatesRemoved += 1;
      continue;
    }
    seen.add(dedupeKey);
    const lead: MetaBroadcastLead = {
      waId: normalized.waId,
      status: "queued",
    };
    if (needNome) lead.nome = cellLabel(nomeColumn ? row[nomeColumn] : "") || undefined;
    if (needNumero) lead.numero = cellLabel(numeroColumn ? row[numeroColumn] : "") || normalized.waId;
    if (needTexto) lead.texto = cellLabel(textoColumn ? row[textoColumn] : "") || undefined;
    leads.push(lead);
    if (validSamples.length < 8) validSamples.push({ raw: rawLabel || normalized.waId, waId: normalized.waId });
  }

  return {
    leads,
    invalid,
    duplicatesRemoved,
    truncated,
    samples: {
      valid: validSamples,
      invalid: invalid.slice(0, 8),
    },
  };
}
