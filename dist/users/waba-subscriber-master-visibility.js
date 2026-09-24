"use strict";
/**
 * Visibilidade e origem do assinante para usuários master.
 * walkup@walkuptec.com.br sempre vê todos e controla o liga/desliga.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveVisibleMasterProfitPercents = exports.resolveSubscriberOrigin = exports.canViewerSeeSubscriber = exports.defaultVisibleToMastersOnRegister = exports.isSubscriberVisibleToMasters = exports.shouldSkipEduardoCampaignEvoNotify = exports.isEduardoMaster = exports.isWalkupMasterEmail = exports.WALKUP_MASTER_EMAIL = void 0;
exports.WALKUP_MASTER_EMAIL = "walkup@walkuptec.com.br";
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const isWalkupMasterEmail = (email) => normalizeEmail(email) === exports.WALKUP_MASTER_EMAIL;
exports.isWalkupMasterEmail = isWalkupMasterEmail;
const isEduardoMaster = (user) => {
    const email = normalizeEmail(String(user.email || ""));
    const fromEnv = normalizeEmail(String(process.env.WABA_EDUARDO_MASTER_EMAIL || ""));
    if (fromEnv.includes("@") && email === fromEnv)
        return true;
    const role = String(user.role || "").trim().toLowerCase();
    if (role && role !== "master")
        return false;
    return /\beduardo\b/i.test(String(user.fullName || ""));
};
exports.isEduardoMaster = isEduardoMaster;
/**
 * Campanha de assinante com Visível desligado: Eduardo não recebe EVO.
 * Walkup e os demais masters continuam na lista.
 */
const shouldSkipEduardoCampaignEvoNotify = (master, subscriber) => {
    if (!subscriber)
        return false;
    if ((0, exports.isSubscriberVisibleToMasters)(subscriber))
        return false;
    return (0, exports.isEduardoMaster)(master);
};
exports.shouldSkipEduardoCampaignEvoNotify = shouldSkipEduardoCampaignEvoNotify;
const isSubscriberVisibleToMasters = (subscriber) => {
    if (!subscriber)
        return false;
    return subscriber.visibleToMasters !== false;
};
exports.isSubscriberVisibleToMasters = isSubscriberVisibleToMasters;
const defaultVisibleToMastersOnRegister = (input) => {
    if (normalizeEmail(String(input.createdByEmail || "")).includes("@"))
        return true;
    if (String(input.indicatorUserId || "").trim())
        return true;
    return false;
};
exports.defaultVisibleToMastersOnRegister = defaultVisibleToMastersOnRegister;
const canViewerSeeSubscriber = (viewerEmail, subscriber) => {
    if ((0, exports.isWalkupMasterEmail)(viewerEmail))
        return true;
    return (0, exports.isSubscriberVisibleToMasters)(subscriber);
};
exports.canViewerSeeSubscriber = canViewerSeeSubscriber;
const resolveSubscriberOrigin = (subscriber, users = []) => {
    const createdBy = normalizeEmail(String(subscriber?.createdByEmail || ""));
    if (createdBy.includes("@")) {
        const user = users.find((item) => normalizeEmail(String(item.email || "")) === createdBy);
        const name = String(user?.fullName || "").trim();
        return {
            kind: "user",
            label: name || createdBy,
            userEmail: createdBy,
        };
    }
    const indicatorId = String(subscriber?.indicatorUserId || "").trim();
    if (indicatorId) {
        const user = users.find((item) => String(item.id || "").trim() === indicatorId);
        const name = String(user?.fullName || "").trim();
        return {
            kind: "user",
            label: name || "Indicador",
            userEmail: normalizeEmail(String(user?.email || "")),
        };
    }
    return { kind: "site", label: "Site", userEmail: "" };
};
exports.resolveSubscriberOrigin = resolveSubscriberOrigin;
const isWalkupProfitParticipant = (participant) => {
    const email = normalizeEmail(participant.email);
    if (email === exports.WALKUP_MASTER_EMAIL)
        return true;
    if (email.startsWith("walkup@"))
        return true;
    return /\bwalkup\b/i.test(String(participant.label || ""));
};
/**
 * Assinante visível aos masters → percentuais da tela Financeiro > Split.
 * Assinante oculto → 100% Walkup e 0% Eduardo (e demais parceiros).
 */
const resolveVisibleMasterProfitPercents = (participants, subscriber) => {
    if (!participants.length)
        return participants;
    if ((0, exports.isSubscriberVisibleToMasters)(subscriber))
        return participants;
    const walkupIndex = participants.findIndex(isWalkupProfitParticipant);
    if (walkupIndex < 0)
        return participants;
    return participants.map((item, index) => ({
        ...item,
        sharePercent: index === walkupIndex ? 100 : 0,
    }));
};
exports.resolveVisibleMasterProfitPercents = resolveVisibleMasterProfitPercents;
