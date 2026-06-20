"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wabaInstanceOwnershipService = exports.WabaInstanceOwnershipService = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const waba_auth_service_1 = require("../auth/waba-auth.service");
const data_path_1 = require("../data-path");
const OWNERS_FILE = (0, data_path_1.resolveDataFile)("instance-owners.json");
const normalizeEmail = (value) => value.trim().toLowerCase();
const normalizeInstanceName = (value) => String(value || "").trim();
class WabaInstanceOwnershipService {
    constructor() {
        this.cache = null;
        this.writeChain = Promise.resolve();
    }
    runLocked(fn) {
        const next = this.writeChain.then(fn, fn);
        this.writeChain = next.then(() => undefined, () => undefined);
        return next;
    }
    async loadStore() {
        if (this.cache)
            return this.cache;
        try {
            const raw = await fs_1.promises.readFile(OWNERS_FILE, "utf-8");
            const parsed = JSON.parse(raw || "{}");
            const instances = parsed?.instances && typeof parsed.instances === "object" ? parsed.instances : {};
            this.cache = { instances };
            return this.cache;
        }
        catch {
            this.cache = { instances: {} };
            return this.cache;
        }
    }
    async saveStore(store) {
        this.cache = store;
        await fs_1.promises.mkdir(path_1.default.dirname(OWNERS_FILE), { recursive: true });
        await fs_1.promises.writeFile(OWNERS_FILE, JSON.stringify(store, null, 2), "utf-8");
    }
    findStoreKey(store, instanceName) {
        const target = normalizeInstanceName(instanceName).toLowerCase();
        if (!target)
            return null;
        for (const key of Object.keys(store.instances)) {
            if (key.toLowerCase() === target)
                return key;
        }
        return null;
    }
    /** Sem login configurado (dev local): não filtra. Com auth: estrito por dono. */
    bypassOwnershipFilter(auth) {
        return !(0, waba_auth_service_1.isWabaAuthConfigured)();
    }
    async getOwnerEmail(instanceName) {
        const store = await this.loadStore();
        const key = this.findStoreKey(store, instanceName);
        if (!key)
            return null;
        const owner = normalizeEmail(store.instances[key]?.ownerEmail || "");
        return owner.includes("@") ? owner : null;
    }
    async assignOwner(instanceName, ownerEmail) {
        const name = normalizeInstanceName(instanceName);
        const email = normalizeEmail(ownerEmail);
        if (!name || !email.includes("@"))
            return;
        await this.runLocked(async () => {
            const store = await this.loadStore();
            const existingKey = this.findStoreKey(store, name);
            if (existingKey) {
                store.instances[existingKey] = {
                    ownerEmail: email,
                    createdAt: store.instances[existingKey]?.createdAt || new Date().toISOString(),
                };
            }
            else {
                store.instances[name] = {
                    ownerEmail: email,
                    createdAt: new Date().toISOString(),
                };
            }
            await this.saveStore(store);
        });
    }
    /**
     * Vincula instância ao usuário na integração. Falha se já pertence a outro.
     */
    async claimOnRegister(instanceName, ownerEmail) {
        const name = normalizeInstanceName(instanceName);
        const email = normalizeEmail(ownerEmail);
        if (!name)
            return { ok: false, error: "Nome da instância inválido." };
        if (!email.includes("@"))
            return { ok: false, error: "Sessão inválida para registrar instância." };
        return this.runLocked(async () => {
            const store = await this.loadStore();
            const existingKey = this.findStoreKey(store, name);
            if (existingKey) {
                const currentOwner = normalizeEmail(store.instances[existingKey]?.ownerEmail || "");
                if (currentOwner && currentOwner !== email) {
                    return {
                        ok: false,
                        error: "Esta instância já está vinculada a outro usuário.",
                    };
                }
                store.instances[existingKey] = {
                    ownerEmail: email,
                    createdAt: store.instances[existingKey]?.createdAt || new Date().toISOString(),
                };
            }
            else {
                store.instances[name] = {
                    ownerEmail: email,
                    createdAt: new Date().toISOString(),
                };
            }
            await this.saveStore(store);
            return { ok: true };
        });
    }
    async renameInstance(oldName, newName) {
        const from = normalizeInstanceName(oldName);
        const to = normalizeInstanceName(newName);
        if (!from || !to || from.toLowerCase() === to.toLowerCase())
            return;
        await this.runLocked(async () => {
            const store = await this.loadStore();
            const key = this.findStoreKey(store, from);
            if (!key)
                return;
            const record = store.instances[key];
            delete store.instances[key];
            const destKey = this.findStoreKey(store, to);
            if (destKey) {
                store.instances[destKey] = record;
            }
            else {
                store.instances[to] = record;
            }
            await this.saveStore(store);
        });
    }
    async removeOwner(instanceName) {
        const name = normalizeInstanceName(instanceName);
        if (!name)
            return;
        await this.runLocked(async () => {
            const store = await this.loadStore();
            const key = this.findStoreKey(store, name);
            if (!key)
                return;
            delete store.instances[key];
            await this.saveStore(store);
        });
    }
    async canAccessInstance(auth, instanceName) {
        if (this.bypassOwnershipFilter(auth))
            return true;
        const email = normalizeEmail(auth.email);
        if (!email.includes("@"))
            return false;
        const owner = await this.getOwnerEmail(instanceName);
        if (!owner)
            return false;
        return owner === email;
    }
    async filterItemsForAuth(auth, items, readName) {
        if (this.bypassOwnershipFilter(auth))
            return items;
        const email = normalizeEmail(auth.email);
        if (!email.includes("@"))
            return [];
        const store = await this.loadStore();
        return items.filter((item) => {
            const name = normalizeInstanceName(readName(item));
            if (!name)
                return false;
            const key = this.findStoreKey(store, name);
            if (!key)
                return false;
            const owner = normalizeEmail(store.instances[key]?.ownerEmail || "");
            return owner === email;
        });
    }
    async filterInstanceNamesForAuth(auth, names) {
        if (this.bypassOwnershipFilter(auth)) {
            return new Set(names.map((n) => normalizeInstanceName(n)).filter(Boolean));
        }
        const email = normalizeEmail(auth.email);
        const store = await this.loadStore();
        const allowed = new Set();
        for (const name of names) {
            const normalized = normalizeInstanceName(name);
            if (!normalized)
                continue;
            const key = this.findStoreKey(store, normalized);
            if (!key)
                continue;
            const owner = normalizeEmail(store.instances[key]?.ownerEmail || "");
            if (owner === email)
                allowed.add(normalized);
        }
        return allowed;
    }
    async listOwnedInstanceNames(ownerEmail) {
        const email = normalizeEmail(ownerEmail);
        if (!email.includes("@"))
            return [];
        const store = await this.loadStore();
        const names = [];
        for (const [instanceName, record] of Object.entries(store.instances)) {
            if (normalizeEmail(record?.ownerEmail || "") === email) {
                names.push(instanceName);
            }
        }
        return names.sort((a, b) => a.localeCompare(b, "pt-BR"));
    }
    async listInstancesOwnedByEmails(ownerEmails) {
        const allowed = new Set(ownerEmails.map((email) => normalizeEmail(email)).filter((email) => email.includes("@")));
        if (!allowed.size)
            return [];
        const store = await this.loadStore();
        const names = [];
        for (const [instanceName, record] of Object.entries(store.instances)) {
            if (allowed.has(normalizeEmail(record?.ownerEmail || ""))) {
                names.push(instanceName);
            }
        }
        return names.sort((a, b) => a.localeCompare(b, "pt-BR"));
    }
    async filterStringListForAuth(auth, names) {
        const allowed = await this.filterInstanceNamesForAuth(auth, names);
        const allowedLower = new Set(Array.from(allowed).map((n) => n.toLowerCase()));
        return names.filter((name) => allowedLower.has(normalizeInstanceName(name).toLowerCase()));
    }
    /**
     * Instâncias legadas na Evolution sem dono em instance-owners.json ficam invisíveis.
     * O master reconcilia órfãs para o próprio e-mail na primeira listagem.
     */
    async reconcileOrphanInstancesForMaster(auth, instanceNames) {
        if (!(0, waba_auth_service_1.isWabaAuthConfigured)())
            return 0;
        const email = normalizeEmail(auth.email);
        if (!email.includes("@"))
            return 0;
        const isMaster = auth.role === "master" || (0, waba_auth_service_1.isWabaMasterEmail)(email);
        if (!isMaster)
            return 0;
        let assigned = 0;
        await this.runLocked(async () => {
            const store = await this.loadStore();
            let changed = false;
            for (const rawName of instanceNames) {
                const name = normalizeInstanceName(rawName);
                if (!name)
                    continue;
                const existingKey = this.findStoreKey(store, name);
                if (existingKey)
                    continue;
                store.instances[name] = {
                    ownerEmail: email,
                    createdAt: new Date().toISOString(),
                };
                assigned += 1;
                changed = true;
            }
            if (changed)
                await this.saveStore(store);
        });
        return assigned;
    }
}
exports.WabaInstanceOwnershipService = WabaInstanceOwnershipService;
exports.wabaInstanceOwnershipService = new WabaInstanceOwnershipService();
