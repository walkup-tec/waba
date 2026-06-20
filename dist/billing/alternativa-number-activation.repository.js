"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlternativaNumberActivationRepository = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const data_path_1 = require("../data-path");
const FILE = (0, data_path_1.resolveDataFile)("alternativa-number-activations.json");
const normalizeEmail = (email) => String(email ?? "").trim().toLowerCase();
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
class AlternativaNumberActivationRepository {
    listForEmail(email) {
        const key = normalizeEmail(email);
        if (!key)
            return [];
        return loadStore().byEmail[key]?.activations ?? [];
    }
    countForEmail(email) {
        return this.listForEmail(email).length;
    }
    hasInstance(email, instanceName) {
        const name = String(instanceName ?? "").trim().toLowerCase();
        if (!name)
            return false;
        return this.listForEmail(email).some((row) => row.instanceName.toLowerCase() === name);
    }
    register(email, instanceName, orderId) {
        const key = normalizeEmail(email);
        const name = String(instanceName ?? "").trim();
        const order = String(orderId ?? "").trim();
        if (!key || !name) {
            throw new Error("E-mail e nome da instância são obrigatórios.");
        }
        const store = loadStore();
        const bucket = store.byEmail[key] ?? { activations: [] };
        if (bucket.activations.some((row) => row.instanceName.toLowerCase() === name.toLowerCase())) {
            return bucket.activations.find((row) => row.instanceName.toLowerCase() === name.toLowerCase());
        }
        const activation = {
            instanceName: name,
            orderId: order || "manual",
            activatedAt: new Date().toISOString(),
        };
        bucket.activations.push(activation);
        store.byEmail[key] = bucket;
        saveStore(store);
        return activation;
    }
    findSubscriberEmailForInstance(instanceName) {
        const target = String(instanceName ?? "").trim().toLowerCase();
        if (!target)
            return null;
        const store = loadStore();
        for (const [email, bucket] of Object.entries(store.byEmail)) {
            if (bucket.activations.some((row) => row.instanceName.toLowerCase() === target)) {
                return email;
            }
        }
        return null;
    }
}
exports.AlternativaNumberActivationRepository = AlternativaNumberActivationRepository;
