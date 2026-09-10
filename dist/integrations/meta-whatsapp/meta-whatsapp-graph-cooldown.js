"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GRAPH_UPLOAD_COOLDOWN_MS = void 0;
exports.remainingMetaGraphUploadCooldownMs = remainingMetaGraphUploadCooldownMs;
exports.isMetaGraphUploadCooldown = isMetaGraphUploadCooldown;
exports.markMetaGraphUploadCooldown = markMetaGraphUploadCooldown;
exports.metaGraphUploadCooldownMessage = metaGraphUploadCooldownMessage;
exports.clearMetaGraphUploadCooldownForTests = clearMetaGraphUploadCooldownForTests;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const data_path_1 = require("../../data-path");
exports.GRAPH_UPLOAD_COOLDOWN_MS = 30 * 60 * 1000;
let memoryUntil = 0;
function cooldownPath() {
    return node_path_1.default.join((0, data_path_1.resolveDataDir)(), "meta-whatsapp", "graph-upload-cooldown.json");
}
function persistEnabled() {
    return !process.env.NODE_TEST_CONTEXT;
}
function readDiskUntil() {
    if (!persistEnabled())
        return 0;
    const file = cooldownPath();
    if (!(0, node_fs_1.existsSync)(file))
        return 0;
    try {
        const row = JSON.parse((0, node_fs_1.readFileSync)(file, "utf8"));
        return Number(row.until || 0) || 0;
    }
    catch {
        return 0;
    }
}
function writeDiskUntil(until) {
    if (!persistEnabled())
        return;
    (0, node_fs_1.mkdirSync)(node_path_1.default.dirname(cooldownPath()), { recursive: true });
    (0, node_fs_1.writeFileSync)(cooldownPath(), JSON.stringify({ until }));
}
function remainingMetaGraphUploadCooldownMs(now = Date.now()) {
    const until = Math.max(memoryUntil, readDiskUntil());
    memoryUntil = until;
    return Math.max(0, until - now);
}
function isMetaGraphUploadCooldown(now = Date.now()) {
    return remainingMetaGraphUploadCooldownMs(now) > 0;
}
function markMetaGraphUploadCooldown(now = Date.now()) {
    memoryUntil = now + exports.GRAPH_UPLOAD_COOLDOWN_MS;
    writeDiskUntil(memoryUntil);
}
function metaGraphUploadCooldownMessage(now = Date.now()) {
    const minutes = Math.max(1, Math.ceil(remainingMetaGraphUploadCooldownMs(now) / 60000));
    return ("A Meta ainda bloqueia o upload deste aplicativo (código 4). " +
        `Não tente de novo agora — a cota só volta se ninguém abrir Conexão nem clicar em Atualizar da Meta. Aguarde cerca de ${minutes} min.`);
}
function clearMetaGraphUploadCooldownForTests() {
    memoryUntil = 0;
}
