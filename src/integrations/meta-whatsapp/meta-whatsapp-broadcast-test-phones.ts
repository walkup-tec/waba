import { OFICIAL_CAMPAIGN_CONTROL_PHONES } from "../../disparos/waba-campaign-oficial-control-phones";
import { normalizeMetaSpreadsheetRecipient } from "./meta-whatsapp-cloud-recipient";

/** Envio de teste no Disparo Cloud: 1 a 5 destinos, nunca exige os 5 preenchidos. */
export const META_BROADCAST_TEST_MAX_PHONES = 5;

/** Padrão dos 5 campos — os mesmos números de controle da Oficial, inclusive a repetição de 5193388993. */
export const META_BROADCAST_TEST_DEFAULT_PHONES: readonly string[] = OFICIAL_CAMPAIGN_CONTROL_PHONES.slice(
  0,
  META_BROADCAST_TEST_MAX_PHONES,
);

export type MetaBroadcastTestPhoneParseOk = {
  ok: true;
  waIds: string[];
  raw: string[];
};

export type MetaBroadcastTestPhoneParseErr = {
  ok: false;
  error: string;
  raw: string[];
};

export type MetaBroadcastTestPhoneParse = MetaBroadcastTestPhoneParseOk | MetaBroadcastTestPhoneParseErr;

function asPhoneList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") return raw.split(/[\n,;]+/);
  if (raw && typeof raw === "object") {
    const row = raw as Record<string, unknown>;
    if (Array.isArray(row.phones) || Array.isArray(row.numeros)) {
      return (row.phones || row.numeros) as unknown[];
    }
    const numbered: unknown[] = [];
    for (let index = 1; index <= META_BROADCAST_TEST_MAX_PHONES; index += 1) {
      numbered.push(row[`phone${index}`] ?? row[`numero${index}`] ?? "");
    }
    return numbered;
  }
  return [];
}

/**
 * Lê até 5 campos preenchidos. Vazio não conta. Duplicata (ex.: 5193388993 duas vezes) gera dois envios.
 */
export function parseMetaBroadcastTestPhones(raw: unknown): MetaBroadcastTestPhoneParse {
  const filled: string[] = [];
  for (const item of asPhoneList(raw)) {
    const text = String(item ?? "").trim();
    if (!text) continue;
    filled.push(text);
    if (filled.length >= META_BROADCAST_TEST_MAX_PHONES) break;
  }
  if (!filled.length) {
    return {
      ok: false,
      error: "Informe de 1 a 5 números de WhatsApp para o envio de teste.",
      raw: [],
    };
  }
  const waIds: string[] = [];
  for (const text of filled) {
    const got = normalizeMetaSpreadsheetRecipient(text);
    if (!got.ok) {
      return {
        ok: false,
        error: `Número de teste inválido: ${text}. Use DDD + celular (ex.: 5199666841) ou E.164 com DDI 55.`,
        raw: filled,
      };
    }
    waIds.push(got.waId);
  }
  return { ok: true, waIds, raw: filled };
}
