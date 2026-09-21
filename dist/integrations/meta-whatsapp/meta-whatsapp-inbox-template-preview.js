"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTemplateBodyText = extractTemplateBodyText;
exports.fillTemplatePlaceholders = fillTemplatePlaceholders;
exports.leadValuesForInspect = leadValuesForInspect;
exports.valuesFromSendComponents = valuesFromSendComponents;
exports.renderTemplateBodyText = renderTemplateBodyText;
exports.isGenericInboxPreview = isGenericInboxPreview;
exports.emptyInboxFilterCounts = emptyInboxFilterCounts;
exports.accumulateInboxFilterCounts = accumulateInboxFilterCounts;
function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
}
function extractTemplateBodyText(components) {
    const list = Array.isArray(components) ? components : [];
    for (const item of list) {
        const row = asRecord(item);
        if (String(row.type || "").trim().toUpperCase() !== "BODY")
            continue;
        const text = String(row.text || "").trim();
        if (text)
            return text;
    }
    return "";
}
function fillTemplatePlaceholders(body, values) {
    return String(body || "").replace(/\{\{\s*(\d+)\s*\}\}/g, (full, raw) => {
        const index = Number(raw);
        if (!Number.isFinite(index) || index < 1)
            return full;
        const value = values[index - 1];
        const text = String(value || "").trim();
        return text || full;
    });
}
function leadValuesForInspect(inspect, lead) {
    const vars = Array.isArray(inspect?.bodyVariables) ? inspect.bodyVariables : [];
    if (!vars.length)
        return [];
    const max = Math.max(...vars.map((item) => Number(item.index) || 0), 0);
    const values = Array.from({ length: max }, () => "");
    for (const item of vars) {
        const index = Number(item.index) || 0;
        if (index < 1)
            continue;
        const key = String(item.key || "").trim().toLowerCase();
        const text = key === "nome"
            ? String(lead?.nome || "Cliente")
            : key === "numero"
                ? String(lead?.numero || lead?.waId || "")
                : String(lead?.texto || lead?.nome || lead?.waId || "");
        values[index - 1] = text.slice(0, 60);
    }
    return values;
}
function valuesFromSendComponents(components) {
    const list = Array.isArray(components) ? components : [];
    for (const item of list) {
        const row = asRecord(item);
        if (String(row.type || "").trim().toLowerCase() !== "body")
            continue;
        const params = Array.isArray(row.parameters) ? row.parameters : [];
        return params.map((param) => String(asRecord(param).text || "").trim());
    }
    return [];
}
function renderTemplateBodyText(input) {
    const stored = String(input.lead?.previewText || "").trim();
    if (stored)
        return stored;
    const body = String(input.bodyText || "").trim();
    if (!body)
        return "";
    const fromSend = valuesFromSendComponents(input.sendComponents);
    const values = fromSend.length ? fromSend : leadValuesForInspect(input.inspect, input.lead);
    return fillTemplatePlaceholders(body, values).replace(/\s+/g, " ").trim();
}
function isGenericInboxPreview(preview) {
    const value = String(preview || "")
        .replace(/\s+/g, " ")
        .trim();
    if (!value || value === "—")
        return true;
    if (/^mensagem enviada\.?$/i.test(value))
        return true;
    if (/^template:\s*/i.test(value))
        return true;
    return false;
}
function emptyInboxFilterCounts() {
    return { all: 0, unread: 0, open: 0, pending: 0, closed: 0, mine: 0 };
}
function accumulateInboxFilterCounts(counts, row, assignedTo) {
    counts.all += 1;
    if (Number(row.unreadCount || 0) > 0)
        counts.unread += 1;
    const status = String(row.status || "").trim().toLowerCase();
    if (status === "open")
        counts.open += 1;
    if (status === "pending")
        counts.pending += 1;
    if (status === "closed")
        counts.closed += 1;
    const mine = String(assignedTo || "").trim();
    if (mine && String(row.assignedTo || "").trim() === mine)
        counts.mine += 1;
}
