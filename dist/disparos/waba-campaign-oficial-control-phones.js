"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OFICIAL_CAMPAIGN_CONTROL_PHONES = void 0;
exports.ensureOficialCampaignControlPhones = ensureOficialCampaignControlPhones;
exports.writeOficialCampaignLeadsForDispatch = writeOficialCampaignLeadsForDispatch;
exports.ensureOficialControlPhonesInLeadsBuffer = ensureOficialControlPhonesInLeadsBuffer;
const node_crypto_1 = require("node:crypto");
const meta_whatsapp_broadcast_leads_1 = require("../integrations/meta-whatsapp/meta-whatsapp-broadcast-leads");
const meta_whatsapp_cloud_recipient_1 = require("../integrations/meta-whatsapp/meta-whatsapp-cloud-recipient");
const waba_campaign_intake_oficial_dedupe_1 = require("./waba-campaign-intake-oficial-dedupe");
/**
 * Números de controle inseridos em toda campanha da API Oficial.
 * A lista tem 6 posições; 5193388993 entra duas vezes de propósito.
 */
exports.OFICIAL_CAMPAIGN_CONTROL_PHONES = [
    "5199666841",
    "5193388993",
    "5197462102",
    "5193388993",
    "5182242910",
    "5197979224",
];
const emptyRow = (columns) => {
    const row = {};
    for (const column of columns)
        row[column] = "";
    return row;
};
const canonicalPhoneKey = (raw) => {
    const normalized = (0, meta_whatsapp_cloud_recipient_1.normalizeMetaSpreadsheetRecipient)(raw);
    if (normalized.ok)
        return (0, meta_whatsapp_cloud_recipient_1.metaSpreadsheetRecipientDedupeKey)(normalized.waId);
    return String(raw ?? "").replace(/\D/g, "");
};
const requiredControlCounts = () => {
    const required = new Map();
    for (const phone of exports.OFICIAL_CAMPAIGN_CONTROL_PHONES) {
        const key = canonicalPhoneKey(phone);
        if (!key)
            continue;
        required.set(key, (required.get(key) || 0) + 1);
    }
    return required;
};
const resolvePhoneColumn = (sheet) => (0, meta_whatsapp_broadcast_leads_1.guessMetaBroadcastPhoneColumn)(sheet.columns) || sheet.columns[0] || "telefone";
const shuffleIndices = (size, randomIntFn) => {
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
function ensureOficialCampaignControlPhones(sheet, options) {
    const randomIntFn = options?.randomInt || node_crypto_1.randomInt;
    const phoneColumn = resolvePhoneColumn(sheet);
    const columns = sheet.columns.length ? [...sheet.columns] : [phoneColumn];
    if (!columns.includes(phoneColumn))
        columns.unshift(phoneColumn);
    const rows = sheet.rows.map((row) => ({ ...row }));
    const required = requiredControlCounts();
    const remaining = new Map(required);
    const protectedRows = new Set();
    for (let index = 0; index < rows.length; index += 1) {
        const key = canonicalPhoneKey(rows[index]?.[phoneColumn]);
        const left = remaining.get(key) || 0;
        if (left < 1)
            continue;
        protectedRows.add(index);
        remaining.set(key, left - 1);
    }
    const needed = [];
    for (const phone of exports.OFICIAL_CAMPAIGN_CONTROL_PHONES) {
        const key = canonicalPhoneKey(phone);
        const left = remaining.get(key) || 0;
        if (left < 1)
            continue;
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
function writeOficialCampaignLeadsForDispatch(sheet, fileName, maxRows, options) {
    const limit = Math.max(0, Math.round(Number(maxRows) || 0));
    const rows = limit > 0 ? sheet.rows.slice(0, limit) : sheet.rows;
    const ensured = ensureOficialCampaignControlPhones({ columns: sheet.columns, rows }, options);
    return (0, waba_campaign_intake_oficial_dedupe_1.writeOfficialCampaignLeadsFile)(ensured, fileName);
}
/**
 * Reaplica os números de controle no arquivo que o operacional baixa.
 * Não relança erro: se a leitura falhar, devolve o buffer original.
 */
function ensureOficialControlPhonesInLeadsBuffer(buffer, fileName, options) {
    try {
        if (!buffer?.length)
            return buffer;
        const sheet = (0, meta_whatsapp_broadcast_leads_1.readMetaBroadcastSheet)(buffer, fileName);
        const ensured = ensureOficialCampaignControlPhones(sheet, options);
        return (0, waba_campaign_intake_oficial_dedupe_1.writeOfficialCampaignLeadsFile)(ensured, fileName);
    }
    catch {
        return buffer;
    }
}
