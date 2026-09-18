"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listBotFlows = listBotFlows;
exports.readBotFlow = readBotFlow;
exports.upsertBotFlow = upsertBotFlow;
exports.deleteBotFlow = deleteBotFlow;
exports.listBotPhoneLinks = listBotPhoneLinks;
exports.getBotIdForPhone = getBotIdForPhone;
exports.setBotPhoneLink = setBotPhoneLink;
exports.readConversationBotRun = readConversationBotRun;
exports.writeConversationBotRun = writeConversationBotRun;
exports.tryClaimBotMessage = tryClaimBotMessage;
exports.wasBotMessageClaimed = wasBotMessageClaimed;
exports.resetWabaBotStoreForTests = resetWabaBotStoreForTests;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const data_path_1 = require("../../../data-path");
const waba_bot_flow_normalize_1 = require("./waba-bot-flow.normalize");
const TENANT_RE = /^[a-zA-Z0-9._-]{8,80}$/;
function safeTenantId(tenantId) {
    const id = String(tenantId || "").trim();
    if (!id)
        throw new Error("Tenant inválido para bots.");
    if (TENANT_RE.test(id))
        return id;
    return (0, node_crypto_1.createHash)("sha256").update(id).digest("hex").slice(0, 40);
}
function tenantRoot(tenantId) {
    return node_path_1.default.join((0, data_path_1.resolveDataDir)(), "meta-whatsapp", "bots", safeTenantId(tenantId));
}
function flowsDir(tenantId) {
    return node_path_1.default.join(tenantRoot(tenantId), "flows");
}
function runsDir(tenantId) {
    return node_path_1.default.join(tenantRoot(tenantId), "runs");
}
function claimsDir(tenantId) {
    return node_path_1.default.join(tenantRoot(tenantId), "claims");
}
function linksPath(tenantId) {
    return node_path_1.default.join(tenantRoot(tenantId), "phone-links.json");
}
function ensureDir(dir) {
    (0, node_fs_1.mkdirSync)(dir, { recursive: true });
}
function readJson(file, fallback) {
    try {
        if (!(0, node_fs_1.existsSync)(file))
            return fallback;
        return JSON.parse((0, node_fs_1.readFileSync)(file, "utf8"));
    }
    catch {
        return fallback;
    }
}
function listBotFlows(tenantId) {
    const dir = flowsDir(tenantId);
    if (!(0, node_fs_1.existsSync)(dir))
        return [];
    return (0, node_fs_1.readdirSync)(dir)
        .filter((file) => file.endsWith(".json"))
        .map((file) => readBotFlow(tenantId, file.slice(0, -5)))
        .filter((row) => Boolean(row))
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}
function readBotFlow(tenantId, botId) {
    const id = String(botId || "").trim();
    if (!id)
        return null;
    const file = node_path_1.default.join(flowsDir(tenantId), `${id}.json`);
    if (!(0, node_fs_1.existsSync)(file))
        return null;
    try {
        return (0, waba_bot_flow_normalize_1.normalizeBotDraft)(JSON.parse((0, node_fs_1.readFileSync)(file, "utf8")));
    }
    catch {
        return null;
    }
}
function upsertBotFlow(tenantId, draft) {
    const next = (0, waba_bot_flow_normalize_1.normalizeBotDraft)({ ...draft, updatedAt: new Date().toISOString() });
    ensureDir(flowsDir(tenantId));
    (0, node_fs_1.writeFileSync)(node_path_1.default.join(flowsDir(tenantId), `${next.id}.json`), JSON.stringify(next), "utf8");
    return next;
}
function deleteBotFlow(tenantId, botId) {
    const id = String(botId || "").trim();
    if (!id)
        return false;
    const file = node_path_1.default.join(flowsDir(tenantId), `${id}.json`);
    if (!(0, node_fs_1.existsSync)(file))
        return false;
    (0, node_fs_1.unlinkSync)(file);
    const links = listBotPhoneLinks(tenantId).filter((row) => row.botId !== id);
    writePhoneLinks(tenantId, links);
    return true;
}
function writePhoneLinks(tenantId, links) {
    ensureDir(tenantRoot(tenantId));
    (0, node_fs_1.writeFileSync)(linksPath(tenantId), JSON.stringify(links), "utf8");
}
function listBotPhoneLinks(tenantId) {
    const raw = readJson(linksPath(tenantId), []);
    return Array.isArray(raw)
        ? raw.filter((row) => row && row.phoneNumberId && row.botId)
        : [];
}
function getBotIdForPhone(tenantId, phoneNumberId) {
    const phone = String(phoneNumberId || "").trim();
    if (!phone)
        return null;
    return listBotPhoneLinks(tenantId).find((row) => row.phoneNumberId === phone)?.botId || null;
}
function setBotPhoneLink(input) {
    const phone = String(input.phoneNumberId || "").trim();
    if (!phone)
        throw new Error("Número Inbox inválido.");
    const links = listBotPhoneLinks(input.tenantId).filter((row) => row.phoneNumberId !== phone);
    const botId = String(input.botId || "").trim();
    if (botId) {
        if (!readBotFlow(input.tenantId, botId))
            throw new Error("Bot não encontrado neste tenant.");
        links.push({
            tenantId: input.tenantId,
            phoneNumberId: phone,
            botId,
            updatedAt: new Date().toISOString(),
        });
    }
    writePhoneLinks(input.tenantId, links);
    return links;
}
function readConversationBotRun(tenantId, conversationId) {
    const id = String(conversationId || "").trim();
    if (!id)
        return null;
    const file = node_path_1.default.join(runsDir(tenantId), `${id}.json`);
    return readJson(file, null);
}
function writeConversationBotRun(tenantId, conversationId, run) {
    const id = String(conversationId || "").trim();
    if (!id)
        return;
    ensureDir(runsDir(tenantId));
    const file = node_path_1.default.join(runsDir(tenantId), `${id}.json`);
    if (!run) {
        if ((0, node_fs_1.existsSync)(file))
            (0, node_fs_1.unlinkSync)(file);
        return;
    }
    (0, node_fs_1.writeFileSync)(file, JSON.stringify(run), "utf8");
}
function tryClaimBotMessage(input) {
    const messageId = String(input.messageId || "").trim();
    ensureDir(claimsDir(input.tenantId));
    const file = node_path_1.default.join(claimsDir(input.tenantId), `${messageId}.json`);
    if ((0, node_fs_1.existsSync)(file)) {
        const existing = readJson(file, {
            tenantId: input.tenantId,
            messageId,
            conversationId: input.conversationId,
            botId: input.botId,
            handled: true,
            at: new Date().toISOString(),
        });
        return { claimed: false, record: existing };
    }
    const record = {
        tenantId: input.tenantId,
        messageId,
        conversationId: input.conversationId,
        botId: input.botId,
        handled: true,
        at: new Date().toISOString(),
    };
    (0, node_fs_1.writeFileSync)(file, JSON.stringify(record), "utf8");
    return { claimed: true, record };
}
function wasBotMessageClaimed(tenantId, messageId) {
    const id = String(messageId || "").trim();
    if (!id)
        return false;
    return (0, node_fs_1.existsSync)(node_path_1.default.join(claimsDir(tenantId), `${id}.json`));
}
function resetWabaBotStoreForTests(tenantId) {
    const root = tenantId
        ? tenantRoot(tenantId)
        : node_path_1.default.join((0, data_path_1.resolveDataDir)(), "meta-whatsapp", "bots");
    if ((0, node_fs_1.existsSync)(root))
        (0, node_fs_1.rmSync)(root, { recursive: true, force: true });
}
