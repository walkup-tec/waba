"use strict";
/** Números do Disparo Cloud podem vir de vários portfólios; o relatório permanece um só. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BroadcastPhoneSelectionError = void 0;
exports.indexBroadcastPortfolioPhones = indexBroadcastPortfolioPhones;
exports.resolveBroadcastPhoneBindings = resolveBroadcastPhoneBindings;
exports.connectionIdByPhoneNumber = connectionIdByPhoneNumber;
exports.bindingsFromCampaignPhones = bindingsFromCampaignPhones;
exports.attachBroadcastLeadPhoneBindings = attachBroadcastLeadPhoneBindings;
exports.templateMissingOnPortfolioMessage = templateMissingOnPortfolioMessage;
exports.connectionNeedsLocalTemplate = connectionNeedsLocalTemplate;
class BroadcastPhoneSelectionError extends Error {
    constructor(reason, message) {
        super(message);
        this.reason = reason;
    }
}
exports.BroadcastPhoneSelectionError = BroadcastPhoneSelectionError;
function indexBroadcastPortfolioPhones(portfolios) {
    const catalog = new Map();
    for (const card of portfolios || []) {
        const connectionId = String(card.connectionId || "").trim();
        if (!connectionId)
            continue;
        const portfolioName = String(card.name || "").trim() || null;
        const wabaId = String(card.wabaId || "").trim() || null;
        for (const number of card.numbers || []) {
            const phoneNumberId = String(number.phoneNumberId || "").trim();
            if (!phoneNumberId || catalog.has(phoneNumberId))
                continue;
            catalog.set(phoneNumberId, {
                phoneNumberId,
                connectionId,
                portfolioName,
                wabaId,
                uiStatus: String(number.uiStatus || "").trim(),
                dispatchStatus: String(number.dispatchStatus || "livre").trim(),
            });
        }
    }
    return catalog;
}
function resolveBroadcastPhoneBindings(requestedIds, catalog) {
    const requested = [...new Set(requestedIds.map((id) => String(id || "").trim()).filter(Boolean))];
    if (!requested.length) {
        throw new BroadcastPhoneSelectionError("missing", "Selecione ao menos um número Ativo e disponível.");
    }
    const bindings = [];
    for (const phoneNumberId of requested) {
        const match = catalog.get(phoneNumberId);
        if (!match) {
            throw new BroadcastPhoneSelectionError("unknown", "Este número não está nos portfólios conectados.");
        }
        if (match.uiStatus !== "ativo") {
            throw new BroadcastPhoneSelectionError("inactive", "O disparo Cloud só sai de um número Ativo.");
        }
        if (match.dispatchStatus === "em_disparo") {
            throw new BroadcastPhoneSelectionError("busy", "Este número está ocupado em outro disparo. Ele volta a ficar disponível depois que a campanha for finalizada e o relatório for gerado.");
        }
        bindings.push({
            phoneNumberId: match.phoneNumberId,
            connectionId: match.connectionId,
            portfolioName: match.portfolioName,
            wabaId: match.wabaId,
        });
    }
    return bindings;
}
function connectionIdByPhoneNumber(bindings) {
    const out = {};
    for (const row of bindings) {
        const phone = String(row.phoneNumberId || "").trim();
        const connectionId = String(row.connectionId || "").trim();
        if (phone && connectionId)
            out[phone] = connectionId;
    }
    return out;
}
function bindingsFromCampaignPhones(input) {
    const stored = Array.isArray(input.stored) ? input.stored : [];
    const byPhone = connectionIdByPhoneNumber(stored);
    const fallback = String(input.fallbackConnectionId || "").trim();
    return input.phoneNumberIds
        .map((id) => String(id || "").trim())
        .filter(Boolean)
        .map((phoneNumberId) => {
        const previous = stored.find((row) => String(row.phoneNumberId || "").trim() === phoneNumberId);
        return {
            phoneNumberId,
            connectionId: byPhone[phoneNumberId] || fallback,
            portfolioName: previous?.portfolioName ?? null,
            wabaId: previous?.wabaId ?? null,
        };
    })
        .filter((row) => row.connectionId);
}
function attachBroadcastLeadPhoneBindings(leads, bindings) {
    const byPhone = connectionIdByPhoneNumber(bindings);
    return leads.map((lead) => {
        const phone = String(lead.phoneNumberId || "").trim();
        const connectionId = byPhone[phone] || "";
        return { ...lead, connectionId };
    });
}
function templateMissingOnPortfolioMessage(input) {
    const templateName = String(input.templateName || "selecionado").trim() || "selecionado";
    const portfolio = String(input.portfolioName || "").trim();
    const where = portfolio ? `no portfólio ${portfolio}` : "em um dos portfólios selecionados";
    return `O template ${templateName} não está aprovado ${where}. Números desse portfólio só entram neste disparo se o mesmo template (nome e idioma) já estiver aprovado lá.`;
}
function connectionNeedsLocalTemplate(input) {
    const connectionId = String(input.connectionId || "").trim();
    const templateConnectionId = String(input.templateConnectionId || "").trim();
    if (connectionId && templateConnectionId && connectionId === templateConnectionId)
        return false;
    const wabaId = String(input.wabaId || "").trim();
    const templateWabaId = String(input.templateWabaId || "").trim();
    if (wabaId && templateWabaId && wabaId === templateWabaId)
        return false;
    return true;
}
