"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectEvoInstancesSharingPhone = collectEvoInstancesSharingPhone;
exports.splitCanonicalAndDuplicateNames = splitCanonicalAndDuplicateNames;
const evo_instance_phone_service_1 = require("./evo-instance-phone.service");
/**
 * Reconexão do mesmo número: apaga clones e sessão antiga na Evolution.
 * Preserva no WABA: foguinhos (lifecycle) e totais de mensagens (logs_envios).
 */
function collectEvoInstancesSharingPhone(instances, phone) {
    const want = (0, evo_instance_phone_service_1.normalizeEvoWhatsAppNumber)(phone);
    if (!want)
        return [];
    const list = Array.isArray(instances) ? instances : [];
    const out = [];
    const seen = new Set();
    for (const item of list) {
        const row = (0, evo_instance_phone_service_1.extractPhoneFromEvoListItem)(item);
        if (!row?.instanceName || !row.phone)
            continue;
        if (!(0, evo_instance_phone_service_1.brazilWhatsAppNumbersMatch)(want, row.phone))
            continue;
        const key = row.instanceName.trim().toLowerCase();
        if (!key || seen.has(key))
            continue;
        seen.add(key);
        out.push({ instanceName: row.instanceName.trim(), phone: row.phone });
    }
    return out;
}
function splitCanonicalAndDuplicateNames(hits, canonicalName) {
    const canonical = String(canonicalName || "").trim();
    const canonicalLc = canonical.toLowerCase();
    const duplicates = hits
        .map((h) => h.instanceName)
        .filter((n) => n.toLowerCase() !== canonicalLc);
    return { canonical, duplicates };
}
