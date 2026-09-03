"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.templateApprovalKeys = templateApprovalKeys;
exports.lookupTemplateApprovedAt = lookupTemplateApprovedAt;
exports.rememberTemplateApprovedAt = rememberTemplateApprovedAt;
const node_fs_1 = require("node:fs");
const path_1 = __importDefault(require("path"));
const data_path_1 = require("../../data-path");
const meta_whatsapp_template_types_1 = require("./meta-whatsapp-template.types");
const meta_whatsapp_broadcast_store_1 = require("./meta-whatsapp-broadcast.store");
const FILE_NAME = "meta-whatsapp-template-approvals.json";
function emptyStore() {
    return { version: 1, byKey: {} };
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
        if (!parsed || parsed.version !== 1 || !parsed.byKey || typeof parsed.byKey !== "object") {
            return emptyStore();
        }
        return { version: 1, byKey: parsed.byKey };
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
function normalizeIso(value) {
    const raw = String(value || "").trim();
    if (!raw)
        return null;
    const ms = Date.parse(raw);
    if (!Number.isFinite(ms))
        return null;
    return new Date(ms).toISOString();
}
function templateApprovalKeys(input) {
    const tenantId = String(input.tenantId || "").trim();
    const templateId = String(input.templateId || "").trim();
    const metaTemplateId = String(input.metaTemplateId || "").trim();
    const wabaId = String(input.wabaId || "").trim();
    const name = String(input.name || "").trim().toLowerCase();
    const language = String(input.language || "").trim().toLowerCase();
    const keys = [];
    if (tenantId && templateId)
        keys.push(`id:${tenantId}:${templateId}`);
    if (tenantId && metaTemplateId)
        keys.push(`meta:${tenantId}:${metaTemplateId}`);
    if (tenantId && wabaId && name && language)
        keys.push(`name:${tenantId}:${wabaId}:${name}:${language}`);
    if (tenantId && name && language)
        keys.push(`name:${tenantId}:${name}:${language}`);
    return keys;
}
function lookupTemplateApprovedAt(input) {
    const store = readStore();
    for (const key of templateApprovalKeys(input)) {
        const iso = normalizeIso(store.byKey[key]);
        if (iso)
            return iso;
    }
    return null;
}
function rememberTemplateApprovedAt(input, approvedAt) {
    if (!(0, meta_whatsapp_template_types_1.isTemplateApprovedForSend)(input.status))
        return lookupTemplateApprovedAt(input);
    const keys = templateApprovalKeys(input);
    if (!keys.length)
        return null;
    const store = readStore();
    const existing = keys.map((key) => normalizeIso(store.byKey[key])).find(Boolean) || null;
    const iso = existing || normalizeIso(approvedAt) || new Date().toISOString();
    let changed = false;
    for (const key of keys) {
        if (store.byKey[key] === iso)
            continue;
        if (!store.byKey[key]) {
            store.byKey[key] = iso;
            changed = true;
        }
    }
    if (changed)
        writeStore(store);
    (0, meta_whatsapp_broadcast_store_1.stampTemplateApprovedAtOnBroadcasts)({
        tenantId: String(input.tenantId || "").trim(),
        templateId: String(input.templateId || "").trim() || null,
        templateName: String(input.name || "").trim() || null,
        language: String(input.language || "").trim() || null,
        approvedAt: iso,
    });
    return iso;
}
