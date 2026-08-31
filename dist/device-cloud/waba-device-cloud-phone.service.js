"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveDeviceCloudRegisteredPhone = saveDeviceCloudRegisteredPhone;
exports.resolveDeviceCloudRegisteredPhone = resolveDeviceCloudRegisteredPhone;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const data_path_1 = require("../data-path");
const evo_instance_phone_service_1 = require("../instances/evo-instance-phone.service");
const PHONES_FILE = (0, data_path_1.resolveDataFile)("device-cloud-phones.json");
const ALIASES_FILE = (0, data_path_1.resolveDataFile)("instance-aliases.json");
const EVO_CACHE_FILE = (0, data_path_1.resolveDataFile)("evo-instances-cache.json");
function normalizeLabelKey(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9_-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");
}
function normalizeDigits(raw) {
    return (0, evo_instance_phone_service_1.normalizeEvoWhatsAppNumber)(String(raw || "").replace(/\D/g, ""));
}
async function readPhoneStore() {
    try {
        const raw = await promises_1.default.readFile(PHONES_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    }
    catch {
        return {};
    }
}
async function writePhoneStore(store) {
    await promises_1.default.mkdir(path_1.default.dirname(PHONES_FILE), { recursive: true });
    await promises_1.default.writeFile(PHONES_FILE, JSON.stringify(store, null, 2), "utf-8");
}
async function readAliasesMap() {
    try {
        const raw = await promises_1.default.readFile(ALIASES_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        const map = new Map();
        if (parsed && typeof parsed === "object") {
            Object.entries(parsed).forEach(([key, value]) => {
                const k = String(key || "").trim();
                const v = String(value || "").trim();
                if (k && v)
                    map.set(k, v);
            });
        }
        return map;
    }
    catch {
        return new Map();
    }
}
function pickPhoneFromCacheRow(row) {
    const raw = row?.number ??
        row?.phone ??
        row?.ownerNumber ??
        row?.owner ??
        row?.ownerJid ??
        "";
    const base = String(raw || "").trim().split("@")[0];
    return normalizeDigits(base);
}
async function readEvoCacheItems() {
    try {
        const raw = await promises_1.default.readFile(EVO_CACHE_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed?.items) ? parsed.items : [];
    }
    catch {
        return [];
    }
}
function instanceNamesForLabel(label, instanceName, aliases) {
    const names = new Set();
    const labelKey = normalizeLabelKey(label);
    const instKey = normalizeLabelKey(instanceName);
    if (instKey)
        names.add(instKey);
    if (labelKey)
        names.add(labelKey);
    aliases.forEach((alias, inst) => {
        const aliasKey = normalizeLabelKey(alias);
        const instNorm = normalizeLabelKey(inst);
        if (labelKey && (aliasKey === labelKey || instNorm === labelKey)) {
            if (instNorm)
                names.add(instNorm);
            names.add(String(inst || "").trim().toLowerCase());
        }
    });
    return [...names].filter(Boolean);
}
async function phoneFromEvoCacheCandidates(candidates, label) {
    const items = await readEvoCacheItems();
    const needles = new Set(candidates.map((name) => name.trim().toLowerCase()).filter(Boolean));
    const labelDigits = String(label || "").replace(/\D/g, "");
    for (const row of items) {
        const name = String(row?.name || row?.instanceName || "")
            .trim()
            .toLowerCase();
        if (name && needles.has(name)) {
            const phone = pickPhoneFromCacheRow(row);
            if (phone)
                return phone;
        }
    }
    if (labelDigits.length >= 4) {
        const suffixMatches = [];
        for (const row of items) {
            const phone = pickPhoneFromCacheRow(row);
            if (phone && phone.endsWith(labelDigits))
                suffixMatches.push(phone);
        }
        const unique = [...new Set(suffixMatches)];
        if (unique.length === 1)
            return unique[0];
    }
    return "";
}
async function saveDeviceCloudRegisteredPhone(input) {
    const deviceId = String(input.deviceId || "").trim();
    const phone = normalizeDigits(input.phone);
    if (!deviceId || !phone)
        return "";
    const labelKey = normalizeLabelKey(input.label || "");
    const instanceKey = normalizeLabelKey(input.instanceName || input.label || "");
    const store = await readPhoneStore();
    store.byDeviceId = store.byDeviceId && typeof store.byDeviceId === "object" ? store.byDeviceId : {};
    store.byLabel = store.byLabel && typeof store.byLabel === "object" ? store.byLabel : {};
    store.byInstanceName =
        store.byInstanceName && typeof store.byInstanceName === "object" ? store.byInstanceName : {};
    store.byDeviceId[deviceId] = phone;
    if (labelKey)
        store.byLabel[labelKey] = phone;
    if (instanceKey)
        store.byInstanceName[instanceKey] = phone;
    await writePhoneStore(store);
    return phone;
}
async function resolveDeviceCloudRegisteredPhone(input) {
    const deviceId = String(input.deviceId || "").trim();
    const label = String(input.label || "").trim();
    const instanceName = String(input.instanceName || "").trim();
    const labelKey = normalizeLabelKey(label);
    const instanceKey = normalizeLabelKey(instanceName || label);
    const store = await readPhoneStore();
    const fromDevice = normalizeDigits(store.byDeviceId?.[deviceId] || "");
    if (fromDevice)
        return { phone: fromDevice, source: "device-cloud-phones.byDeviceId" };
    const fromLabel = normalizeDigits(store.byLabel?.[labelKey] || "");
    if (fromLabel)
        return { phone: fromLabel, source: "device-cloud-phones.byLabel" };
    const fromInstance = normalizeDigits(store.byInstanceName?.[instanceKey] || "");
    if (fromInstance)
        return { phone: fromInstance, source: "device-cloud-phones.byInstanceName" };
    const aliases = await readAliasesMap();
    const candidates = instanceNamesForLabel(label, instanceName, aliases);
    const fromCache = await phoneFromEvoCacheCandidates(candidates, label);
    if (fromCache)
        return { phone: fromCache, source: "evo-instances-cache" };
    for (const candidate of candidates) {
        const resolved = normalizeDigits(await (0, evo_instance_phone_service_1.resolveEvoInstancePhone)(candidate));
        if (resolved)
            return { phone: resolved, source: "resolveEvoInstancePhone" };
    }
    return { phone: "", source: "" };
}
