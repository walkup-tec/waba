"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isProbablyMessageTemplateRow = isProbablyMessageTemplateRow;
exports.wabaIdsFromDebugTokenJson = wabaIdsFromDebugTokenJson;
exports.wabaIdsFromBusinessEdgeJson = wabaIdsFromBusinessEdgeJson;
exports.discoverTemplateWabaIds = discoverTemplateWabaIds;
const meta_config_1 = require("./meta-config");
const meta_whatsapp_graph_client_1 = require("./meta-whatsapp-graph.client");
function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
}
function isProbablyMessageTemplateRow(row) {
    const item = asRecord(row);
    return Boolean(item.language || item.components || item.quality_score);
}
function wabaIdsFromDebugTokenJson(json) {
    const data = asRecord(json).data;
    if (!data || typeof data !== "object" || Array.isArray(data))
        return [];
    const granular = data.granular_scopes;
    const list = Array.isArray(granular) ? granular : [];
    const ids = new Set();
    for (const entry of list) {
        const row = asRecord(entry);
        const scope = String(row.scope || "").trim();
        // Só management traz WABA IDs. messaging traz phone_number_id — GET /{id}/message_templates
        // nesses chips falha/demora e o Traefik devolve 502 vazio no "Atualizar da Meta".
        if (scope !== "whatsapp_business_management")
            continue;
        const targets = Array.isArray(row.target_ids) ? row.target_ids : [];
        for (const raw of targets) {
            const id = String(raw || "").trim();
            if (id)
                ids.add(id);
        }
    }
    return [...ids];
}
function wabaIdsFromBusinessEdgeJson(json) {
    const data = asRecord(json).data;
    const list = Array.isArray(data) ? data : [];
    const ids = [];
    for (const row of list) {
        if (isProbablyMessageTemplateRow(row))
            continue;
        const id = String(asRecord(row).id || "").trim();
        if (id)
            ids.push(id);
    }
    return ids;
}
const DISCOVER_GRAPH = { maxAttempts: 1, timeoutMs: 8000 };
async function discoverTemplateWabaIds(input) {
    const graph = input.graph || meta_whatsapp_graph_client_1.callMetaGraphJson;
    const primary = String(input.connection.wabaId || "").trim();
    const ids = new Set();
    if (primary)
        ids.add(primary);
    const appId = (0, meta_config_1.readMetaAppId)();
    const appSecret = (0, meta_config_1.readMetaAppSecret)();
    if (appId && appSecret && input.token) {
        const debug = await graph({
            token: `${appId}|${appSecret}`,
            method: "GET",
            path: "debug_token",
            query: { input_token: input.token },
            ...DISCOVER_GRAPH,
        });
        if (debug.ok) {
            for (const id of wabaIdsFromDebugTokenJson(debug.json))
                ids.add(id);
        }
    }
    const bm = String(input.connection.metaBusinessId || "").trim();
    if (bm && bm !== primary) {
        for (const edge of ["owned_whatsapp_business_accounts", "client_whatsapp_business_accounts"]) {
            const res = await graph({
                token: input.token,
                method: "GET",
                path: `${bm}/${edge}`,
                query: { fields: "id,name", limit: "100" },
                ...DISCOVER_GRAPH,
            });
            if (!res.ok)
                continue;
            for (const id of wabaIdsFromBusinessEdgeJson(res.json)) {
                if (id !== bm)
                    ids.add(id);
            }
        }
    }
    const ordered = [...ids].filter((id) => id && id !== bm);
    if (primary && !ordered.includes(primary))
        ordered.unshift(primary);
    return ordered.length ? ordered : primary ? [primary] : [];
}
