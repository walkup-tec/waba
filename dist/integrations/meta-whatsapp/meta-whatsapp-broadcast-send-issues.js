"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maskCloudRecipient = maskCloudRecipient;
exports.summarizeBroadcastSendIssues = summarizeBroadcastSendIssues;
const MAX_FAILURES = 40;
const META_SEND_ERROR_HINT = {
    "131026": "Número inválido, sem WhatsApp, bloqueou o negócio ou app desatualizado (Message Undeliverable).",
    "131042": "Problema no método de pagamento / faturamento da WABA na Meta.",
    "131047": "Fora da janela de 24 h. É preciso template.",
    "131051": "A Meta recusou o tipo desta mensagem.",
    "131053": "A Meta não baixou a mídia do cabeçalho (erro 131053 / weblink 403). Use o arquivo local, não a URL de exemplo da Graph.",
    "130429": "Limite de envio da Meta atingido.",
    "132001": "Template pausado ou recusado.",
    "133010": "Número ainda não está pronto na Meta.",
};
function maskCloudRecipient(waId) {
    const digits = String(waId || "").replace(/\D/g, "");
    if (digits.length < 8)
        return "••••";
    const last4 = digits.slice(-4);
    if (digits.startsWith("55") && digits.length >= 12) {
        const ddd = digits.slice(2, 4);
        return `${ddd} •••••-${last4}`;
    }
    return `••••${last4}`;
}
function isFailedLead(lead) {
    return lead.status === "failed" || String(lead.metaStatus || "") === "failed";
}
function isPendingConfirmation(lead) {
    if (isFailedLead(lead) || lead.status === "skipped" || lead.status === "queued")
        return false;
    const meta = String(lead.metaStatus || "");
    return meta === "accepted" || meta === "sent" || meta === "";
}
function failureMessage(lead) {
    const code = String(lead.errorCode || "").trim();
    const hint = code ? META_SEND_ERROR_HINT[code] : "";
    const raw = String(lead.error || "").replace(/\s+/g, " ").trim();
    if (code === "131053" && hint)
        return hint;
    if (hint && (!raw || /não foi possível enviar|falha informada pela meta/i.test(raw)))
        return hint;
    return raw || hint || "Falha informada pela Meta.";
}
function summarizeBroadcastSendIssues(campaign) {
    const leads = Array.isArray(campaign?.leads) ? campaign.leads : [];
    const failedLeads = leads.filter(isFailedLead);
    return {
        pendingConfirmation: leads.filter(isPendingConfirmation).length,
        failureCount: failedLeads.length,
        failures: failedLeads.slice(0, MAX_FAILURES).map((lead) => ({
            recipient: maskCloudRecipient(lead.waId),
            errorCode: String(lead.errorCode || "").trim() || null,
            error: failureMessage(lead).slice(0, 180),
            source: String(lead.wamid || "").trim() ? "webhook" : "graph",
        })),
    };
}
