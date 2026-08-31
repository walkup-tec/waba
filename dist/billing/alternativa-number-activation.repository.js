"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlternativaNumberActivationRepository = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const data_path_1 = require("../data-path");
const FILE = (0, data_path_1.resolveDataFile)("alternativa-number-activations.json");
const normalizeEmail = (email) => String(email ?? "").trim().toLowerCase();
const normalizeName = (name) => String(name ?? "").trim();
const ensureStorage = () => {
    const folder = (0, node_path_1.dirname)(FILE);
    if (!(0, node_fs_1.existsSync)(folder))
        (0, node_fs_1.mkdirSync)(folder, { recursive: true });
    if (!(0, node_fs_1.existsSync)(FILE))
        (0, node_fs_1.writeFileSync)(FILE, JSON.stringify({ byEmail: {} }, null, 2), "utf-8");
};
const loadStore = () => {
    ensureStorage();
    try {
        const parsed = JSON.parse((0, node_fs_1.readFileSync)(FILE, "utf-8"));
        return parsed?.byEmail ? parsed : { byEmail: {} };
    }
    catch {
        return { byEmail: {} };
    }
};
const saveStore = (store) => {
    ensureStorage();
    (0, node_fs_1.writeFileSync)(FILE, JSON.stringify(store, null, 2), "utf-8");
};
const activationStatus = (row) => row.status === "blocked" ? "blocked" : "active";
class AlternativaNumberActivationRepository {
    listForEmail(email) {
        const key = normalizeEmail(email);
        if (!key)
            return [];
        return (loadStore().byEmail[key]?.activations ?? []).map((row) => ({
            ...row,
            status: activationStatus(row),
        }));
    }
    listActiveForEmail(email) {
        return this.listForEmail(email).filter((row) => activationStatus(row) === "active");
    }
    countForEmail(email) {
        return this.listActiveForEmail(email).length;
    }
    hasInstance(email, instanceName) {
        const name = normalizeName(instanceName).toLowerCase();
        if (!name)
            return false;
        return this.listForEmail(email).some((row) => row.instanceName.toLowerCase() === name);
    }
    register(email, instanceName, orderId, options) {
        const key = normalizeEmail(email);
        const name = normalizeName(instanceName);
        const order = String(orderId ?? "").trim();
        if (!key || !name) {
            throw new Error("E-mail e nome da instância são obrigatórios.");
        }
        const store = loadStore();
        const bucket = store.byEmail[key] ?? { activations: [] };
        const existing = bucket.activations.find((row) => row.instanceName.toLowerCase() === name.toLowerCase());
        if (existing) {
            if (options?.replacesInstanceName) {
                existing.replacesInstanceName = normalizeName(options.replacesInstanceName);
                existing.status = "active";
            }
            if (options?.replacementScope) {
                existing.replacementScope = options.replacementScope;
            }
            store.byEmail[key] = bucket;
            saveStore(store);
            return { ...existing, status: activationStatus(existing) };
        }
        const activation = {
            instanceName: name,
            orderId: order || "manual",
            activatedAt: new Date().toISOString(),
            status: "active",
            blockedAt: null,
            replacedByInstanceName: null,
            replacesInstanceName: options?.replacesInstanceName
                ? normalizeName(options.replacesInstanceName)
                : null,
            replacementScope: options?.replacementScope ?? null,
        };
        bucket.activations.push(activation);
        store.byEmail[key] = bucket;
        saveStore(store);
        return activation;
    }
    markBlocked(email, instanceName, replacedByInstanceName) {
        const key = normalizeEmail(email);
        const name = normalizeName(instanceName);
        const replacedBy = normalizeName(replacedByInstanceName);
        if (!key || !name)
            return null;
        const store = loadStore();
        const bucket = store.byEmail[key];
        if (!bucket)
            return null;
        const row = bucket.activations.find((item) => item.instanceName.toLowerCase() === name.toLowerCase());
        if (!row)
            return null;
        row.status = "blocked";
        row.blockedAt = new Date().toISOString();
        row.replacedByInstanceName = replacedBy || null;
        store.byEmail[key] = bucket;
        saveStore(store);
        return { ...row, status: "blocked" };
    }
    listSubscriberEmails() {
        return Object.keys(loadStore().byEmail).filter((email) => email.includes("@"));
    }
    findSubscriberEmailForInstance(instanceName) {
        const target = normalizeName(instanceName).toLowerCase();
        if (!target)
            return null;
        const store = loadStore();
        for (const [email, bucket] of Object.entries(store.byEmail)) {
            if (bucket.activations.some((row) => row.instanceName.toLowerCase() === target && activationStatus(row) === "active")) {
                return email;
            }
        }
        return null;
    }
}
exports.AlternativaNumberActivationRepository = AlternativaNumberActivationRepository;
