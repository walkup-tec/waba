"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeEvoWhatsAppNumber = normalizeEvoWhatsAppNumber;
exports.expandBrazilWhatsAppNumberVariants = expandBrazilWhatsAppNumberVariants;
exports.canonicalizeBrazilWhatsAppNumber = canonicalizeBrazilWhatsAppNumber;
exports.brazilWhatsAppNumbersMatch = brazilWhatsAppNumbersMatch;
exports.extractPhoneFromEvoListItem = extractPhoneFromEvoListItem;
exports.isEvoInstanceOpen = isEvoInstanceOpen;
exports.resolveEvoInstancePhone = resolveEvoInstancePhone;
const promises_1 = __importDefault(require("fs/promises"));
const data_path_1 = require("../data-path");
const evo_http_client_1 = require("../evo-http.client");
const evo_instance_key_1 = require("./evo-instance-key");
const evo_connection_state_service_1 = require("./evo-connection-state.service");
const EVO_API_BASE = String(process.env.EVO_API_URL || "http://walkup-evo-walkup-api:8080").replace(/\/$/, "");
const EVO_API_KEY = String(process.env.EVO_API_KEY || "429683C4C977415CAAFCCE10F7D57E11");
const EVO_INSTANCES_URL = String(process.env.EVO_INSTANCES_URL || "").trim() ||
    `${EVO_API_BASE}/instance/fetchInstances`;
function normalizeEvoWhatsAppNumber(num) {
    const digits = String(num || "").replace(/\D/g, "");
    if (!digits)
        return "";
    let national = digits;
    while (national.startsWith("55") && national.length > 11) {
        national = national.slice(2);
    }
    if (national.length >= 10 && national.length <= 11 && /^[1-9]\d/.test(national)) {
        return `55${national}`;
    }
    if (digits.length >= 12 && digits.startsWith("55"))
        return digits;
    return digits;
}
/**
 * Variantes BR com/sem o 9º dígito móvel (ex.: 5182001261 ↔ 51982001261)
 * e com/sem DDI 55. Usar em match/lookup — nunca assumir um único formato.
 */
function expandBrazilWhatsAppNumberVariants(raw) {
    const digits = String(raw || "").replace(/\D/g, "");
    if (!digits)
        return [];
    const variants = new Set();
    const add = (value) => {
        const d = String(value || "").replace(/\D/g, "");
        if (!d)
            return;
        variants.add(d);
        if (d.startsWith("55") && d.length > 2)
            variants.add(d.slice(2));
        else if (!d.startsWith("55") && d.length >= 10 && d.length <= 11)
            variants.add(`55${d}`);
    };
    add(digits);
    let national = digits;
    while (national.startsWith("55") && national.length > 11) {
        national = national.slice(2);
    }
    add(national);
    if (national.length === 11 && national.charAt(2) === "9") {
        const withoutNine = `${national.slice(0, 2)}${national.slice(3)}`;
        add(withoutNine);
    }
    else if (national.length === 10 && /^[1-9]\d/.test(national)) {
        const withNine = `${national.slice(0, 2)}9${national.slice(2)}`;
        add(withNine);
    }
    return [...variants];
}
/** Chave estável para dedupe: 55 + DDD + 8 dígitos (sem o 9 móvel, quando aplicável). */
function canonicalizeBrazilWhatsAppNumber(raw) {
    const variants = expandBrazilWhatsAppNumberVariants(raw);
    const tenNational = variants.find((v) => !v.startsWith("55") && v.length === 10);
    if (tenNational)
        return `55${tenNational}`;
    const twelve = variants.find((v) => v.startsWith("55") && v.length === 12);
    if (twelve)
        return twelve;
    const elevenNational = variants.find((v) => !v.startsWith("55") && v.length === 11 && v.charAt(2) === "9");
    if (elevenNational) {
        return `55${elevenNational.slice(0, 2)}${elevenNational.slice(3)}`;
    }
    return normalizeEvoWhatsAppNumber(raw);
}
function brazilWhatsAppNumbersMatch(a, b) {
    const left = expandBrazilWhatsAppNumberVariants(a);
    if (!left.length)
        return false;
    const right = new Set(expandBrazilWhatsAppNumberVariants(b));
    return left.some((item) => right.has(item));
}
function pickPhoneFromRecord(rec) {
    const raw = rec?.ownerJid ??
        rec?.owner ??
        rec?.wid ??
        rec?.wuid ??
        rec?.number ??
        rec?.phone ??
        rec?.ownerNumber ??
        rec?.remoteJid ??
        rec?.jid ??
        rec?.me?.id ??
        rec?.profile?.owner ??
        rec?.profile?.number ??
        "";
    const s = String(raw || "").trim();
    if (!s)
        return "";
    const base = s.includes("@") ? s.split("@")[0] || s : s;
    return normalizeEvoWhatsAppNumber(base);
}
function deepFindWhatsappDigits(node, depth = 0) {
    if (depth > 10 || node == null)
        return "";
    if (typeof node === "string") {
        const s = node.trim();
        if (!s.includes("@"))
            return "";
        const base = s.split("@")[0] || "";
        const digits = normalizeEvoWhatsAppNumber(base);
        return digits.length >= 10 ? digits : "";
    }
    if (typeof node !== "object")
        return "";
    const obj = node;
    for (const key of ["ownerJid", "owner", "wid", "wuid", "jid", "remoteJid", "id", "number", "phone"]) {
        const v = obj[key];
        if (typeof v === "string" && v.trim()) {
            const digits = pickPhoneFromRecord({ [key]: v });
            if (digits)
                return digits;
        }
    }
    for (const value of Object.values(obj)) {
        const found = deepFindWhatsappDigits(value, depth + 1);
        if (found)
            return found;
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
    }
    return raw ? [raw] : [];
}
/** Lê telefone no item da listagem EVO (wrapper + objeto `instance`). */
function extractPhoneFromEvoListItem(item) {
    if (!item || typeof item !== "object")
        return null;
    const wrapper = item;
    const nested = wrapper.instance && typeof wrapper.instance === "object"
        ? wrapper.instance
        : wrapper;
    const instanceName = (0, evo_instance_key_1.resolveEvoInstanceKey)(nested) || (0, evo_instance_key_1.resolveEvoInstanceKey)(wrapper);
    if (!instanceName)
        return null;
    const status = String(nested?.connectionStatus ??
        nested?.status ??
        wrapper?.connectionStatus ??
        wrapper?.status ??
        "").toLowerCase();
    const phone = pickPhoneFromRecord(nested) ||
        pickPhoneFromRecord(wrapper) ||
        deepFindWhatsappDigits(wrapper);
    return {
        instanceName,
        phone,
        open: status.includes("open"),
    };
}
async function readPhoneFromEvoCache(instanceName) {
    const needle = instanceName.trim().toLowerCase();
    if (!needle)
        return "";
    try {
        const file = (0, data_path_1.resolveDataFile)("evo-instances-cache.json");
        const raw = await promises_1.default.readFile(file, "utf-8");
        const parsed = JSON.parse(raw);
        const row = (parsed?.items || []).find((item) => String(item?.name || "").trim().toLowerCase() === needle);
        if (!row)
            return "";
        return normalizeEvoWhatsAppNumber(String(row?.number || row?.phone || "").trim());
    }
    catch {
        return "";
    }
}
async function fetchPhoneFromConnectionState(instanceName) {
    const enc = encodeURIComponent(instanceName);
    const urls = [
        `${EVO_API_BASE}/instance/connectionState/${enc}`,
        `${EVO_API_BASE}/instance/connection-state/${enc}`,
    ];
    for (const url of urls) {
        const result = await (0, evo_http_client_1.evoHttpRequest)(url, "GET", {
            apiKey: EVO_API_KEY,
            timeoutMs: 10000,
            retries: 1,
        });
        if (!result.ok || result.json == null)
            continue;
        const root = result.json;
        const inst = root.instance ?? root;
        const phone = pickPhoneFromRecord(inst) || pickPhoneFromRecord(root) || deepFindWhatsappDigits(root);
        if (phone)
            return phone;
    }
    return "";
}
async function fetchPhoneFromProfile(instanceName) {
    const enc = encodeURIComponent(instanceName);
    const urls = [
        `${EVO_API_BASE}/profile/fetchProfile/${enc}`,
        `${EVO_API_BASE}/instance/fetchProfile/${enc}`,
        `${EVO_API_BASE}/chat/fetchProfile/${enc}`,
    ];
    for (const url of urls) {
        const result = await (0, evo_http_client_1.evoHttpRequest)(url, "GET", {
            apiKey: EVO_API_KEY,
            timeoutMs: 12000,
            retries: 1,
        });
        if (!result.ok || result.json == null)
            continue;
        const phone = deepFindWhatsappDigits(result.json);
        if (phone)
            return phone;
    }
    return "";
}
async function fetchPhoneFromInstancesList(instanceName) {
    const needle = instanceName.trim().toLowerCase();
    if (!needle)
        return "";
    const result = await (0, evo_http_client_1.evoHttpRequest)(EVO_INSTANCES_URL, "GET", {
        apiKey: EVO_API_KEY,
        timeoutMs: 12000,
        retries: 1,
    });
    if (!result.ok)
        return "";
    for (const item of parseEvoInstancesList(result.json)) {
        const row = extractPhoneFromEvoListItem(item);
        if (row && row.instanceName.toLowerCase() === needle && row.phone) {
            return row.phone;
        }
    }
    return "";
}
async function isEvoInstanceOpen(instanceName) {
    const needle = instanceName.trim().toLowerCase();
    if (!needle)
        return false;
    const liveState = await (0, evo_connection_state_service_1.fetchEvoInstanceLiveState)(instanceName, { fresh: true });
    if (liveState) {
        return (0, evo_connection_state_service_1.isEvoLiveStateOpen)(liveState);
    }
    const listResult = await (0, evo_http_client_1.evoHttpRequest)(EVO_INSTANCES_URL, "GET", {
        apiKey: EVO_API_KEY,
        timeoutMs: 12000,
        retries: 1,
    });
    if (listResult.ok) {
        for (const item of parseEvoInstancesList(listResult.json)) {
            const row = extractPhoneFromEvoListItem(item);
            if (row && row.instanceName.toLowerCase() === needle) {
                return row.open;
            }
        }
    }
    return false;
}
async function resolveEvoInstancePhone(instanceName, options) {
    const name = String(instanceName || "").trim();
    if (!name)
        return "";
    const hint = normalizeEvoWhatsAppNumber(String(options?.hint || "").trim());
    const fromList = await fetchPhoneFromInstancesList(name);
    if (fromList)
        return fromList;
    const fromState = await fetchPhoneFromConnectionState(name);
    if (fromState)
        return fromState;
    const fromProfile = await fetchPhoneFromProfile(name);
    if (fromProfile)
        return fromProfile;
    const fromCache = await readPhoneFromEvoCache(name);
    if (fromCache)
        return fromCache;
    if (hint)
        return hint;
    const tail = name.match(/(\d{10,13})$/);
    if (tail?.[1]) {
        const derived = normalizeEvoWhatsAppNumber(tail[1]);
        if (derived.length >= 12)
            return derived;
    }
    return "";
}
