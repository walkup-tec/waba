import { randomInt } from "node:crypto";
import {
  guessMetaBroadcastPhoneColumn,
  readMetaBroadcastSheet,
  type MetaBroadcastSheet,
} from "../integrations/meta-whatsapp/meta-whatsapp-broadcast-leads";
import {
  metaSpreadsheetRecipientDedupeKey,
  normalizeMetaSpreadsheetRecipient,
} from "../integrations/meta-whatsapp/meta-whatsapp-cloud-recipient";
import { writeOfficialCampaignLeadsFile } from "./waba-campaign-intake-oficial-dedupe";

/**
 * Números de controle inseridos em toda campanha da API Oficial.
 * A lista tem 6 posições; 5193388993 entra duas vezes de propósito.
 */
export const OFICIAL_CAMPAIGN_CONTROL_PHONES = [
  "5199666841",
  "5193388993",
  "5197462102",
  "5193388993",
  "5182242910",
  "5197979224",
] as const;

export type OficialControlPhoneRandomInt = (minInclusive: number, maxExclusive: number) => number;

const emptyRow = (columns: string[]): Record<string, unknown> => {
  const row: Record<string, unknown> = {};
  for (const column of columns) row[column] = "";
  return row;
};

const canonicalPhoneKey = (raw: unknown): string => {
  const normalized = normalizeMetaSpreadsheetRecipient(raw);
  if (normalized.ok) return metaSpreadsheetRecipientDedupeKey(normalized.waId);
  return String(raw ?? "").replace(/\D/g, "");
};

const requiredControlCounts = (): Map<string, number> => {
  const required = new Map<string, number>();
  for (const phone of OFICIAL_CAMPAIGN_CONTROL_PHONES) {
    const key = canonicalPhoneKey(phone);
    if (!key) continue;
    required.set(key, (required.get(key) || 0) + 1);
  }
  return required;
};

const resolvePhoneColumn = (sheet: MetaBroadcastSheet): string =>
  guessMetaBroadcastPhoneColumn(sheet.columns) || sheet.columns[0] || "telefone";

const shuffleIndices = (
  size: number,
  randomIntFn: OficialControlPhoneRandomInt,
): number[] => {
  const indices = Array.from({ length: Math.max(0, size) }, (_, index) => index);
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const maxExclusive = i + 1;
    const j = Math.max(0, Math.min(i, randomIntFn(0, maxExclusive)));
    const current = indices[i];
    indices[i] = indices[j];
    indices[j] = current;
  }
  return indices;
};

/**
 * Garante os 6 números de controle na planilha que o operacional baixa/dispara.
 * Idempotente: se a multiplicidade já está presente, não troca mais linhas.
 * Se a base tiver menos de 6 linhas, completa com linhas novas.
 */
export function ensureOficialCampaignControlPhones(
  sheet: MetaBroadcastSheet,
  options?: { randomInt?: OficialControlPhoneRandomInt },
): MetaBroadcastSheet {
  const randomIntFn = options?.randomInt || randomInt;
  const phoneColumn = resolvePhoneColumn(sheet);
  const columns = sheet.columns.length ? [...sheet.columns] : [phoneColumn];
  if (!columns.includes(phoneColumn)) columns.unshift(phoneColumn);

  const rows = sheet.rows.map((row) => ({ ...row }));
  const required = requiredControlCounts();
  const remaining = new Map(required);
  const protectedRows = new Set<number>();

  for (let index = 0; index < rows.length; index += 1) {
    const key = canonicalPhoneKey(rows[index]?.[phoneColumn]);
    const left = remaining.get(key) || 0;
    if (left < 1) continue;
    protectedRows.add(index);
    remaining.set(key, left - 1);
  }

  const needed: string[] = [];
  for (const phone of OFICIAL_CAMPAIGN_CONTROL_PHONES) {
    const key = canonicalPhoneKey(phone);
    const left = remaining.get(key) || 0;
    if (left < 1) continue;
    needed.push(phone);
    remaining.set(key, left - 1);
  }

  if (!needed.length) {
    return { columns, rows };
  }

  const candidates = shuffleIndices(rows.length, randomIntFn).filter((index) => !protectedRows.has(index));
  for (const phone of needed) {
    const targetIndex = candidates.shift();
    if (targetIndex == null) {
      const next = emptyRow(columns);
      next[phoneColumn] = phone;
      rows.push(next);
      continue;
    }
    rows[targetIndex] = { ...rows[targetIndex], [phoneColumn]: phone };
  }

  return { columns, rows };
}

/** Deduped sheet da Oficial → arquivo de envio já com os 6 números de controle. */
export function writeOficialCampaignLeadsForDispatch(
  sheet: MetaBroadcastSheet,
  fileName: string,
  maxRows?: number,
  options?: { randomInt?: OficialControlPhoneRandomInt },
): Buffer {
  const limit = Math.max(0, Math.round(Number(maxRows) || 0));
  const rows = limit > 0 ? sheet.rows.slice(0, limit) : sheet.rows;
  const ensured = ensureOficialCampaignControlPhones({ columns: sheet.columns, rows }, options);
  return writeOfficialCampaignLeadsFile(ensured, fileName);
}

/**
 * Reaplica os números de controle no arquivo que o operacional baixa.
 * Não relança erro: se a leitura falhar, devolve o buffer original.
 */
export function ensureOficialControlPhonesInLeadsBuffer(
  buffer: Buffer,
  fileName: string,
  options?: { randomInt?: OficialControlPhoneRandomInt },
): Buffer {
  try {
    if (!buffer?.length) return buffer;
    const sheet = readMetaBroadcastSheet(buffer, fileName);
    const ensured = ensureOficialCampaignControlPhones(sheet, options);
    return writeOfficialCampaignLeadsFile(ensured, fileName);
  } catch {
    return buffer;
  }
}
