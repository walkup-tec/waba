"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeBroadcastLeadStatusLogs = mergeBroadcastLeadStatusLogs;
exports.appendBroadcastLeadStatusLog = appendBroadcastLeadStatusLog;
exports.mergeBroadcastCampaignPreservingMeta = mergeBroadcastCampaignPreservingMeta;
exports.saveBroadcastCampaign = saveBroadcastCampaign;
exports.findBroadcastCampaign = findBroadcastCampaign;
exports.listBroadcastCampaigns = listBroadcastCampaigns;
exports.listAllBroadcastCampaigns = listAllBroadcastCampaigns;
exports.indexBroadcastProgressByIntakeId = indexBroadcastProgressByIntakeId;
exports.findBroadcastProgressByIntakeCampaignId = findBroadcastProgressByIntakeCampaignId;
exports.findBroadcastByIntakeCampaignId = findBroadcastByIntakeCampaignId;
exports.listActiveCloudBroadcasts = listActiveCloudBroadcasts;
exports.broadcastLeadIsPendingSend = broadcastLeadIsPendingSend;
exports.listResumableOrphanedBroadcasts = listResumableOrphanedBroadcasts;
exports.reopenOptInPtxBroadcastToContinue = reopenOptInPtxBroadcastToContinue;
exports.listStaleRunningBroadcastsWithoutPending = listStaleRunningBroadcastsWithoutPending;
exports.finalizeStaleRunningBroadcast = finalizeStaleRunningBroadcast;
exports.voidBroadcastCampaignForRetry = voidBroadcastCampaignForRetry;
exports.pauseBroadcastCampaign = pauseBroadcastCampaign;
exports.hideBroadcastCampaign = hideBroadcastCampaign;
exports.ensureVoidedFailedCloudBroadcasts = ensureVoidedFailedCloudBroadcasts;
exports.voidAbandonedCloudBroadcastsForRetry = voidAbandonedCloudBroadcastsForRetry;
exports.matchBroadcastLeadForMetaStatus = matchBroadcastLeadForMetaStatus;
exports.findBroadcastLeadForInbox = findBroadcastLeadForInbox;
exports.applyMetaStatusToBroadcastByWamid = applyMetaStatusToBroadcastByWamid;
exports.stampTemplateApprovedAtOnBroadcasts = stampTemplateApprovedAtOnBroadcasts;
exports.resolveBroadcastCampaignForShortClick = resolveBroadcastCampaignForShortClick;
exports.resolveBroadcastReportedClicks = resolveBroadcastReportedClicks;
exports.addClicksToBroadcastCampaign = addClicksToBroadcastCampaign;
exports.addClicksByBroadcastSlug = addClicksByBroadcastSlug;
exports.creditShortLinkClickToBroadcast = creditShortLinkClickToBroadcast;
exports.publicBroadcastCampaign = publicBroadcastCampaign;
const node_fs_1 = require("node:fs");
const meta_whatsapp_broadcast_void_1 = require("./meta-whatsapp-broadcast-void");
const path_1 = __importDefault(require("path"));
const data_path_1 = require("../../data-path");
const meta_whatsapp_messaging_types_1 = require("./meta-whatsapp-messaging.types");
const meta_whatsapp_broadcast_split_1 = require("./meta-whatsapp-broadcast-split");
const waba_campaign_schedule_1 = require("../../disparos/waba-campaign-schedule");
const FILE_NAME = "meta-whatsapp-broadcasts.json";
function emptyStore() {
    return { version: 1, campaigns: [] };
}
function readStore() {
    const filePath = (0, data_path_1.resolveDataFile)(FILE_NAME);
    const dir = path_1.default.dirname(filePath);
    if (!(0, node_fs_1.existsSync)(dir))
        (0, node_fs_1.mkdirSync)(dir, { recursive: true });
    if (!(0, node_fs_1.existsSync)(filePath))
        return emptyStore();
    try {
        const parsed = JSON.parse((0, node_fs_1.readFileSync)(filePath, "utf8"));
        if (!parsed || !Array.isArray(parsed.campaigns))
            return emptyStore();
        return { version: 1, campaigns: parsed.campaigns };
    }
    catch {
        return emptyStore();
    }
}
function writeStore(store) {
    const filePath = (0, data_path_1.resolveDataFile)(FILE_NAME);
    const dir = path_1.default.dirname(filePath);
    if (!(0, node_fs_1.existsSync)(dir))
        (0, node_fs_1.mkdirSync)(dir, { recursive: true });
    const tmp = `${filePath}.tmp`;
    (0, node_fs_1.writeFileSync)(tmp, JSON.stringify(store, null, 2), "utf8");
    (0, node_fs_1.writeFileSync)(filePath, (0, node_fs_1.readFileSync)(tmp));
}
function leadMetaRank(lead) {
    const meta = lead.metaStatus;
    if (meta === "read")
        return 4;
    if (meta === "delivered")
        return 3;
    if (meta === "sent")
        return 2;
    if (meta === "accepted")
        return 1;
    if (meta === "failed" || lead.status === "failed")
        return 50;
    if (lead.status === "sent")
        return 1;
    return 0;
}
function sameBroadcastLead(left, right) {
    const leftWamid = String(left.wamid || "").trim();
    const rightWamid = String(right.wamid || "").trim();
    if (leftWamid && rightWamid && leftWamid === rightWamid)
        return true;
    const leftWa = String(left.waId || "").replace(/\D/g, "");
    const rightWa = String(right.waId || "").replace(/\D/g, "");
    return Boolean(leftWa && rightWa && leftWa === rightWa);
}
const STATUS_LOG_LIMIT = 8;
function statusLogKey(entry) {
    return `${entry.status}|${entry.at}|${entry.errorCode || ""}`;
}
function mergeBroadcastLeadStatusLogs(left, right) {
    const rows = [...(left || []), ...(right || [])].filter((item) => item && item.status && item.at);
    if (!rows.length)
        return undefined;
    const seen = new Set();
    const merged = [];
    for (const item of rows.sort((a, b) => String(a.at).localeCompare(String(b.at)))) {
        const key = statusLogKey(item);
        if (seen.has(key))
            continue;
        seen.add(key);
        merged.push({
            status: item.status,
            at: item.at,
            ...(item.errorCode ? { errorCode: String(item.errorCode).slice(0, 32) } : {}),
        });
    }
    return merged.slice(-STATUS_LOG_LIMIT);
}
function appendBroadcastLeadStatusLog(lead, entry) {
    const last = (lead.statusLog || [])[(lead.statusLog || []).length - 1];
    if (last && last.status === entry.status && (last.errorCode || "") === (entry.errorCode || "")) {
        return;
    }
    lead.statusLog = mergeBroadcastLeadStatusLogs(lead.statusLog, [entry]);
}
/** O envio regrava o JSON; não pode apagar delivered/read que o webhook já gravou. */
function mergeBroadcastCampaignPreservingMeta(incoming, stored) {
    if (!stored)
        return incoming;
    const mergedLeads = incoming.leads.map((lead) => {
        const previous = stored.leads.find((item) => sameBroadcastLead(item, lead));
        if (!previous)
            return lead;
        const keepStored = leadMetaRank(previous) > leadMetaRank(lead);
        return {
            ...lead,
            wamid: String(lead.wamid || previous.wamid || "").trim() || lead.wamid || previous.wamid,
            phoneNumberId: lead.phoneNumberId || previous.phoneNumberId,
            connectionId: lead.connectionId || previous.connectionId,
            metaStatus: keepStored ? previous.metaStatus : lead.metaStatus || previous.metaStatus,
            error: lead.error || previous.error,
            errorCode: previous.errorCode || lead.errorCode,
            statusLog: mergeBroadcastLeadStatusLogs(previous.statusLog, lead.statusLog),
        };
    });
    const storedMetaMs = Date.parse(String(stored.lastMetaStatusAt || "")) || 0;
    const incomingMetaMs = Date.parse(String(incoming.lastMetaStatusAt || "")) || 0;
    return {
        ...incoming,
        leads: mergedLeads,
        lastMetaStatusAt: storedMetaMs > incomingMetaMs ? stored.lastMetaStatusAt : incoming.lastMetaStatusAt || stored.lastMetaStatusAt,
        clicks: Math.max(Number(incoming.clicks || 0), Number(stored.clicks || 0)),
        reportFinalizedAt: incoming.reportFinalizedAt || stored.reportFinalizedAt,
        sendStartedAt: stored.sendStartedAt || incoming.sendStartedAt,
        sendFinishedAt: incoming.sendFinishedAt || stored.sendFinishedAt,
        templateApprovedAt: stored.templateApprovedAt || incoming.templateApprovedAt,
        voidedAt: incoming.voidedAt || stored.voidedAt,
        pausedAt: incoming.pausedAt || stored.pausedAt,
        hiddenAt: incoming.hiddenAt || stored.hiddenAt,
    };
}
function saveBroadcastCampaign(row) {
    const store = readStore();
    const index = store.campaigns.findIndex((item) => item.id === row.id);
    const stored = index >= 0 ? store.campaigns[index] : undefined;
    const next = mergeBroadcastCampaignPreservingMeta({ ...row, updatedAt: new Date().toISOString() }, stored);
    if (index >= 0)
        store.campaigns[index] = next;
    else
        store.campaigns.push(next);
    writeStore(store);
    return next;
}
function findBroadcastCampaign(tenantId, id) {
    const row = readStore().campaigns.find((item) => item.id === id && item.tenantId === tenantId);
    return row ? { ...row, leads: row.leads.map((lead) => ({ ...lead })) } : null;
}
function listBroadcastCampaigns(tenantId, limit = 8) {
    return listAllBroadcastCampaigns(tenantId)
        .filter((row) => !(0, meta_whatsapp_broadcast_void_1.isBroadcastHidden)(row))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, Math.max(1, limit));
}
function listAllBroadcastCampaigns(tenantId) {
    return readStore()
        .campaigns.filter((item) => item.tenantId === tenantId)
        .map((row) => ({ ...row, leads: row.leads.map((lead) => ({ ...lead })) }));
}
function isActiveBroadcastRow(row) {
    return !(0, meta_whatsapp_broadcast_void_1.isBroadcastVoided)(row) && !(0, meta_whatsapp_broadcast_void_1.isBroadcastHidden)(row);
}
function indexBroadcastProgressByIntakeId() {
    const map = new Map();
    const createdAtById = new Map();
    for (const row of readStore().campaigns) {
        const id = String(row.intakeCampaignId || "").trim();
        if (!id || !isActiveBroadcastRow(row))
            continue;
        const createdAt = String(row.createdAt || "");
        const previousCreated = createdAtById.get(id) || "";
        if (previousCreated && previousCreated > createdAt)
            continue;
        createdAtById.set(id, createdAt);
        map.set(id, {
            status: row.status,
            sendStartedAt: row.sendStartedAt,
            sendFinishedAt: row.sendFinishedAt,
            scheduledSendAt: row.scheduledSendAt,
        });
    }
    return map;
}
function findBroadcastProgressByIntakeCampaignId(intakeCampaignId) {
    const id = String(intakeCampaignId || "").trim();
    if (!id)
        return null;
    return indexBroadcastProgressByIntakeId().get(id) || null;
}
function findBroadcastByIntakeCampaignId(intakeCampaignId) {
    const id = String(intakeCampaignId || "").trim();
    if (!id)
        return null;
    const rows = readStore()
        .campaigns.filter((item) => String(item.intakeCampaignId || "") === id && isActiveBroadcastRow(item))
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    const row = rows[0];
    return row ? { ...row, leads: row.leads.map((lead) => ({ ...lead })) } : null;
}
/** running/queued sem void/pause/hide — lotes que o operacional não deve interromper com Redeploy. */
function listActiveCloudBroadcasts() {
    return readStore()
        .campaigns.filter((row) => {
        if ((0, meta_whatsapp_broadcast_void_1.isBroadcastStoppedByOperator)(row))
            return false;
        return row.status === "running" || row.status === "queued";
    })
        .map((row) => ({ ...row, leads: row.leads.map((lead) => ({ ...lead })) }));
}
/** Lead ainda não processado pelo loop de envio (Graph). */
function broadcastLeadIsPendingSend(lead) {
    const status = String(lead?.status || "").trim();
    return !status || status === "queued";
}
/**
 * Disparos Cloud com status running/queued, sem void, e com leads pendentes.
 * Após Redeploy o loop em memória some — estes precisam de resume no boot.
 */
function listResumableOrphanedBroadcasts() {
    return readStore()
        .campaigns.filter((row) => {
        if ((0, meta_whatsapp_broadcast_void_1.isBroadcastStoppedByOperator)(row))
            return false;
        if (row.status !== "running" && row.status !== "queued")
            return false;
        if (row.status !== "running" && (0, waba_campaign_schedule_1.isScheduledSendPending)(row.scheduledSendAt))
            return false;
        return (row.leads || []).some(broadcastLeadIsPendingSend);
    })
        .map((row) => ({ ...row, leads: row.leads.map((lead) => ({ ...lead })) }));
}
/**
 * Reabre o Disparo Cloud da Opt in PTX (paulo_teix_v2_2).
 * Falhas sem wamid voltam para a fila; sent/skipped e quem já tem wamid não reenviam.
 */
function reopenOptInPtxBroadcastToContinue() {
    const store = readStore();
    const rows = store.campaigns
        .filter((item) => (0, meta_whatsapp_broadcast_void_1.isOptInPtxResumeCampaign)(item))
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    const row = rows[0];
    if (!row)
        return null;
    if ((0, meta_whatsapp_broadcast_void_1.isBroadcastPaused)(row) || (0, meta_whatsapp_broadcast_void_1.isBroadcastHidden)(row))
        return null;
    let queuedReset = 0;
    for (const lead of row.leads || []) {
        const status = String(lead.status || "").trim();
        if (status === "sent" || status === "skipped")
            continue;
        if (String(lead.wamid || "").trim())
            continue;
        if (status === "failed" || !status) {
            lead.status = "queued";
            delete lead.metaStatus;
            delete lead.error;
            delete lead.errorCode;
            queuedReset += 1;
        }
    }
    row.sent = (row.leads || []).filter((lead) => String(lead.status || "") === "sent").length;
    row.failed = (row.leads || []).filter((lead) => String(lead.status || "") === "failed").length;
    if (!(row.leads || []).some(broadcastLeadIsPendingSend))
        return null;
    const alreadyOpen = (row.status === "running" || row.status === "queued") &&
        !(0, meta_whatsapp_broadcast_void_1.isBroadcastStoppedByOperator)(row) &&
        queuedReset === 0;
    if (!alreadyOpen) {
        const now = new Date().toISOString();
        row.status = "running";
        row.voidedAt = undefined;
        row.pausedAt = undefined;
        row.sendFinishedAt = undefined;
        row.updatedAt = now;
        writeStore(store);
    }
    return { ...row, leads: row.leads.map((lead) => ({ ...lead })) };
}
/** running sem leads pendentes (tudo sent/failed/skipped) — fechar no boot. */
function listStaleRunningBroadcastsWithoutPending() {
    return readStore()
        .campaigns.filter((row) => {
        if ((0, meta_whatsapp_broadcast_void_1.isBroadcastStoppedByOperator)(row))
            return false;
        if (row.status !== "running")
            return false;
        return !(row.leads || []).some(broadcastLeadIsPendingSend);
    })
        .map((row) => ({ ...row, leads: row.leads.map((lead) => ({ ...lead })) }));
}
function finalizeStaleRunningBroadcast(campaignId) {
    const id = String(campaignId || "").trim();
    if (!id)
        return null;
    const store = readStore();
    const row = store.campaigns.find((item) => item.id === id);
    if (!row || (0, meta_whatsapp_broadcast_void_1.isBroadcastStoppedByOperator)(row))
        return null;
    if (row.status !== "running")
        return null;
    if ((row.leads || []).some(broadcastLeadIsPendingSend))
        return null;
    const now = new Date().toISOString();
    row.status = row.failed === row.total ? "failed" : "done";
    row.sendFinishedAt = row.sendFinishedAt || now;
    row.updatedAt = now;
    writeStore(store);
    return { ...row, leads: row.leads.map((lead) => ({ ...lead })) };
}
function voidBroadcastCampaignForRetry(campaignId) {
    const id = String(campaignId || "").trim();
    if (!id)
        return null;
    const store = readStore();
    const row = store.campaigns.find((item) => item.id === id);
    if (!row)
        return null;
    if (row.voidedAt)
        return { ...row, leads: row.leads.map((lead) => ({ ...lead })) };
    const now = new Date().toISOString();
    row.status = "failed";
    row.voidedAt = now;
    row.updatedAt = now;
    writeStore(store);
    return { ...row, leads: row.leads.map((lead) => ({ ...lead })) };
}
function pauseBroadcastCampaign(campaignId) {
    const id = String(campaignId || "").trim();
    if (!id)
        return null;
    const store = readStore();
    const row = store.campaigns.find((item) => item.id === id);
    if (!row)
        return null;
    if (row.pausedAt)
        return { ...row, leads: row.leads.map((lead) => ({ ...lead })) };
    const now = new Date().toISOString();
    row.pausedAt = now;
    row.updatedAt = now;
    writeStore(store);
    return { ...row, leads: row.leads.map((lead) => ({ ...lead })) };
}
function hideBroadcastCampaign(campaignId) {
    const id = String(campaignId || "").trim();
    if (!id)
        return null;
    const store = readStore();
    const row = store.campaigns.find((item) => item.id === id);
    if (!row)
        return null;
    if (row.hiddenAt)
        return { ...row, leads: row.leads.map((lead) => ({ ...lead })) };
    const now = new Date().toISOString();
    if (!row.voidedAt && !row.pausedAt && (row.status === "queued" || row.status === "running")) {
        row.pausedAt = now;
    }
    row.hiddenAt = now;
    row.updatedAt = now;
    writeStore(store);
    return { ...row, leads: row.leads.map((lead) => ({ ...lead })) };
}
function ensureVoidedFailedCloudBroadcasts() {
    return voidAbandonedCloudBroadcastsForRetry(meta_whatsapp_broadcast_void_1.shouldVoidCloudBroadcast);
}
function voidAbandonedCloudBroadcastsForRetry(shouldVoid) {
    const store = readStore();
    const now = new Date().toISOString();
    let changed = 0;
    for (const row of store.campaigns) {
        if (row.voidedAt || row.pausedAt || row.hiddenAt)
            continue;
        if (!shouldVoid(row))
            continue;
        row.status = "failed";
        row.voidedAt = now;
        row.updatedAt = now;
        changed += 1;
    }
    if (changed)
        writeStore(store);
    return changed;
}
function recipientDigits(value) {
    return String(value || "").replace(/\D/g, "");
}
function matchBroadcastLeadForMetaStatus(campaigns, input) {
    const wamid = String(input.wamid || "").trim();
    const recipient = recipientDigits(input.recipientId);
    const phoneNumberId = String(input.phoneNumberId || "").trim();
    const ranked = [...campaigns].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    if (wamid) {
        for (const campaign of ranked) {
            if (phoneNumberId && !(0, meta_whatsapp_broadcast_split_1.campaignUsesPhoneNumber)(campaign, phoneNumberId))
                continue;
            const lead = campaign.leads.find((item) => String(item.wamid || "").trim() === wamid);
            if (lead)
                return { campaign, lead };
        }
        for (const campaign of ranked) {
            const lead = campaign.leads.find((item) => String(item.wamid || "").trim() === wamid);
            if (lead)
                return { campaign, lead };
        }
    }
    if (!recipient)
        return null;
    for (const campaign of ranked) {
        if (phoneNumberId && !(0, meta_whatsapp_broadcast_split_1.campaignUsesPhoneNumber)(campaign, phoneNumberId))
            continue;
        const lead = campaign.leads.find((item) => recipientDigits(item.waId) === recipient && item.status !== "skipped");
        if (lead)
            return { campaign, lead };
    }
    return null;
}
function findBroadcastLeadForInbox(input) {
    const store = readStore();
    const tenantId = String(input.tenantId || "").trim();
    const campaigns = tenantId
        ? store.campaigns.filter((row) => row.tenantId === tenantId)
        : store.campaigns;
    return matchBroadcastLeadForMetaStatus(campaigns, input);
}
function applyMetaStatusToBroadcastByWamid(wamid, status, extras) {
    const store = readStore();
    const matched = matchBroadcastLeadForMetaStatus(store.campaigns, {
        wamid,
        recipientId: extras?.recipientId,
        phoneNumberId: extras?.phoneNumberId,
    });
    if (!matched)
        return null;
    const { campaign: row, lead } = matched;
    const current = lead.metaStatus || (lead.status === "sent" ? "accepted" : lead.status === "failed" ? "failed" : "queued");
    if (!(0, meta_whatsapp_messaging_types_1.canAdvanceMetaMessageStatus)(current, status) && current !== status)
        return row;
    lead.metaStatus = status;
    if (wamid && !lead.wamid)
        lead.wamid = String(wamid).trim();
    const errorCode = String(extras?.errorCode || "").trim().slice(0, 32);
    const errorMessage = String(extras?.errorMessage || "").replace(/\s+/g, " ").trim().slice(0, 180);
    if (status === "failed") {
        lead.status = "failed";
        if (errorCode)
            lead.errorCode = errorCode;
        lead.error = errorMessage || lead.error || "Falha informada pela Meta.";
    }
    const occurredAt = String(extras?.occurredAt || "").trim() || new Date().toISOString();
    appendBroadcastLeadStatusLog(lead, {
        status,
        at: occurredAt,
        ...(errorCode ? { errorCode } : {}),
    });
    row.lastMetaStatusAt = new Date().toISOString();
    row.updatedAt = row.lastMetaStatusAt;
    writeStore(store);
    if (errorCode === "131053" &&
        !(0, meta_whatsapp_broadcast_void_1.isOptInPtxResumeCampaign)(row) &&
        (0, meta_whatsapp_broadcast_void_1.shouldAbortBroadcastOnHeaderMediaFailure)(row) &&
        !row.voidedAt) {
        return voidBroadcastCampaignForRetry(row.id) || row;
    }
    return { ...row, leads: row.leads.map((item) => ({ ...item })) };
}
function stampTemplateApprovedAtOnBroadcasts(input) {
    const tenantId = String(input.tenantId || "").trim();
    const approvedAt = String(input.approvedAt || "").trim();
    if (!tenantId || !approvedAt)
        return;
    const templateId = String(input.templateId || "").trim();
    const templateName = String(input.templateName || "").trim().toLowerCase();
    const language = String(input.language || "").trim().toLowerCase();
    if (!templateId && !templateName)
        return;
    const store = readStore();
    let changed = false;
    for (const row of store.campaigns) {
        if (String(row.tenantId || "") !== tenantId)
            continue;
        if (row.templateApprovedAt)
            continue;
        const sameId = templateId && String(row.templateId || "").trim() === templateId;
        const sameName = templateName &&
            String(row.templateName || "").trim().toLowerCase() === templateName &&
            (!language || String(row.language || "").trim().toLowerCase() === language);
        if (!sameId && !sameName)
            continue;
        row.templateApprovedAt = approvedAt;
        row.updatedAt = new Date().toISOString();
        changed = true;
    }
    if (changed)
        writeStore(store);
}
function resolveBroadcastCampaignForShortClick(campaigns, input) {
    const ids = [input.campaignId, input.intakeCampaignId]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .filter((value, index, all) => all.indexOf(value) === index);
    const slug = String(input.slug || "").trim().toLowerCase();
    const usable = campaigns.filter((row) => isActiveBroadcastRow(row));
    for (const campaignId of ids) {
        const byId = usable.find((item) => item.id === campaignId);
        if (byId)
            return byId;
        const byIntake = usable
            .filter((item) => String(item.intakeCampaignId || "").trim() === campaignId)
            .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
        if (byIntake[0])
            return byIntake[0];
    }
    if (!slug)
        return null;
    return (usable.find((item) => String(item.trackedSlug || "").toLowerCase() === slug ||
        String(item.shortSlug || "").toLowerCase() === slug) || null);
}
function resolveBroadcastReportedClicks(campaign, shortenerClicks) {
    const stored = Math.max(0, Math.round(Number(campaign.clicks) || 0));
    const start = Math.max(0, Math.round(Number(campaign.clicksAtStart) || 0));
    if (shortenerClicks == null || !Number.isFinite(Number(shortenerClicks)))
        return stored;
    const delta = Math.max(0, Math.round(Number(shortenerClicks) || 0) - start);
    return Math.max(stored, delta);
}
function addClicksToBroadcastCampaign(campaignId, amount = 1) {
    const id = String(campaignId || "").trim();
    const delta = Math.max(0, Math.round(Number(amount) || 0));
    if (!id || !delta)
        return;
    const store = readStore();
    const row = resolveBroadcastCampaignForShortClick(store.campaigns, { campaignId: id });
    if (!row)
        return;
    row.clicks = Math.max(0, Number(row.clicks || 0)) + delta;
    row.updatedAt = new Date().toISOString();
    writeStore(store);
}
function addClicksByBroadcastSlug(slug, amount = 1) {
    const key = String(slug || "").trim().toLowerCase();
    const delta = Math.max(0, Math.round(Number(amount) || 0));
    if (!key || !delta)
        return;
    const store = readStore();
    const row = resolveBroadcastCampaignForShortClick(store.campaigns, { slug: key });
    if (!row)
        return;
    row.clicks = Math.max(0, Number(row.clicks || 0)) + delta;
    row.updatedAt = new Date().toISOString();
    writeStore(store);
}
/** Clique no /s/:slug: tenta o id do disparo, o id da campanha do assinante e o slug do botão. */
function creditShortLinkClickToBroadcast(input) {
    const delta = Math.max(0, Math.round(Number(input.amount ?? 1) || 0));
    if (!delta)
        return false;
    const store = readStore();
    const row = resolveBroadcastCampaignForShortClick(store.campaigns, input);
    if (!row)
        return false;
    row.clicks = Math.max(0, Number(row.clicks || 0)) + delta;
    row.updatedAt = new Date().toISOString();
    writeStore(store);
    return true;
}
function publicBroadcastCampaign(row) {
    return {
        id: row.id,
        connectionId: row.connectionId,
        templateName: row.templateName,
        language: row.language,
        phoneNumberId: row.phoneNumberId,
        phoneNumberIds: Array.isArray(row.phoneNumberIds) && row.phoneNumberIds.length
            ? row.phoneNumberIds.map((id) => String(id || "").trim()).filter(Boolean)
            : [String(row.phoneNumberId || "").trim()].filter(Boolean),
        phoneQuotas: Array.isArray(row.phoneQuotas) ? row.phoneQuotas : undefined,
        phoneBindings: Array.isArray(row.phoneBindings) ? row.phoneBindings : undefined,
        shortUrl: row.shortUrl,
        clicks: Math.max(0, Number(row.clicks || 0)),
        intakeCampaignId: row.intakeCampaignId || undefined,
        status: row.status,
        voidedAt: row.voidedAt || undefined,
        pausedAt: row.pausedAt || undefined,
        sendStartedAt: row.sendStartedAt || undefined,
        total: row.total,
        sent: row.sent,
        failed: row.failed,
        skipped: row.skipped,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        scheduledSendAt: row.scheduledSendAt || undefined,
        scheduledSendLabel: (0, waba_campaign_schedule_1.formatScheduledSendLabel)(row.scheduledSendAt) || undefined,
    };
}
