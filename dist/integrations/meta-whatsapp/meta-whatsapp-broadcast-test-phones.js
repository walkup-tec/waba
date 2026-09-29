"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.META_BROADCAST_TEST_DEFAULT_PHONES = exports.META_BROADCAST_TEST_MAX_PHONES = void 0;
exports.parseMetaBroadcastTestPhones = parseMetaBroadcastTestPhones;
const waba_campaign_oficial_control_phones_1 = require("../../disparos/waba-campaign-oficial-control-phones");
const meta_whatsapp_cloud_recipient_1 = require("./meta-whatsapp-cloud-recipient");
/** Envio de teste no Disparo Cloud: 1 a 5 destinos, nunca exige os 5 preenchidos. */
exports.META_BROADCAST_TEST_MAX_PHONES = 5;
/** Padrão dos 5 campos — os mesmos números de controle da Oficial, inclusive a repetição de 5193388993. */
exports.META_BROADCAST_TEST_DEFAULT_PHONES = waba_campaign_oficial_control_phones_1.OFICIAL_CAMPAIGN_CONTROL_PHONES.slice(0, exports.META_BROADCAST_TEST_MAX_PHONES);
function asPhoneList(raw) {
    if (Array.isArray(raw))
        return raw;
    if (typeof raw === "string")
        return raw.split(/[\n,;]+/);
    if (raw && typeof raw === "object") {
        const row = raw;
        if (Array.isArray(row.phones) || Array.isArray(row.numeros)) {
            return (row.phones || row.numeros);
        }
        const numbered = [];
        for (let index = 1; index <= exports.META_BROADCAST_TEST_MAX_PHONES; index += 1) {
            numbered.push(row[`phone${index}`] ?? row[`numero${index}`] ?? "");
        }
        return numbered;
    }
    return [];
}
/**
 * Lê até 5 campos preenchidos. Vazio não conta. Duplicata (ex.: 5193388993 duas vezes) gera dois envios.
 */
function parseMetaBroadcastTestPhones(raw) {
    const filled = [];
    for (const item of asPhoneList(raw)) {
        const text = String(item ?? "").trim();
        if (!text)
            continue;
        filled.push(text);
        if (filled.length >= exports.META_BROADCAST_TEST_MAX_PHONES)
            break;
    }
    if (!filled.length) {
        return {
            ok: false,
            error: "Informe de 1 a 5 números de WhatsApp para o envio de teste.",
            raw: [],
        };
    }
    const waIds = [];
    for (const text of filled) {
        const got = (0, meta_whatsapp_cloud_recipient_1.normalizeMetaSpreadsheetRecipient)(text);
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
