"use strict";
/**
 * Visão e split do Master Eduardo: vale só a partir de 23/09/2026 (00:00 BRT).
 * Cadastros, campanhas e pagamentos anteriores não mudam.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveEduardoOriginProfitPercents = exports.canViewerSeeFinanceiroOrder = exports.canViewerSeeCampaign = exports.canViewerSeeSubscriber = exports.subscriberBelongsToEduardo = exports.subscriberCreatedByEmail = exports.isEduardoScopedMaster = exports.resolveEduardoMasterEmails = exports.isOnOrAfterEduardoMasterScope = exports.EDUARDO_MASTER_SCOPE_SINCE_MS = exports.EDUARDO_MASTER_SCOPE_SINCE_ISO = exports.WALKUP_PROFIT_MASTER_EMAIL = void 0;
exports.WALKUP_PROFIT_MASTER_EMAIL = "walkup@walkuptec.com.br";
/** 23/09/2026 00:00 no horário de Brasília. */
exports.EDUARDO_MASTER_SCOPE_SINCE_ISO = "2026-09-23T03:00:00.000Z";
exports.EDUARDO_MASTER_SCOPE_SINCE_MS = Date.parse(exports.EDUARDO_MASTER_SCOPE_SINCE_ISO);
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const parseTime = (value) => {
    const ms = Date.parse(String(value || "").trim());
    return Number.isFinite(ms) ? ms : 0;
};
const isOnOrAfterEduardoMasterScope = (iso) => {
    const ms = parseTime(iso);
    return ms > 0 && ms >= exports.EDUARDO_MASTER_SCOPE_SINCE_MS;
};
exports.isOnOrAfterEduardoMasterScope = isOnOrAfterEduardoMasterScope;
const resolveEduardoMasterEmails = (users = []) => {
    const emails = new Set();
    const fromEnv = normalizeEmail(String(process.env.WABA_EDUARDO_MASTER_EMAIL || ""));
    if (fromEnv.includes("@"))
        emails.add(fromEnv);
    for (const user of users) {
        if (String(user.role || "").trim().toLowerCase() !== "master")
            continue;
        const email = normalizeEmail(String(user.email || ""));
        if (!email.includes("@"))
            continue;
        if (/\beduardo\b/i.test(String(user.fullName || "")))
            emails.add(email);
    }
    return [...emails];
};
exports.resolveEduardoMasterEmails = resolveEduardoMasterEmails;
const isEduardoScopedMaster = (email, users = []) => {
    const normalized = normalizeEmail(email);
    if (!normalized.includes("@"))
        return false;
    return (0, exports.resolveEduardoMasterEmails)(users).includes(normalized);
};
exports.isEduardoScopedMaster = isEduardoScopedMaster;
const subscriberCreatedByEmail = (subscriber) => normalizeEmail(String(subscriber?.createdByEmail || ""));
exports.subscriberCreatedByEmail = subscriberCreatedByEmail;
const subscriberBelongsToEduardo = (subscriber, eduardoEmail) => {
    const owner = normalizeEmail(eduardoEmail);
    if (!owner.includes("@") || !subscriber)
        return false;
    return (0, exports.subscriberCreatedByEmail)(subscriber) === owner;
};
exports.subscriberBelongsToEduardo = subscriberBelongsToEduardo;
const canViewerSeeSubscriber = (viewerEmail, subscriber, users = []) => {
    if (!(0, exports.isEduardoScopedMaster)(viewerEmail, users))
        return true;
    if (!subscriber)
        return false;
    if (!(0, exports.isOnOrAfterEduardoMasterScope)(subscriber.createdAt))
        return true;
    return (0, exports.subscriberBelongsToEduardo)(subscriber, viewerEmail);
};
exports.canViewerSeeSubscriber = canViewerSeeSubscriber;
const canViewerSeeCampaign = (viewerEmail, campaignCreatedAt, subscriber, users = []) => {
    if (!(0, exports.isEduardoScopedMaster)(viewerEmail, users))
        return true;
    if (!(0, exports.isOnOrAfterEduardoMasterScope)(campaignCreatedAt))
        return true;
    return (0, exports.canViewerSeeSubscriber)(viewerEmail, subscriber, users);
};
exports.canViewerSeeCampaign = canViewerSeeCampaign;
const canViewerSeeFinanceiroOrder = (viewerEmail, orderAt, subscriber, users = []) => {
    if (!(0, exports.isEduardoScopedMaster)(viewerEmail, users))
        return true;
    if (!(0, exports.isOnOrAfterEduardoMasterScope)(orderAt))
        return true;
    return (0, exports.canViewerSeeSubscriber)(viewerEmail, subscriber, users);
};
exports.canViewerSeeFinanceiroOrder = canViewerSeeFinanceiroOrder;
const isWalkupProfitParticipant = (participant) => {
    const email = normalizeEmail(participant.email);
    if (email === exports.WALKUP_PROFIT_MASTER_EMAIL)
        return true;
    if (email.startsWith("walkup@"))
        return true;
    return /\bwalkup\b/i.test(String(participant.label || ""));
};
/**
 * Lucro de pedido novo: 50/50 só se o assinante foi cadastrado pelo Eduardo.
 * Assinante de outro canal (a partir de 23/09) → 100% Walkup.
 * Pedidos e assinantes anteriores à data de corte mantêm o percentual configurado.
 * A tela Financeiro > Split continua exibindo a config (50%/50%).
 */
const resolveEduardoOriginProfitPercents = (participants, subscriber, paidAt, users = []) => {
    if (!participants.length)
        return participants;
    if (!(0, exports.isOnOrAfterEduardoMasterScope)(paidAt))
        return participants;
    if (subscriber && !(0, exports.isOnOrAfterEduardoMasterScope)(subscriber.createdAt))
        return participants;
    const eduardoEmails = new Set((0, exports.resolveEduardoMasterEmails)(users));
    const createdBy = (0, exports.subscriberCreatedByEmail)(subscriber);
    if (createdBy && eduardoEmails.has(createdBy))
        return participants;
    const walkupIndex = participants.findIndex(isWalkupProfitParticipant);
    if (walkupIndex < 0)
        return participants;
    return participants.map((item, index) => ({
        ...item,
        sharePercent: index === walkupIndex ? 100 : 0,
    }));
};
exports.resolveEduardoOriginProfitPercents = resolveEduardoOriginProfitPercents;
