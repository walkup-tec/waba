"use strict";
/**
 * Casa o nome gravado na campanha (WB-7770, 1261) com a chave técnica da Evolution (drax, 1261).
 * O pick de envio e o chip da campanha têm de usar a mesma regra.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.digitKeysFromStoredLabel = digitKeysFromStoredLabel;
exports.identityRowFromEvoFields = identityRowFromEvoFields;
exports.resolveCampaignStoredNameToEvoKey = resolveCampaignStoredNameToEvoKey;
exports.uniqueProbeNamesForLiveState = uniqueProbeNamesForLiveState;
exports.runCampaignInstanceIdentitySelfCheck = runCampaignInstanceIdentitySelfCheck;
function addKey(set, value) {
    const s = String(value || "").trim().toLowerCase();
    if (s)
        set.add(s);
}
function digitKeysFromStoredLabel(raw) {
    const out = new Set();
    const digits = String(raw || "").replace(/\D/g, "");
    if (digits.length >= 4) {
        out.add(digits);
        out.add(digits.slice(-4));
    }
    else if (digits) {
        out.add(digits);
    }
    return Array.from(out);
}
function identityRowFromEvoFields(input) {
    const instanceKey = String(input.instanceKey || "").trim();
    const displayName = String(input.displayName || instanceKey).trim() || instanceKey;
    const nameKeys = new Set();
    addKey(nameKeys, instanceKey);
    addKey(nameKeys, displayName);
    const digitKeys = new Set([
        ...digitKeysFromStoredLabel(instanceKey),
        ...digitKeysFromStoredLabel(displayName),
        ...digitKeysFromStoredLabel(String(input.phone || "")),
    ]);
    return {
        instanceKey,
        displayName,
        nameKeys: Array.from(nameKeys),
        digitKeys: Array.from(digitKeys),
    };
}
/**
 * WB-7770 + alias/telefone do drax → `drax`.
 * 1261 sem telefone no fetch → `1261` se a chave existir nas linhas.
 */
function resolveCampaignStoredNameToEvoKey(storedName, rows) {
    const raw = String(storedName || "").trim();
    const rawLc = raw.toLowerCase();
    if (!raw)
        return "";
    if (!rows.length)
        return raw;
    for (const r of rows) {
        if (r.nameKeys.some((k) => k === rawLc)) {
            return String(r.instanceKey || raw).trim() || raw;
        }
    }
    const storedDigits = digitKeysFromStoredLabel(raw);
    if (!storedDigits.length)
        return raw;
    const digitHits = rows.filter((r) => storedDigits.some((d) => r.digitKeys.includes(d)));
    if (digitHits.length === 1) {
        return String(digitHits[0].instanceKey || raw).trim() || raw;
    }
    if (digitHits.length > 1) {
        const exactKey = digitHits.find((r) => r.instanceKey.toLowerCase() === rawLc);
        if (exactKey)
            return exactKey.instanceKey;
        const exactDisp = digitHits.find((r) => r.displayName.toLowerCase() === rawLc);
        if (exactDisp)
            return exactDisp.instanceKey;
    }
    return raw;
}
function uniqueProbeNamesForLiveState(evoKey, storedName) {
    const out = [];
    for (const n of [evoKey, storedName]) {
        const v = String(n || "").trim();
        if (!v)
            continue;
        if (out.some((x) => x.toLowerCase() === v.toLowerCase()))
            continue;
        out.push(v);
    }
    return out;
}
function runCampaignInstanceIdentitySelfCheck() {
    const drax = identityRowFromEvoFields({
        instanceKey: "drax",
        displayName: "WB-7770",
        phone: "51981077770",
    });
    const n1261 = identityRowFromEvoFields({
        instanceKey: "1261",
        displayName: "1261",
        phone: "",
    });
    const walkup5401 = identityRowFromEvoFields({
        instanceKey: "walkup-5401",
        displayName: "WB-5401",
        phone: "5198335401",
    });
    const rows = [drax, n1261, walkup5401];
    const cases = [
        ["WB-7770", "drax", "alias da campanha tem de virar a chave EVO"],
        ["drax", "drax", "chave técnica permanece"],
        ["1261", "1261", "1261 sem telefone no fetch continua encontrável"],
        ["WB-5401", "walkup-5401", "5401 pelo alias"],
    ];
    for (const [stored, expected, label] of cases) {
        const got = resolveCampaignStoredNameToEvoKey(stored, rows);
        if (got !== expected) {
            throw new Error(`identity ${label}: ${stored} → ${got} (esperado ${expected})`);
        }
    }
    const probes = uniqueProbeNamesForLiveState("drax", "WB-7770");
    if (probes.join(",") !== "drax,WB-7770") {
        throw new Error(`probes 7770: ${probes.join(",")}`);
    }
}
