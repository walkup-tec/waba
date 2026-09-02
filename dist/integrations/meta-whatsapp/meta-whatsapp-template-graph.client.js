"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapGraphTemplate = mapGraphTemplate;
exports.listWabaMessageTemplates = listWabaMessageTemplates;
exports.deleteWabaMessageTemplate = deleteWabaMessageTemplate;
exports.createWabaMessageTemplate = createWabaMessageTemplate;
const meta_whatsapp_graph_client_1 = require("./meta-whatsapp-graph.client");
const meta_whatsapp_template_types_1 = require("./meta-whatsapp-template.types");
const LIST_FIELDS = "id,name,language,status,category,quality_score,rejected_reason,components";
const MAX_PAGES = 20;
function mapGraphTemplate(raw) {
    const name = String(raw.name || "").trim();
    const language = String(raw.language || "").trim();
    if (!name || !language)
        return null;
    return {
        metaTemplateId: raw.id ? String(raw.id) : null,
        name,
        language,
        category: raw.category ? String(raw.category) : null,
        status: raw.status ? String(raw.status) : null,
        qualityScore: (0, meta_whatsapp_template_types_1.qualityScoreFromGraph)(raw.quality_score),
        rejectedReason: raw.rejected_reason ? String(raw.rejected_reason) : null,
        components: raw.components ?? null,
    };
}
async function listWabaMessageTemplates(input) {
    const graph = input.graph || meta_whatsapp_graph_client_1.callMetaGraphJson;
    const items = [];
    const seenCursors = new Set();
    let after = "";
    let pages = 0;
    let last = null;
    for (let page = 0; page < MAX_PAGES; page++) {
        const query = {
            fields: LIST_FIELDS,
            limit: "50",
        };
        if (after)
            query.after = after;
        const result = await graph({
            token: input.token,
            method: "GET",
            path: `${input.wabaId}/message_templates`,
            query,
        });
        last = result;
        if (!result.ok)
            return { ok: false, result };
        pages += 1;
        const data = Array.isArray(result.json?.data) ? result.json.data : [];
        for (const row of data) {
            items.push(mapGraphTemplate(row));
        }
        const nextAfter = String(result.json?.paging?.cursors?.after || "").trim();
        if (!nextAfter || nextAfter === after || seenCursors.has(nextAfter) || !data.length) {
            break;
        }
        seenCursors.add(nextAfter);
        after = nextAfter;
    }
    return { ok: true, items, pages };
}
async function deleteWabaMessageTemplate(input) {
    const graph = input.graph || meta_whatsapp_graph_client_1.callMetaGraphJson;
    const query = { name: String(input.name || "").trim() };
    const metaId = String(input.metaTemplateId || "").trim();
    if (metaId)
        query.hsm_id = metaId;
    return graph({
        token: input.token,
        method: "DELETE",
        path: `${input.wabaId}/message_templates`,
        query,
    });
}
async function createWabaMessageTemplate(input) {
    const graph = input.graph || meta_whatsapp_graph_client_1.callMetaGraphJson;
    return graph({
        token: input.token,
        method: "POST",
        path: `${input.wabaId}/message_templates`,
        body: input.body,
    });
}
