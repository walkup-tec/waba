"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatWhatsAppCommunityMessage = formatWhatsAppCommunityMessage;
exports.sendPushToWhatsAppCommunity = sendPushToWhatsAppCommunity;
exports.getPushCommunityConfig = getPushCommunityConfig;
exports.loadPushCommunityConfigForAdmin = loadPushCommunityConfigForAdmin;
exports.updatePushCommunityConfig = updatePushCommunityConfig;
const node_fs_1 = require("node:fs");
const evo_http_client_1 = require("../evo-http.client");
const data_path_1 = require("../data-path");
const evo_instance_key_1 = require("../instances/evo-instance-key");
const waba_public_base_url_1 = require("../lib/waba-public-base-url");
const waba_push_media_service_1 = require("./waba-push-media.service");
const waba_push_repository_1 = require("./waba-push.repository");
const waba_push_types_1 = require("./waba-push.types");
const EVO_API_BASE = String(process.env.EVO_API_URL || "").replace(/\/+$/, "");
const EVO_API_KEY = process.env.EVO_API_KEY || "";
const EVO_INSTANCES_URL = String(process.env.EVO_INSTANCES_URL || "").trim() ||
    `${EVO_API_BASE}/instance/fetchInstances`;
const PUSH_COMMUNITY_PHONE_HINT = String(process.env.WABA_PUSH_COMMUNITY_PHONE_HINT || "5181077770").trim();
const PUSH_COMMUNITY_JID_ENV = String(process.env.WABA_PUSH_COMMUNITY_ANNOUNCEMENT_GROUP_JID || "").trim();
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
function parseEvoInstancesList(raw) {
    if (Array.isArray(raw))
        return raw;
    if (raw && typeof raw === "object") {
        const record = raw;
        if (Array.isArray(record.response))
            return record.response;
        if (Array.isArray(record.data))
            return record.data;
        if (Array.isArray(record.instances))
            return record.instances;
    }
    return raw ? [raw] : [];
}
function loadEvoInstancesFromCache() {
    try {
        const filePath = (0, data_path_1.resolveDataFile)("evo-instances-cache.json");
        if (!(0, node_fs_1.existsSync)(filePath))
            return [];
        const parsed = JSON.parse((0, node_fs_1.readFileSync)(filePath, "utf8"));
        const items = Array.isArray(parsed?.items) ? parsed.items : [];
        return items
            .map((row) => (0, evo_instance_key_1.resolveEvoInstanceKey)(row) || String(row?.name || "").trim())
            .filter(Boolean);
    }
    catch {
        return [];
    }
}
function uniqueInstanceNames(names) {
    const seen = new Set();
    const out = [];
    for (const name of names) {
        const trimmed = String(name || "").trim();
        if (!trimmed)
            continue;
        const key = trimmed.toLowerCase();
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(trimmed);
    }
    return out;
}
function isEvoInstanceMissingError(result) {
    if (result.status !== 404)
        return false;
    const text = `${String(result.body || "")} ${JSON.stringify(result.json ?? "")}`.toLowerCase();
    return text.includes("does not exist") || text.includes("not found") || text.includes("instance");
}
function describeEvoError(result) {
    return `${String(result.body || result.error || "")} ${JSON.stringify(result.json ?? "")}`.toLowerCase();
}
/** Evolution instável (404 instância ou 500 Prisma/integrationSession) — tentar outra instância ou probe. */
function isEvoGroupListRecoverableError(result) {
    if (isEvoInstanceMissingError(result))
        return true;
    if (result.status >= 500)
        return true;
    const text = describeEvoError(result);
    return (text.includes("integrationsession") ||
        text.includes("prismaclient") ||
        text.includes("internal server error"));
}
async function recoverAnnouncementGroupAfterEvoFailure(instanceName, config) {
    const preferred = String(instanceName || "").trim();
    if (config.communityEvoInstance.toLowerCase() === preferred.toLowerCase()) {
        pushRepository.writeConfig({
            ...config,
            communityAnnouncementGroupJid: "",
        });
    }
    const resolved = await resolvePushCommunityEvoInstance(preferred).catch(() => "");
    if (resolved && resolved.toLowerCase() !== preferred.toLowerCase()) {
        try {
            return await fetchAnnouncementGroupJid(resolved, false);
        }
        catch {
            /* continua probe */
        }
    }
    const discovered = await discoverPushCommunityInstanceWithGroups(preferred);
    if (!discovered)
        return null;
    pushRepository.writeConfig({
        ...pushRepository.readConfig(),
        communityEvoInstance: discovered.instanceName,
        communityAnnouncementGroupJid: discovered.jid,
    });
    console.info(`[push] comunidade recuperada após falha Evolution: instância "${discovered.instanceName}", jid ${discovered.jid}`);
    return discovered;
}
function extractEvoInstanceNumber(inst) {
    const raw = inst.ownerJid ??
        inst.owner ??
        inst.number ??
        inst.phone ??
        inst.ownerNumber ??
        inst.profile?.owner ??
        "";
    const text = String(raw).trim();
    if (!text)
        return "";
    if (text.includes("@"))
        return text.split("@")[0].replace(/\D/g, "");
    return text.replace(/\D/g, "");
}
function scorePushCommunityInstance(name, preferred, numberDigits = "") {
    const lower = name.toLowerCase();
    const prefLower = preferred.toLowerCase();
    const hint = PUSH_COMMUNITY_PHONE_HINT.replace(/\D/g, "");
    if (!lower && !numberDigits)
        return 0;
    if (lower && lower === prefLower)
        return 100;
    if (hint && numberDigits.includes(hint))
        return 98;
    if (hint && lower.includes(hint))
        return 92;
    if (lower.includes("drax sistemas") && /\d{8,}/.test(lower))
        return 90;
    if (prefLower && lower.includes(prefLower))
        return 88;
    if (lower.includes("drax sistemas"))
        return 82;
    if (lower.includes("drax"))
        return 72;
    if (lower === "drax-oficial" && hint && numberDigits.endsWith(hint))
        return 97;
    if (lower === "walkup")
        return 62;
    return 0;
}
async function fetchEvoInstanceCatalog() {
    const catalog = new Map();
    for (const name of (0, waba_push_types_1.resolvePushCommunityEvoInstanceFallbacks)()) {
        const trimmed = String(name || "").trim();
        if (trimmed)
            catalog.set(trimmed.toLowerCase(), { name: trimmed, number: "" });
    }
    if (EVO_API_BASE && EVO_API_KEY) {
        const result = await (0, evo_http_client_1.evoHttpRequest)(EVO_INSTANCES_URL, "GET", {
            apiKey: EVO_API_KEY,
            retries: 2,
            timeoutMs: 20000,
        });
        if (result.ok) {
            for (const row of parseEvoInstancesList(result.json)) {
                const name = (0, evo_instance_key_1.resolveEvoInstanceKey)(row);
                if (!name)
                    continue;
                catalog.set(name.toLowerCase(), {
                    name,
                    number: extractEvoInstanceNumber(row),
                });
            }
        }
    }
    for (const name of loadEvoInstancesFromCache()) {
        const trimmed = String(name || "").trim();
        if (!trimmed || catalog.has(trimmed.toLowerCase()))
            continue;
        catalog.set(trimmed.toLowerCase(), { name: trimmed, number: "" });
    }
    return Array.from(catalog.values());
}
async function fetchEvoInstanceNames() {
    const catalog = await fetchEvoInstanceCatalog();
    return uniqueInstanceNames(catalog.map((row) => row.name));
}
async function probeAnnouncementGroupForInstance(instanceName) {
    const url = `${EVO_API_BASE}/group/fetchAllGroups/${encodeURIComponent(instanceName)}?getParticipants=false`;
    const result = await (0, evo_http_client_1.evoHttpRequest)(url, "GET", {
        apiKey: EVO_API_KEY,
        timeoutMs: 25000,
        retries: 1,
    });
    if (!result.ok)
        return null;
    const jid = pickAnnouncementGroupJid(parseGroupsPayload(result.json));
    if (!jid)
        return null;
    return { instanceName, jid };
}
async function discoverPushCommunityInstanceWithGroups(preferred) {
    const catalog = await fetchEvoInstanceCatalog();
    const ranked = catalog
        .map((row) => ({
        name: row.name,
        score: scorePushCommunityInstance(row.name, preferred, row.number),
    }))
        .sort((a, b) => b.score - a.score);
    const tryOrder = uniqueInstanceNames([
        ...ranked.filter((row) => row.score > 0).map((row) => row.name),
        ...ranked.filter((row) => row.score <= 0).map((row) => row.name),
    ]);
    for (const name of tryOrder) {
        const hit = await probeAnnouncementGroupForInstance(name);
        if (hit)
            return hit;
    }
    return null;
}
async function resolvePushCommunityEvoInstance(configured) {
    const preferred = String(configured || (0, waba_push_types_1.resolveDefaultPushCommunityEvoInstance)()).trim();
    const catalog = await fetchEvoInstanceCatalog();
    const names = catalog.map((row) => row.name);
    const exact = names.find((name) => name.toLowerCase() === preferred.toLowerCase());
    if (exact)
        return exact;
    if (!names.length) {
        throw new Error(`Não foi possível listar instâncias na Evolution. Configure WABA_PUSH_COMMUNITY_EVO_INSTANCE no .env (ex.: Drax Sistemas 5181077770).`);
    }
    let best = preferred;
    let bestScore = 0;
    for (const row of catalog) {
        const score = scorePushCommunityInstance(row.name, preferred, row.number);
        if (score > bestScore) {
            bestScore = score;
            best = row.name;
        }
    }
    if (bestScore <= 0) {
        throw new Error(`Instância "${preferred}" não existe na Evolution. Disponíveis: ${names.slice(0, 8).join(", ")}. Configure WABA_PUSH_COMMUNITY_EVO_INSTANCE no .env.`);
    }
    if (best !== preferred) {
        const hint = PUSH_COMMUNITY_PHONE_HINT.replace(/\D/g, "");
        const preferredDigits = preferred.replace(/\D/g, "");
        const keepPreferredInConfig = Boolean(hint) &&
            (preferredDigits.includes(hint) || preferred.toLowerCase().includes(hint));
        if (!keepPreferredInConfig) {
            const config = pushRepository.readConfig();
            pushRepository.writeConfig({
                ...config,
                communityEvoInstance: best,
                communityAnnouncementGroupJid: "",
            });
        }
        console.info(`[push] instância comunidade ajustada automaticamente: "${preferred}" → "${best}"`);
    }
    return best;
}
function resolveAnnouncementGroupJidOverride() {
    if (PUSH_COMMUNITY_JID_ENV.includes("@g.us"))
        return PUSH_COMMUNITY_JID_ENV;
    return "";
}
async function fetchAnnouncementGroupJid(instanceName, allowInstanceResolve = true) {
    const overrideJid = resolveAnnouncementGroupJidOverride();
    if (overrideJid)
        return { jid: overrideJid, instanceName };
    const config = pushRepository.readConfig();
    if (config.communityAnnouncementGroupJid) {
        return { jid: config.communityAnnouncementGroupJid, instanceName };
    }
    const url = `${EVO_API_BASE}/group/fetchAllGroups/${encodeURIComponent(instanceName)}?getParticipants=false`;
    const result = await (0, evo_http_client_1.evoHttpRequest)(url, "GET", { apiKey: EVO_API_KEY, timeoutMs: 25000, retries: 1 });
    if (!result.ok) {
        if (allowInstanceResolve && isEvoGroupListRecoverableError(result)) {
            const recovered = await recoverAnnouncementGroupAfterEvoFailure(instanceName, config);
            if (recovered)
                return recovered;
        }
        throw new Error(`Não foi possível listar grupos na Evolution (${result.status}): ${String(result.body || result.error || "").slice(0, 220)}. Configure WABA_PUSH_COMMUNITY_ANNOUNCEMENT_GROUP_JID no Easypanel ou reconecte a instância na Evolution.`);
    }
    const groups = parseGroupsPayload(result.json);
    const jid = pickAnnouncementGroupJid(groups);
    if (!jid) {
        throw new Error("Grupo de Anúncios da comunidade não encontrado. Configure communityAnnouncementGroupJid em waba-push-config.json ou WABA_PUSH_COMMUNITY_ANNOUNCEMENT_GROUP_JID no .env.");
    }
    pushRepository.writeConfig({
        ...config,
        communityEvoInstance: instanceName,
        communityAnnouncementGroupJid: jid,
    });
    return { jid, instanceName };
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
/** WhatsApp: *negrito* */
function formatWhatsAppCommunityMessage(title, body) {
    const safeTitle = String(title || "").trim();
    const safeBody = String(body || "").trim();
    const boldTitle = safeTitle ? `*${safeTitle.replace(/\*/g, "")}*` : "";
    if (boldTitle && safeBody)
        return `${boldTitle}\n\n${safeBody}`;
    if (boldTitle)
        return boldTitle;
    return safeBody;
}
async function sendPushToWhatsAppCommunity(title, text, image) {
    const config = pushRepository.readConfig();
    let instanceName = String(config.communityEvoInstance || (0, waba_push_types_1.resolveDefaultPushCommunityEvoInstance)()).trim();
    try {
        instanceName = await resolvePushCommunityEvoInstance(instanceName);
    }
    catch (error) {
        return {
            ok: false,
            detail: error instanceof Error ? error.message : "Falha ao resolver instância Evolution da comunidade.",
        };
    }
    const message = formatWhatsAppCommunityMessage(title, text);
    const hasImage = Boolean(image?.id);
    if (!message && !hasImage) {
        return { ok: false, detail: "Informe título/texto ou imagem para a comunidade." };
    }
    if (!EVO_API_BASE || !EVO_API_KEY) {
        return { ok: false, detail: "Evolution API não configurada (EVO_API_URL / EVO_API_KEY)." };
    }
    let groupJid = "";
    try {
        const resolved = await fetchAnnouncementGroupJid(instanceName);
        groupJid = resolved.jid;
        instanceName = resolved.instanceName;
    }
    catch (error) {
        return {
            ok: false,
            detail: error instanceof Error ? error.message : "Falha ao listar grupos na Evolution.",
        };
    }
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
async function loadPushCommunityConfigForAdmin() {
    const evoInstancesAvailable = await fetchEvoInstanceNames();
    const config = pushRepository.readConfig();
    try {
        await resolvePushCommunityEvoInstance(config.communityEvoInstance);
    }
    catch {
        /* mantém config atual; detalhe aparece no envio */
    }
    return {
        config: pushRepository.readConfig(),
        evoInstancesAvailable,
    };
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
