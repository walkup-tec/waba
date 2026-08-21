"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDeviceCloudAdbMenuConfigured = isDeviceCloudAdbMenuConfigured;
exports.tapWhatsAppOverflowItemByLabel = tapWhatsAppOverflowItemByLabel;
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function trimEnv(value) {
    return String(value ?? "").trim();
}
function isDeviceCloudAdbMenuConfigured() {
    return Boolean(trimEnv(process.env.DEVICE_CLOUD_ADB_SSH_HOST) &&
        trimEnv(process.env.DEVICE_CLOUD_ADB_SSH_USER) &&
        trimEnv(process.env.DEVICE_CLOUD_ADB_SSH_KEY));
}
function resolveKeyPath(raw) {
    const expanded = raw.replace(/^~(?=$|[/\\])/, process.env.USERPROFILE || process.env.HOME || "");
    return path_1.default.resolve(expanded);
}
function sshBaseArgs() {
    const host = trimEnv(process.env.DEVICE_CLOUD_ADB_SSH_HOST);
    const user = trimEnv(process.env.DEVICE_CLOUD_ADB_SSH_USER);
    const keyPath = resolveKeyPath(trimEnv(process.env.DEVICE_CLOUD_ADB_SSH_KEY));
    if (!fs_1.default.existsSync(keyPath))
        throw new Error("Chave SSH Device Cloud ADB não encontrada.");
    return [
        "-i",
        keyPath,
        "-o",
        "BatchMode=yes",
        "-o",
        "StrictHostKeyChecking=accept-new",
        "-o",
        "ConnectTimeout=20",
        `${user}@${host}`,
    ];
}
function runSpawn(command, args, timeoutMs) {
    return new Promise((resolve, reject) => {
        const child = (0, child_process_1.spawn)(command, args, { windowsHide: true });
        let out = "";
        let err = "";
        const timer = setTimeout(() => {
            child.kill("SIGKILL");
            reject(new Error("Timeout ao tocar item do menu via ADB."));
        }, timeoutMs);
        child.stdout.on("data", (chunk) => {
            out += String(chunk);
        });
        child.stderr.on("data", (chunk) => {
            err += String(chunk);
        });
        child.on("error", (e) => {
            clearTimeout(timer);
            reject(e);
        });
        child.on("close", (code) => {
            clearTimeout(timer);
            if (code !== 0) {
                reject(new Error((err || out || `${command} exit ${code}`).trim()));
                return;
            }
            resolve(out);
        });
    });
}
let scriptSynced = false;
async function ensureRemoteTapScript() {
    if (scriptSynced)
        return;
    const local = path_1.default.resolve(__dirname, "../../scripts/device-cloud/tap-menu-label.sh");
    if (!fs_1.default.existsSync(local)) {
        throw new Error(`Script ADB não encontrado: ${local}`);
    }
    const keyPath = resolveKeyPath(trimEnv(process.env.DEVICE_CLOUD_ADB_SSH_KEY));
    const host = trimEnv(process.env.DEVICE_CLOUD_ADB_SSH_HOST);
    const user = trimEnv(process.env.DEVICE_CLOUD_ADB_SSH_USER);
    await runSpawn("scp", [
        "-o",
        "BatchMode=yes",
        "-o",
        "StrictHostKeyChecking=accept-new",
        "-i",
        keyPath,
        local,
        `${user}@${host}:/tmp/tap-menu-label.sh`,
    ], 30000);
    await runSpawn("ssh", [...sshBaseArgs(), "sed -i 's/\\r$//' /tmp/tap-menu-label.sh && chmod +x /tmp/tap-menu-label.sh"], 15000);
    scriptSynced = true;
}
/**
 * Abre o menu ⋮ do WA Business e toca o item pelo texto (uiautomator no host Redroid).
 */
async function tapWhatsAppOverflowItemByLabel(label) {
    const wanted = String(label || "").trim();
    if (!wanted)
        throw new Error("Label do menu inválido.");
    if (!isDeviceCloudAdbMenuConfigured()) {
        throw new Error("DEVICE_CLOUD_ADB_SSH_* não configurado.");
    }
    const serial = trimEnv(process.env.DEVICE_CLOUD_ADB_SERIAL) || "127.0.0.1:5555";
    await ensureRemoteTapScript();
    const stdout = await runSpawn("ssh", [
        ...sshBaseArgs(),
        `export DEVICE_ADB_SERIAL=${JSON.stringify(serial)}; export SKIP_NAV=0; bash /tmp/tap-menu-label.sh ${JSON.stringify(wanted)}`,
    ], 60000);
    const m = stdout.match(/TAPPED\s+(\d+)\s+(\d+)/) || stdout.match(/OK\s+(\d+)\s+(\d+)/);
    if (!m) {
        if (/NOT_FOUND/.test(stdout))
            throw new Error(`Item de menu não encontrado: ${wanted}`);
        throw new Error(`Falha ao resolver coordenadas do menu. out=${stdout.slice(0, 240)}`);
    }
    return { x: Number(m[1]), y: Number(m[2]) };
}
