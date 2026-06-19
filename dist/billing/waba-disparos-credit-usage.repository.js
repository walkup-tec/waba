"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaDisparosCreditUsageRepository = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const data_path_1 = require("../data-path");
const FILE_NAME = "waba-disparos-credit-usage.json";
const normalizeEmail = (value) => value.trim().toLowerCase();
const emptyStore = () => ({ version: 2, entries: [] });
const resolveFilePath = () => (0, data_path_1.resolveDataFile)(FILE_NAME);
const ensureStorage = () => {
    const filePath = resolveFilePath();
    const folder = (0, node_path_1.dirname)(filePath);
    if (!(0, node_fs_1.existsSync)(folder))
        (0, node_fs_1.mkdirSync)(folder, { recursive: true });
    if (!(0, node_fs_1.existsSync)(filePath)) {
        (0, node_fs_1.writeFileSync)(filePath, JSON.stringify(emptyStore(), null, 2), "utf-8");
    }
};
const readStore = () => {
    ensureStorage();
    try {
        const parsed = JSON.parse((0, node_fs_1.readFileSync)(resolveFilePath(), "utf-8"));
        if (parsed?.version === 2 && Array.isArray(parsed.entries)) {
            return { version: 2, entries: parsed.entries };
        }
        if (parsed?.version === 1 && Array.isArray(parsed.entries)) {
            const migrated = {
                version: 2,
                entries: parsed.entries.map((item) => ({
                    email: normalizeEmail(item.email),
                    consumedOficial: Math.max(0, Math.round(Number(item.consumedShipments ?? 0))),
                    consumedAlternativa: 0,
                    updatedAt: String(item.updatedAt ?? new Date().toISOString()),
                })),
            };
            writeStore(migrated);
            return migrated;
        }
        return emptyStore();
    }
    catch {
        return emptyStore();
    }
};
const writeStore = (store) => {
    ensureStorage();
    (0, node_fs_1.writeFileSync)(resolveFilePath(), JSON.stringify(store, null, 2), "utf-8");
};
class WabaDisparosCreditUsageRepository {
    getConsumedShipments(email, apiKind) {
        const normalized = normalizeEmail(email);
        if (!normalized)
            return 0;
        const entry = readStore().entries.find((item) => item.email === normalized);
        if (!entry)
            return 0;
        if (apiKind === "alternativa") {
            return Math.max(0, Math.round(Number(entry.consumedAlternativa ?? 0)));
        }
        if (apiKind === "oficial") {
            return Math.max(0, Math.round(Number(entry.consumedOficial ?? 0)));
        }
        return (Math.max(0, Math.round(Number(entry.consumedOficial ?? 0))) +
            Math.max(0, Math.round(Number(entry.consumedAlternativa ?? 0))));
    }
    setConsumedByApi(email, consumedByApi) {
        const normalized = normalizeEmail(email);
        if (!normalized)
            return;
        const store = readStore();
        const now = new Date().toISOString();
        const index = store.entries.findIndex((item) => item.email === normalized);
        const next = {
            email: normalized,
            consumedOficial: Math.max(0, Math.round(consumedByApi.oficial)),
            consumedAlternativa: Math.max(0, Math.round(consumedByApi.alternativa)),
            updatedAt: now,
        };
        if (index >= 0) {
            store.entries[index] = next;
        }
        else {
            store.entries.push(next);
        }
        writeStore(store);
    }
    incrementConsumedShipments(email, delta = 1, apiKind = "oficial") {
        const normalized = normalizeEmail(email);
        if (!normalized || !Number.isFinite(delta) || delta <= 0) {
            return this.getConsumedShipments(normalized, apiKind);
        }
        const store = readStore();
        const now = new Date().toISOString();
        const index = store.entries.findIndex((item) => item.email === normalized);
        const roundedDelta = Math.round(delta);
        if (index === -1) {
            store.entries.push({
                email: normalized,
                consumedOficial: apiKind === "oficial" ? roundedDelta : 0,
                consumedAlternativa: apiKind === "alternativa" ? roundedDelta : 0,
                updatedAt: now,
            });
        }
        else {
            const current = store.entries[index];
            store.entries[index] = {
                ...current,
                consumedOficial: apiKind === "oficial"
                    ? Math.max(0, Math.round(Number(current.consumedOficial ?? 0))) + roundedDelta
                    : Math.max(0, Math.round(Number(current.consumedOficial ?? 0))),
                consumedAlternativa: apiKind === "alternativa"
                    ? Math.max(0, Math.round(Number(current.consumedAlternativa ?? 0))) + roundedDelta
                    : Math.max(0, Math.round(Number(current.consumedAlternativa ?? 0))),
                updatedAt: now,
            };
        }
        writeStore(store);
        return this.getConsumedShipments(normalized, apiKind);
    }
}
exports.WabaDisparosCreditUsageRepository = WabaDisparosCreditUsageRepository;
