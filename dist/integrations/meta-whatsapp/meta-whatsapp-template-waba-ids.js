"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isProbablyMessageTemplateRow = isProbablyMessageTemplateRow;
exports.wabaIdsFromDebugTokenJson = wabaIdsFromDebugTokenJson;
exports.wabaIdsFromBusinessEdgeJson = wabaIdsFromBusinessEdgeJson;
exports.wabasFromBusinessEdgeJson = wabasFromBusinessEdgeJson;
exports.wabasFromBusinessNodeJson = wabasFromBusinessNodeJson;
exports.discoverTemplateWabas = discoverTemplateWabas;
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
    return wabasFromBusinessEdgeJson(json).map((row) => row.id);
}
function wabasFromBusinessEdgeJson(json) {
    const data = asRecord(json).data;
    const list = Array.isArray(data) ? data : [];
    const out = [];
    for (const row of list) {
        if (isProbablyMessageTemplateRow(row))
            continue;
        const rec = asRecord(row);
        const id = String(rec.id || "").trim();
        if (!id)
            continue;
        const name = String(rec.name || "").trim();
        out.push({ id, name: name || `WABA ${id}` });
    }
    return out;
}
/** Contas WhatsApp do BM (owned + client), o mesmo recorte do WhatsApp Manager. */
function wabasFromBusinessNodeJson(json) {
    const row = asRecord(json);
    const seen = new Map();
    for (const edge of ["owned_whatsapp_business_accounts", "client_whatsapp_business_accounts"]) {
        const data = asRecord(row[edge]).data;
        const list = Array.isArray(data) ? data : [];
        for (const item of list) {
            if (isProbablyMessageTemplateRow(item))
                continue;
            const rec = asRecord(item);
            const id = String(rec.id || "").trim();
            if (!id)
                continue;
            const name = String(rec.name || "").trim();
            if (!seen.has(id))
                seen.set(id, name);
        }
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name: name || `WABA ${id}` }));
}
const DISCOVER_GRAPH = { maxAttempts: 1, timeoutMs: 8000 };
function addDiscoveredWaba(byId, id, name, bm) {
    const wid = String(id || "").trim();
    if (!wid || (bm && wid === bm))
        return;
    const next = String(name || "").trim();
    const prev = byId.get(wid) || "";
    byId.set(wid, next || prev);
}
async function discoverTemplateWabas(input) {
    const graph = input.graph || meta_whatsapp_graph_client_1.callMetaGraphJson;
    const primary = String(input.connection.wabaId || "").trim();
    const bm = String(input.connection.metaBusinessId || "").trim();
    const byId = new Map();
    if (bm) {
        const nested = await graph({
            token: input.token,
            method: "GET",
            path: bm,
            query: {
                fields: "owned_whatsapp_business_accounts{id,name},client_whatsapp_business_accounts{id,name}",
            },
            ...DISCOVER_GRAPH,
        });
        if (nested.ok) {
            for (const row of wabasFromBusinessNodeJson(nested.json)) {
                addDiscoveredWaba(byId, row.id, row.name, bm);
            }
        }
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
            for (const row of wabasFromBusinessEdgeJson(res.json)) {
                addDiscoveredWaba(byId, row.id, row.name, bm);
            }
        }
    }
    if (byId.size) {
        return [...byId.entries()].map(([id, name]) => ({ id, name: name || `WABA ${id}` }));
    }
    if (primary)
        addDiscoveredWaba(byId, primary, "", bm);
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
            for (const id of wabaIdsFromDebugTokenJson(debug.json)) {
                addDiscoveredWaba(byId, id, "", bm);
            }
        }
    }
    return [...byId.entries()].map(([id, name]) => ({ id, name: name || `WABA ${id}` }));
}
async function discoverTemplateWabaIds(input) {
    return (await discoverTemplateWabas(input)).map((row) => row.id);
}
