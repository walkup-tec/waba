"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wabaFazendaPoolService = exports.WabaFazendaPoolService = void 0;
exports.configureWabaFazendaPool = configureWabaFazendaPool;
const node_fs_1 = require("node:fs");
const alternativa_number_activation_repository_1 = require("../billing/alternativa-number-activation.repository");
const data_path_1 = require("../data-path");
const waba_system_user_repository_1 = require("../users/waba-system-user.repository");
const waba_instance_ownership_service_1 = require("./waba-instance-ownership.service");
let fazendaPoolDeps = null;
function configureWabaFazendaPool(deps) {
    fazendaPoolDeps = deps;
}
const normalizeEmail = (value) => String(value ?? "").trim().toLowerCase();
const normalizeInstanceName = (value) => String(value ?? "").trim();
function listMasterOwnerEmails() {
    const emails = new Set();
    const adminEmail = normalizeEmail(String(process.env.WABA_ADMIN_EMAIL ?? ""));
    if (adminEmail.includes("@"))
        emails.add(adminEmail);
    const repo = new waba_system_user_repository_1.WabaSystemUserRepository();
    for (const user of repo.list()) {
        if (user.role === "master" && user.email.includes("@")) {
            emails.add(normalizeEmail(user.email));
        }
    }
    return Array.from(emails);
}
function readEvoCacheItems() {
    try {
        const raw = (0, node_fs_1.readFileSync)((0, data_path_1.resolveDataFile)("evo-instances-cache.json"), "utf-8");
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed?.items) ? parsed.items : [];
    }
    catch {
        return [];
    }
}
function resolveUsage(usageMap, instanceName) {
    const key = normalizeInstanceName(instanceName);
    if (!key)
        return undefined;
    const direct = usageMap.get(key);
    if (direct)
        return direct;
    const target = key.toLowerCase();
    for (const [mapKey, value] of usageMap.entries()) {
        if (mapKey.toLowerCase() === target)
            return value;
    }
    return undefined;
}
function resolveCacheRow(cacheItems, instanceName) {
    const target = normalizeInstanceName(instanceName).toLowerCase();
    if (!target)
        return null;
    return (cacheItems.find((row) => String(row?.name || "").trim().toLowerCase() === target) ?? null);
}
class WabaFazendaPoolService {
    constructor(activationRepository = new alternativa_number_activation_repository_1.AlternativaNumberActivationRepository(), ownershipService = waba_instance_ownership_service_1.wabaInstanceOwnershipService) {
        this.activationRepository = activationRepository;
        this.ownershipService = ownershipService;
    }
    requireDeps() {
        if (!fazendaPoolDeps) {
            throw new Error("Pool da fazenda n├úo configurado no servidor.");
        }
        return fazendaPoolDeps;
    }
    async listMasterFazendaInstanceNames() {
        const deps = this.requireDeps();
        const usageMap = await deps.loadInstanceUsageMap();
        const fazendaMarked = [];
        for (const [instanceName, usage] of usageMap.entries()) {
            if (usage?.useFazenda === true) {
                fazendaMarked.push(normalizeInstanceName(instanceName));
            }
        }
        const uniqueMarked = Array.from(new Set(fazendaMarked.map((name) => name.toLowerCase()).filter(Boolean)))
            .map((key) => fazendaMarked.find((name) => name.toLowerCase() === key) || key)
            .filter(Boolean);
        if (uniqueMarked.length > 0) {
            return uniqueMarked.sort((a, b) => a.localeCompare(b, "pt-BR"));
        }
        const masterEmails = listMasterOwnerEmails();
        const owned = await this.ownershipService.listInstancesOwnedByEmails(masterEmails);
        return owned.filter((instanceName) => resolveUsage(usageMap, instanceName)?.useFazenda === true);
    }
    async isMasterFazendaInstance(instanceName) {
        const names = await this.listMasterFazendaInstanceNames();
        const target = normalizeInstanceName(instanceName).toLowerCase();
        return names.some((name) => name.toLowerCase() === target);
    }
    async buildPoolForSubscriber(subscriberEmail) {
        const email = normalizeEmail(subscriberEmail);
        const fazendaNames = await this.listMasterFazendaInstanceNames();
        const cacheItems = readEvoCacheItems();
        const items = fazendaNames.map((instanceName) => {
            const cached = resolveCacheRow(cacheItems, instanceName);
            const connectionStatus = String(cached?.connectionStatus || "unknown");
            const label = String(cached?.displayName || cached?.instanceAlias || instanceName).trim() || instanceName;
            const number = String(cached?.number || "").trim();
            const assignedToEmail = this.activationRepository.findSubscriberEmailForInstance(instanceName);
            return {
                instanceName,
                label,
                number: number || undefined,
                connectionStatus,
                isOpen: connectionStatus.toLowerCase().includes("open"),
                assignedToEmail,
            };
        });
        const assignedToSubscriber = items.filter((row) => row.assignedToEmail === email);
        const availableToClaim = items.filter((row) => !row.assignedToEmail && row.isOpen);
        return { items, availableToClaim, assignedToSubscriber };
    }
    async assertCanAssignToSubscriber(subscriberEmail, instanceName) {
        const email = normalizeEmail(subscriberEmail);
        const name = normalizeInstanceName(instanceName);
        if (!email.includes("@") || !name) {
            throw new Error("Sessão ou instância inválida.");
        }
        const isFazenda = await this.isMasterFazendaInstance(name);
        if (!isFazenda) {
            throw new Error("Este número não está disponível na fazenda master.");
        }
        const assignedTo = this.activationRepository.findSubscriberEmailForInstance(name);
        if (assignedTo && assignedTo !== email) {
            throw new Error("Este número da fazenda já está vinculado a outro assinante.");
        }
    }
    async filterDisparadorInstancesForAuth(auth, names) {
        const owned = await this.ownershipService.filterStringListForAuth(auth, names);
        const ownedLower = new Set(owned.map((name) => name.toLowerCase()));
        const email = normalizeEmail(auth.email);
        const activations = email.includes("@")
            ? this.activationRepository.listForEmail(email)
            : [];
        const activationLower = new Set(activations.map((row) => row.instanceName.toLowerCase()));
        return names.filter((name) => {
            const key = normalizeInstanceName(name).toLowerCase();
            if (!key)
                return false;
            return ownedLower.has(key) || activationLower.has(key);
        });
    }
}
exports.WabaFazendaPoolService = WabaFazendaPoolService;
exports.wabaFazendaPoolService = new WabaFazendaPoolService();
