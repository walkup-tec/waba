"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isProbablyMessageTemplateRow = isProbablyMessageTemplateRow;
exports.wabaIdsFromDebugTokenJson = wabaIdsFromDebugTokenJson;
exports.wabaIdsFromBusinessEdgeJson = wabaIdsFromBusinessEdgeJson;
exports.wabasFromBusinessEdgeJson = wabasFromBusinessEdgeJson;
exports.splitWabasFromBusinessNodeJson = splitWabasFromBusinessNodeJson;
exports.wabasFromBusinessNodeJson = wabasFromBusinessNodeJson;
exports.extraWabaIdsFromConnections = extraWabaIdsFromConnections;
exports.wabaIdentityMatchesBusiness = wabaIdentityMatchesBusiness;
exports.filterWabaIdsOwnedByBusiness = filterWabaIdsOwnedByBusiness;
exports.discoverTemplateWabas = discoverTemplateWabas;
exports.discoverTemplateWabaIds = discoverTemplateWabaIds;
exports.pickTemplateWriteConnections = pickTemplateWriteConnections;
const meta_config_1 = require("./meta-config");
const meta_whatsapp_graph_client_1 = require("./meta-whatsapp-graph.client");
const meta_whatsapp_known_owned_wabas_1 = require("./meta-whatsapp-known-owned-wabas");
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
function phoneCountFromWabaRow(rec) {
    if (!Object.prototype.hasOwnProperty.call(rec, "phone_numbers"))
        return null;
    const data = asRecord(rec.phone_numbers).data;
    if (!Array.isArray(data))
        return null;
    return data.filter((item) => String(asRecord(item).id || "").trim()).length;
}
function wabasFromEdgeRows(list) {
    const out = [];
    for (const row of list) {
        if (isProbablyMessageTemplateRow(row))
            continue;
        const rec = asRecord(row);
        const id = String(rec.id || "").trim();
        if (!id)
            continue;
        const name = String(rec.name || "").trim();
        out.push({ id, name: name || `WABA ${id}`, phoneCount: phoneCountFromWabaRow(rec) });
    }
    return out;
}
function wabasFromBusinessEdgeJson(json) {
    const data = asRecord(json).data;
    return wabasFromEdgeRows(Array.isArray(data) ? data : []).map(({ id, name }) => ({ id, name }));
}
function wabasFromNamedBusinessEdge(json, edge) {
    const data = asRecord(asRecord(json)[edge]).data;
    const list = Array.isArray(data) ? data : [];
    const seen = new Map();
    for (const item of wabasFromEdgeRows(list)) {
        if (!seen.has(item.id))
            seen.set(item.id, { name: item.name, phoneCount: item.phoneCount });
    }
    return [...seen.entries()].map(([id, row]) => ({
        id,
        name: row.name || `WABA ${id}`,
        phoneCount: row.phoneCount,
    }));
}
function splitWabasFromBusinessNodeJson(json) {
    return {
        owned: wabasFromNamedBusinessEdge(json, "owned_whatsapp_business_accounts"),
        client: wabasFromNamedBusinessEdge(json, "client_whatsapp_business_accounts"),
    };
}
/** Contas WhatsApp do BM. Padrão: só owned ("Propriedade de" no Manager). */
function wabasFromBusinessNodeJson(json, opts) {
    const split = splitWabasFromBusinessNodeJson(json);
    if (opts?.includeClient) {
        const seen = new Map();
        for (const row of [...split.owned, ...split.client]) {
            if (!seen.has(row.id))
                seen.set(row.id, row.name);
        }
        return [...seen.entries()].map(([id, name]) => ({ id, name: name || `WABA ${id}` }));
    }
    return split.owned;
}
/** Outras conexões abertas do mesmo BM — WABA02 pode não vir no owned do token ES. */
function extraWabaIdsFromConnections(rows, current) {
    const bm = String(current.metaBusinessId || "").trim();
    const selfWaba = String(current.wabaId || "").trim();
    const selfId = String(current.id || "").trim();
    const out = new Set();
    for (const row of rows) {
        if (selfId && String(row.id || "").trim() === selfId)
            continue;
        if (bm && String(row.metaBusinessId || "").trim() !== bm)
            continue;
        const id = String(row.wabaId || "").trim();
        if (id && id !== selfWaba)
            out.add(id);
    }
    for (const id of (0, meta_whatsapp_known_owned_wabas_1.knownOwnedWabaIdsForBusiness)(bm)) {
        if (id && id !== selfWaba)
            out.add(id);
    }
    return [...out];
}
function wabaIdentityMatchesBusiness(json, businessId) {
    const wanted = String(businessId || "").trim();
    if (!wanted)
        return true;
    const row = asRecord(json);
    const owner = String(asRecord(row.owner_business_info).id || "").trim();
    // "Propriedade de" no Manager. on_behalf marca WABA compartilhada (client), não deste BM.
    return Boolean(owner) && owner === wanted;
}
const DISCOVER_GRAPH = { maxAttempts: 1, timeoutMs: 8000 };
async function filterWabaIdsOwnedByBusiness(input) {
    const graph = input.graph || meta_whatsapp_graph_client_1.callMetaGraphJson;
    const bm = String(input.businessId || "").trim();
    const unique = [...new Set((input.ids || []).map((id) => String(id || "").trim()).filter(Boolean))];
    const keepOnError = new Set((input.keepOnErrorIds || []).map((id) => String(id || "").trim()).filter(Boolean));
    const out = [];
    const chunkSize = 8;
    for (let i = 0; i < unique.length; i += chunkSize) {
        const slice = unique.slice(i, i + chunkSize);
        const rows = await Promise.all(slice.map(async (id) => {
            const res = await graph({
                token: input.token,
                method: "GET",
                path: id,
                query: {
                    fields: "id,name,owner_business_info{id},on_behalf_of_business_info{id}",
                },
                ...DISCOVER_GRAPH,
            });
            return { id, res };
        }));
        for (const { id, res } of rows) {
            if (!res.ok) {
                if (keepOnError.has(id))
                    out.push({ id, name: "" });
                continue;
            }
            if (bm && !wabaIdentityMatchesBusiness(res.json, bm))
                continue;
            const name = String(res.json?.name || "").trim();
            out.push({ id, name: name || `WABA ${id}` });
        }
    }
    return out;
}
function addDiscoveredWaba(byId, id, name, bm) {
    const wid = String(id || "").trim();
    if (!wid || (bm && wid === bm))
        return;
    const next = String(name || "").trim();
    const prev = byId.get(wid) || "";
    byId.set(wid, next || prev);
}
async function listBusinessWabaEdgeRows(graph, token, businessId, edge) {
    const out = [];
    const seenCursors = new Set();
    let after = "";
    for (let page = 0; page < 20; page += 1) {
        const query = {
            fields: "id,name,phone_numbers.limit(1){id}",
            limit: "100",
        };
        if (after)
            query.after = after;
        const res = await graph({
            token,
            method: "GET",
            path: `${businessId}/${edge}`,
            query,
            ...DISCOVER_GRAPH,
        });
        if (!res.ok)
            break;
        const data = asRecord(res.json).data;
        const batch = wabasFromEdgeRows(Array.isArray(data) ? data : []);
        for (const row of batch)
            out.push(row);
        const paging = asRecord(asRecord(res.json).paging);
        const nextAfter = String(asRecord(paging.cursors).after || "").trim();
        if (!nextAfter || nextAfter === after || seenCursors.has(nextAfter) || !batch.length)
            break;
        seenCursors.add(nextAfter);
        after = nextAfter;
    }
    return out;
}
async function addDebugTokenWabas(graph, token, bm, byId) {
    const appId = (0, meta_config_1.readMetaAppId)();
    const appSecret = (0, meta_config_1.readMetaAppSecret)();
    if (!appId || !appSecret || !token)
        return;
    const debug = await graph({
        token: `${appId}|${appSecret}`,
        method: "GET",
        path: "debug_token",
        query: { input_token: token },
        ...DISCOVER_GRAPH,
    });
    if (!debug.ok)
        return;
    for (const id of wabaIdsFromDebugTokenJson(debug.json)) {
        addDiscoveredWaba(byId, id, "", bm);
    }
}
async function discoverTemplateWabas(input) {
    const graph = input.graph || meta_whatsapp_graph_client_1.callMetaGraphJson;
    const primary = String(input.connection.wabaId || "").trim();
    const bm = String(input.connection.metaBusinessId || "").trim();
    const byId = new Map();
    const ownedIds = new Set();
    const ownedEmptyIds = new Set();
    const clientIds = new Set();
    const knownOwnedIds = new Set((0, meta_whatsapp_known_owned_wabas_1.knownOwnedWabaIdsForBusiness)(bm));
    const extraFromConnections = [
        ...new Set((input.extraWabaIds || [])
            .map((id) => String(id || "").trim())
            .filter((id) => id && !(0, meta_whatsapp_known_owned_wabas_1.knownClientWabaIdsForBusiness)(bm).includes(id))),
    ];
    const noteOwned = (row) => {
        ownedIds.add(row.id);
        if (row.phoneCount === 0)
            ownedEmptyIds.add(row.id);
        addDiscoveredWaba(byId, row.id, row.name, bm);
    };
    for (const id of (0, meta_whatsapp_known_owned_wabas_1.knownClientWabaIdsForBusiness)(bm))
        clientIds.add(id);
    if (bm) {
        const nested = await graph({
            token: input.token,
            method: "GET",
            path: bm,
            query: {
                fields: "owned_whatsapp_business_accounts{id,name,phone_numbers.limit(1){id}},client_whatsapp_business_accounts{id,name}",
            },
            ...DISCOVER_GRAPH,
        });
        if (nested.ok) {
            const split = splitWabasFromBusinessNodeJson(nested.json);
            for (const row of split.owned)
                noteOwned(row);
            for (const row of split.client)
                clientIds.add(row.id);
        }
        for (const row of await listBusinessWabaEdgeRows(graph, input.token, bm, "owned_whatsapp_business_accounts")) {
            noteOwned(row);
        }
        for (const row of await listBusinessWabaEdgeRows(graph, input.token, bm, "client_whatsapp_business_accounts")) {
            clientIds.add(row.id);
        }
    }
    const ownedEdgeListed = ownedIds.size > 0;
    if (ownedEdgeListed) {
        // Mesma lista do Manager ("Contas do WhatsApp"). debug_token e conexão
        // antiga não podem reintroduzir WABA que a Meta já não mostra neste BM.
        for (const row of (0, meta_whatsapp_known_owned_wabas_1.knownOwnedWabaRowsForBusiness)(bm)) {
            addDiscoveredWaba(byId, row.id, row.name, bm);
        }
        // Card do portfólio = WABA da conexão. Se ela já está no owned do BM,
        // outras owned do token (mesmo com número) não entram no criar template.
        // André WABA02 continua via knownOwned. Se a conexão aponta WABA antiga
        // fora do owned (Walkup stale), mantém as owned atuais e só tira vazio.
        const primaryInOwned = Boolean(primary && ownedIds.has(primary));
        for (const id of [...byId.keys()]) {
            if (knownOwnedIds.has(id) || id === primary)
                continue;
            if (primaryInOwned) {
                byId.delete(id);
                continue;
            }
            if (ownedEmptyIds.has(id))
                byId.delete(id);
        }
    }
    else {
        if (primary)
            addDiscoveredWaba(byId, primary, "", bm);
        for (const row of (0, meta_whatsapp_known_owned_wabas_1.knownOwnedWabaRowsForBusiness)(bm)) {
            addDiscoveredWaba(byId, row.id, row.name, bm);
        }
        for (const id of extraFromConnections)
            addDiscoveredWaba(byId, id, "", bm);
        await addDebugTokenWabas(graph, input.token, bm, byId);
    }
    // WABA client (ex.: Rio de Janeiro 01) não entra no picker deste BM, mesmo se GET owner bater.
    for (const id of [...byId.keys()]) {
        if ((0, meta_whatsapp_known_owned_wabas_1.knownClientWabaIdsForBusiness)(bm).includes(id)) {
            byId.delete(id);
            continue;
        }
        if (clientIds.has(id) && !ownedIds.has(id))
            byId.delete(id);
    }
    const candidateIds = [...byId.keys()];
    const keepOnErrorIds = ownedEdgeListed
        ? candidateIds.filter((id) => ownedIds.has(id) || knownOwnedIds.has(id))
        : candidateIds.filter((id) => id === primary || knownOwnedIds.has(id));
    if (bm && candidateIds.length) {
        const owned = await filterWabaIdsOwnedByBusiness({
            token: input.token,
            businessId: bm,
            ids: candidateIds,
            keepOnErrorIds,
            graph,
        });
        const verified = new Map();
        for (const row of owned) {
            if ((0, meta_whatsapp_known_owned_wabas_1.knownClientWabaIdsForBusiness)(bm).includes(row.id))
                continue;
            if (clientIds.has(row.id) && !ownedIds.has(row.id))
                continue;
            addDiscoveredWaba(verified, row.id, row.name || byId.get(row.id) || "", bm);
        }
        return [...verified.entries()].map(([id, name]) => ({ id, name: name || `WABA ${id}` }));
    }
    return [...byId.entries()].map(([id, name]) => ({ id, name: name || `WABA ${id}` }));
}
async function discoverTemplateWabaIds(input) {
    return (await discoverTemplateWabas(input)).map((row) => row.id);
}
function isOpenTemplateConnection(row) {
    if (row.disconnectedAt)
        return false;
    return row.status === "connected" || row.status === "pending_confirmation";
}
/** Token da WABA01 não posta na WABA02 irmã; prefere a conexão cujo wabaId é o destino. */
function pickTemplateWriteConnections(rows, preferred, targetWabaId) {
    const target = String(targetWabaId || "").trim();
    const preferredBm = String(preferred.metaBusinessId || "").trim();
    const pool = rows.filter((row) => {
        if (!isOpenTemplateConnection(row))
            return false;
        if (row.id === preferred.id)
            return true;
        if (target && String(row.wabaId || "").trim() === target)
            return true;
        if (preferredBm && (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(String(row.metaBusinessId || ""), preferredBm))
            return true;
        return false;
    });
    const list = pool.length ? pool : [preferred];
    return [...list].sort((left, right) => {
        const leftMatch = target && String(left.wabaId || "").trim() === target ? 0 : 1;
        const rightMatch = target && String(right.wabaId || "").trim() === target ? 0 : 1;
        if (leftMatch !== rightMatch)
            return leftMatch - rightMatch;
        if (left.id === preferred.id)
            return -1;
        if (right.id === preferred.id)
            return 1;
        return 0;
    });
}
