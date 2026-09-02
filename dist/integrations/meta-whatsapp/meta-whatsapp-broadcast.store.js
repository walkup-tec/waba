"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeBroadcastCampaignPreservingMeta = mergeBroadcastCampaignPreservingMeta;
exports.saveBroadcastCampaign = saveBroadcastCampaign;
exports.findBroadcastCampaign = findBroadcastCampaign;
exports.listBroadcastCampaigns = listBroadcastCampaigns;
exports.listAllBroadcastCampaigns = listAllBroadcastCampaigns;
exports.findBroadcastByIntakeCampaignId = findBroadcastByIntakeCampaignId;
exports.matchBroadcastLeadForMetaStatus = matchBroadcastLeadForMetaStatus;
exports.applyMetaStatusToBroadcastByWamid = applyMetaStatusToBroadcastByWamid;
exports.addClicksToBroadcastCampaign = addClicksToBroadcastCampaign;
exports.addClicksByBroadcastSlug = addClicksByBroadcastSlug;
exports.publicBroadcastCampaign = publicBroadcastCampaign;
const node_fs_1 = require("node:fs");
const path_1 = __importDefault(require("path"));
const data_path_1 = require("../../data-path");
const meta_whatsapp_messaging_types_1 = require("./meta-whatsapp-messaging.types");
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
            metaStatus: keepStored ? previous.metaStatus : lead.metaStatus || previous.metaStatus,
            error: lead.error || previous.error,
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
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, Math.max(1, limit));
}
function listAllBroadcastCampaigns(tenantId) {
    return readStore()
        .campaigns.filter((item) => item.tenantId === tenantId)
        .map((row) => ({ ...row, leads: row.leads.map((lead) => ({ ...lead })) }));
}
function findBroadcastByIntakeCampaignId(intakeCampaignId) {
    const id = String(intakeCampaignId || "").trim();
    if (!id)
        return null;
    const row = readStore().campaigns.find((item) => String(item.intakeCampaignId || "") === id);
    return row ? { ...row, leads: row.leads.map((lead) => ({ ...lead })) } : null;
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
            if (phoneNumberId && String(campaign.phoneNumberId || "") !== phoneNumberId)
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
        if (phoneNumberId && String(campaign.phoneNumberId || "") !== phoneNumberId)
            continue;
        const lead = campaign.leads.find((item) => recipientDigits(item.waId) === recipient && item.status !== "skipped");
        if (lead)
            return { campaign, lead };
    }
    return null;
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
    if (status === "failed") {
        lead.status = "failed";
        lead.error = lead.error || "Falha informada pela Meta.";
    }
    row.lastMetaStatusAt = new Date().toISOString();
    row.updatedAt = row.lastMetaStatusAt;
    writeStore(store);
    return { ...row, leads: row.leads.map((item) => ({ ...item })) };
}
function addClicksToBroadcastCampaign(campaignId, amount = 1) {
    const id = String(campaignId || "").trim();
    const delta = Math.max(0, Math.round(Number(amount) || 0));
    if (!id || !delta)
        return;
    const store = readStore();
    const row = store.campaigns.find((item) => item.id === id);
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
    const row = store.campaigns.find((item) => String(item.trackedSlug || "").toLowerCase() === key || String(item.shortSlug || "").toLowerCase() === key);
    if (!row)
        return;
    row.clicks = Math.max(0, Number(row.clicks || 0)) + delta;
    row.updatedAt = new Date().toISOString();
    writeStore(store);
}
function publicBroadcastCampaign(row) {
    return {
        id: row.id,
        connectionId: row.connectionId,
        templateName: row.templateName,
        language: row.language,
        phoneNumberId: row.phoneNumberId,
        shortUrl: row.shortUrl,
        clicks: Math.max(0, Number(row.clicks || 0)),
        intakeCampaignId: row.intakeCampaignId || undefined,
        status: row.status,
        total: row.total,
        sent: row.sent,
        failed: row.failed,
        skipped: row.skipped,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}
