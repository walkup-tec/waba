"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaPushRepository = void 0;
exports.normalizePushTitleKey = normalizePushTitleKey;
exports.isRetiredSystemPush = isRetiredSystemPush;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const data_path_1 = require("../data-path");
const waba_push_types_1 = require("./waba-push.types");
const MESSAGES_FILE = "waba-push-messages.json";
const CONFIG_FILE = "waba-push-config.json";
const DEFAULT_CONFIG = {
    communityInviteLink: "https://chat.whatsapp.com/EoP6r6BIZt83GenpCgvUJ7",
    communityAnnouncementGroupJid: "",
    communityEvoInstance: (0, waba_push_types_1.resolveDefaultPushCommunityEvoInstance)(),
    updatedAt: new Date().toISOString(),
};
const emptyStore = () => ({ version: 1, messages: [] });
function normalizePushTitleKey(title) {
    return String(title || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}
const RETIRED_SYSTEM_PUSH_TITLES = new Set(["relatorios de campanha", "plataforma meta"]);
/** Comunicados antigos que não devem mais aparecer no sininho nem no histórico. */
function isRetiredSystemPush(message) {
    const titleKey = normalizePushTitleKey(message.title || "");
    if (RETIRED_SYSTEM_PUSH_TITLES.has(titleKey))
        return true;
    const body = `${message.reviewedText || ""} ${message.originalText || ""}`;
    if (/relat[oó]rio de sua campanha foi atualizado/i.test(body))
        return true;
    if (/31 de julho[\s\S]{0,400}plataforma meta/i.test(body))
        return true;
    return false;
}
class WabaPushRepository {
    readMessages() {
        const filePath = (0, data_path_1.resolveDataFile)(MESSAGES_FILE);
        const dir = node_path_1.default.dirname(filePath);
        if (!(0, node_fs_1.existsSync)(dir))
            (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        if (!(0, node_fs_1.existsSync)(filePath))
            return emptyStore();
        try {
            const parsed = JSON.parse((0, node_fs_1.readFileSync)(filePath, "utf8"));
            if (parsed?.version !== 1 || !Array.isArray(parsed.messages))
                return emptyStore();
            const messages = parsed.messages.filter((row) => !isRetiredSystemPush(row));
            if (messages.length !== parsed.messages.length) {
                const next = { version: 1, messages };
                try {
                    this.writeMessages(next);
                }
                catch {
                    /* filtro em memória se o disco falhar */
                }
                return next;
            }
            return parsed;
        }
        catch {
            return emptyStore();
        }
    }
    writeMessages(store) {
        const filePath = (0, data_path_1.resolveDataFile)(MESSAGES_FILE);
        const dir = node_path_1.default.dirname(filePath);
        if (!(0, node_fs_1.existsSync)(dir))
            (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        const tmp = `${filePath}.tmp`;
        (0, node_fs_1.writeFileSync)(tmp, JSON.stringify(store, null, 2), "utf8");
        (0, node_fs_1.writeFileSync)(filePath, (0, node_fs_1.readFileSync)(tmp));
    }
    listMessages(limit = 50) {
        return this.readMessages()
            .messages.map((row) => ({
            ...row,
            image: row.image?.id ? row.image : null,
        }))
            .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
            .slice(0, Math.max(1, limit));
    }
    getById(id) {
        const normalized = String(id || "").trim();
        if (!normalized)
            return null;
        return this.readMessages().messages.find((row) => row.id === normalized) ?? null;
    }
    save(message) {
        const store = this.readMessages();
        const idx = store.messages.findIndex((row) => row.id === message.id);
        if (idx >= 0)
            store.messages[idx] = message;
        else
            store.messages.push(message);
        this.writeMessages(store);
        return message;
    }
    createId() {
        return node_crypto_1.default.randomUUID();
    }
    readConfig() {
        const filePath = (0, data_path_1.resolveDataFile)(CONFIG_FILE);
        const dir = node_path_1.default.dirname(filePath);
        if (!(0, node_fs_1.existsSync)(dir))
            (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        if (!(0, node_fs_1.existsSync)(filePath)) {
            this.writeConfig(DEFAULT_CONFIG);
            return { ...DEFAULT_CONFIG };
        }
        try {
            const parsed = JSON.parse((0, node_fs_1.readFileSync)(filePath, "utf8"));
            const config = {
                communityInviteLink: String(parsed.communityInviteLink || DEFAULT_CONFIG.communityInviteLink).trim(),
                communityAnnouncementGroupJid: String(parsed.communityAnnouncementGroupJid || "").trim(),
                communityEvoInstance: String(parsed.communityEvoInstance || DEFAULT_CONFIG.communityEvoInstance).trim(),
                updatedAt: String(parsed.updatedAt || new Date().toISOString()),
            };
            const targetInstance = (0, waba_push_types_1.resolveDefaultPushCommunityEvoInstance)();
            if (waba_push_types_1.LEGACY_WRONG_PUSH_COMMUNITY_INSTANCES.has(config.communityEvoInstance.toLowerCase())) {
                return this.writeConfig({
                    ...config,
                    communityEvoInstance: targetInstance,
                    communityAnnouncementGroupJid: "",
                });
            }
            return config;
        }
        catch {
            return { ...DEFAULT_CONFIG };
        }
    }
    writeConfig(config) {
        const filePath = (0, data_path_1.resolveDataFile)(CONFIG_FILE);
        const dir = node_path_1.default.dirname(filePath);
        if (!(0, node_fs_1.existsSync)(dir))
            (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        const payload = {
            ...config,
            updatedAt: new Date().toISOString(),
        };
        const tmp = `${filePath}.tmp`;
        (0, node_fs_1.writeFileSync)(tmp, JSON.stringify(payload, null, 2), "utf8");
        (0, node_fs_1.writeFileSync)(filePath, (0, node_fs_1.readFileSync)(tmp));
        return payload;
    }
    dismissForUser(pushId, email) {
        const normalizedId = String(pushId || "").trim();
        const normalizedEmail = String(email || "").trim().toLowerCase();
        if (!normalizedId || !normalizedEmail.includes("@"))
            return false;
        const store = this.readMessages();
        const row = store.messages.find((item) => item.id === normalizedId);
        if (!row)
            return false;
        const dismissed = new Set((row.dismissedBy || []).map((value) => String(value || "").trim().toLowerCase()));
        if (dismissed.has(normalizedEmail))
            return true;
        dismissed.add(normalizedEmail);
        row.dismissedBy = Array.from(dismissed);
        this.writeMessages(store);
        return true;
    }
}
exports.WabaPushRepository = WabaPushRepository;
