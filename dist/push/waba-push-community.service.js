"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushToWhatsAppCommunity = sendPushToWhatsAppCommunity;
exports.getPushCommunityConfig = getPushCommunityConfig;
exports.updatePushCommunityConfig = updatePushCommunityConfig;
const evo_http_client_1 = require("../evo-http.client");
const waba_public_base_url_1 = require("../lib/waba-public-base-url");
const waba_push_media_service_1 = require("./waba-push-media.service");
const waba_push_repository_1 = require("./waba-push.repository");
const EVO_API_BASE = String(process.env.EVO_API_URL || "").replace(/\/+$/, "");
const EVO_API_KEY = process.env.EVO_API_KEY || "";
const EVO_SEND_TEXT_URL_TEMPLATE = process.env.EVO_SEND_TEXT_URL_TEMPLATE || `${EVO_API_BASE}/message/sendText/{instance}`;
const EVO_SEND_MEDIA_URL_TEMPLATE = process.env.EVO_SEND_MEDIA_URL_TEMPLATE || `${EVO_API_BASE}/message/sendMedia/{instance}`;
const EVO_SEND_TEXT_V1 = process.env.EVO_SEND_TEXT_V1 === "1" || process.env.EVO_SEND_TEXT_V1 === "true";
const pushRepository = new waba_push_repository_1.WabaPushRepository();
function buildTemplateUrl(template, instanceName) {
    return String(template || "").replace(/\{instance\}/gi, encodeURIComponent(instanceName));
}
function parseGroupsPayload(raw) {
    if (Array.isArray(raw))
        return raw;
    if (raw && typeof raw === "object") {
        const record = raw;
        if (Array.isArray(record.response))
            return record.response;
        if (Array.isArray(record.data))
            return record.data;
        if (Array.isArray(record.groups))
            return record.groups;
    }
    return [];
}
function isTruthyFlag(value) {
    if (value === true || value === 1)
        return true;
    const text = String(value ?? "")
        .trim()
        .toLowerCase();
    return text === "true" || text === "1" || text === "yes";
}
function pickAnnouncementGroupJid(groups) {
    for (const group of groups) {
        if (isTruthyFlag(group.isCommunityAnnounce) ||
            isTruthyFlag(group.isCommunityAnnouncement) ||
            isTruthyFlag(group.announce) ||
            isTruthyFlag(group.announcement)) {
            const jid = String(group.id || group.jid || group.groupJid || "").trim();
            if (jid.includes("@g.us"))
                return jid;
        }
    }
    for (const group of groups) {
        const jid = String(group.id || group.jid || group.groupJid || "").trim();
        const subject = String(group.subject || group.name || "").toLowerCase();
        if (jid.includes("@g.us") && subject.includes("anúncio"))
            return jid;
    }
    return "";
}
async function fetchAnnouncementGroupJid(instanceName) {
    const config = pushRepository.readConfig();
    if (config.communityAnnouncementGroupJid) {
        return config.communityAnnouncementGroupJid;
    }
    const url = `${EVO_API_BASE}/group/fetchAllGroups/${encodeURIComponent(instanceName)}?getParticipants=false`;
    const result = await (0, evo_http_client_1.evoHttpRequest)(url, "GET", { apiKey: EVO_API_KEY });
    if (!result.ok) {
        throw new Error(`Não foi possível listar grupos na Evolution (${result.status}): ${String(result.body || result.error || "").slice(0, 180)}`);
    }
    const groups = parseGroupsPayload(result.json);
    const jid = pickAnnouncementGroupJid(groups);
    if (!jid) {
        throw new Error("Grupo de Anúncios da comunidade não encontrado. Configure communityAnnouncementGroupJid em waba-push-config.json ou envie uma mensagem manual no grupo e copie o JID do webhook.");
    }
    pushRepository.writeConfig({
        ...config,
        communityAnnouncementGroupJid: jid,
    });
    return jid;
}
function buildEvoTextBody(number, text) {
    return EVO_SEND_TEXT_V1
        ? { number, textMessage: { text } }
        : { number, text };
}
function resolvePublicMediaUrl(imageId) {
    const base = (0, waba_public_base_url_1.resolveWabaPublicBaseUrl)().replace(/\/+$/, "");
    return `${base}/push/public-media/${encodeURIComponent(imageId)}`;
}
async function sendPushToWhatsAppCommunity(text, image) {
    const config = pushRepository.readConfig();
    const instanceName = String(config.communityEvoInstance || "walkup").trim();
    const message = String(text || "").trim();
    const hasImage = Boolean(image?.id);
    if (!message && !hasImage) {
        return { ok: false, detail: "Informe texto ou imagem para a comunidade." };
    }
    if (!EVO_API_BASE || !EVO_API_KEY) {
        return { ok: false, detail: "Evolution API não configurada (EVO_API_URL / EVO_API_KEY)." };
    }
    const groupJid = await fetchAnnouncementGroupJid(instanceName);
    if (hasImage && image) {
        const mediaData = (0, waba_push_media_service_1.readPushMediaBase64)(image.id);
        if (!mediaData) {
            return { ok: false, detail: "Imagem do push não encontrada no servidor.", groupJid };
        }
        const sendUrl = buildTemplateUrl(EVO_SEND_MEDIA_URL_TEMPLATE, instanceName);
        const publicUrl = resolvePublicMediaUrl(image.id);
        const sendBody = {
            number: groupJid,
            mediatype: "image",
            mimetype: mediaData.mimeType,
            caption: message || undefined,
            fileName: image.fileName || "push-image.jpg",
            media: publicUrl,
        };
        let sendResult = await (0, evo_http_client_1.evoHttpRequest)(sendUrl, "POST", {
            apiKey: EVO_API_KEY,
            body: sendBody,
        });
        if (!sendResult.ok) {
            sendBody.media = mediaData.base64;
            sendResult = await (0, evo_http_client_1.evoHttpRequest)(sendUrl, "POST", {
                apiKey: EVO_API_KEY,
                body: sendBody,
            });
        }
        if (!sendResult.ok) {
            return {
                ok: false,
                detail: `Falha ao publicar imagem na comunidade (HTTP ${sendResult.status}): ${String(sendResult.body || sendResult.error || "").slice(0, 220)}`,
                groupJid,
            };
        }
        return {
            ok: true,
            detail: `Imagem publicada no grupo de anúncios (${groupJid}).`,
            groupJid,
        };
    }
    const sendUrl = buildTemplateUrl(EVO_SEND_TEXT_URL_TEMPLATE, instanceName);
    const sendResult = await (0, evo_http_client_1.evoHttpRequest)(sendUrl, "POST", {
        apiKey: EVO_API_KEY,
        body: buildEvoTextBody(groupJid, message),
    });
    if (!sendResult.ok) {
        return {
            ok: false,
            detail: `Falha ao publicar na comunidade (HTTP ${sendResult.status}): ${String(sendResult.body || sendResult.error || "").slice(0, 220)}`,
            groupJid,
        };
    }
    return {
        ok: true,
        detail: `Publicado no grupo de anúncios (${groupJid}).`,
        groupJid,
    };
}
function getPushCommunityConfig() {
    return pushRepository.readConfig();
}
function updatePushCommunityConfig(input) {
    const current = pushRepository.readConfig();
    return pushRepository.writeConfig({
        ...current,
        communityInviteLink: String(input.communityInviteLink ?? current.communityInviteLink).trim(),
        communityAnnouncementGroupJid: String(input.communityAnnouncementGroupJid ?? current.communityAnnouncementGroupJid).trim(),
        communityEvoInstance: String(input.communityEvoInstance ?? current.communityEvoInstance).trim(),
        updatedAt: new Date().toISOString(),
    });
}
