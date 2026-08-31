"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaAdminSubscriberPurgeService = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const data_path_1 = require("../data-path");
const normalizeEmail = (value) => value.trim().toLowerCase();
const readJson = (filePath, fallback) => {
    if (!(0, node_fs_1.existsSync)(filePath))
        return fallback;
    try {
        return JSON.parse((0, node_fs_1.readFileSync)(filePath, "utf8"));
    }
    catch {
        return fallback;
    }
};
const writeJson = (filePath, data) => {
    const dir = node_path_1.default.dirname(filePath);
    if (!(0, node_fs_1.existsSync)(dir))
        (0, node_fs_1.mkdirSync)(dir, { recursive: true });
    const tmp = `${filePath}.tmp`;
    (0, node_fs_1.writeFileSync)(tmp, JSON.stringify(data, null, 2), "utf8");
    (0, node_fs_1.writeFileSync)(filePath, (0, node_fs_1.readFileSync)(tmp));
};
const removeDirRecursive = (dir) => {
    if (!(0, node_fs_1.existsSync)(dir))
        return;
    (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
};
class WabaAdminSubscriberPurgeService {
    purgeByEmail(rawEmail) {
        const email = normalizeEmail(rawEmail);
        if (!email.includes("@"))
            throw new Error("Informe um e-mail válido.");
        const dataDir = (0, data_path_1.resolveDataDir)();
        const summary = {
            email,
            subscriberRemoved: false,
            systemUserRemoved: false,
            billingOrdersRemoved: 0,
            creditUsageRemoved: false,
            bonusBalanceRemoved: false,
            campaignIntakesRemoved: 0,
            campaignIntakeDirsRemoved: 0,
            alternativaActivationsRemoved: false,
            instanceOwnersRemoved: 0,
            supportTicketsRemoved: 0,
            splitSettlementsRemoved: 0,
        };
        const subscribersPath = (0, data_path_1.resolveDataFile)("waba-subscribers.json");
        const subscribersStore = readJson(subscribersPath, { version: 1, subscribers: [] });
        if (!Array.isArray(subscribersStore.subscribers))
            subscribersStore.subscribers = [];
        const beforeSubs = subscribersStore.subscribers.length;
        subscribersStore.subscribers = subscribersStore.subscribers.filter((row) => normalizeEmail(String(row?.email ?? "")) !== email);
        summary.subscriberRemoved = subscribersStore.subscribers.length < beforeSubs;
        if (!summary.subscriberRemoved)
            throw new Error("Assinante não encontrado.");
        if (!summary.subscriberRemoved)
            throw new Error("Assinante não encontrado.");
        writeJson(subscribersPath, subscribersStore);
        const systemUsersPath = (0, data_path_1.resolveDataFile)("waba-system-users.json");
        const systemUsersStore = readJson(systemUsersPath, {
            version: 1,
            users: [],
        });
        if (Array.isArray(systemUsersStore.users)) {
            const beforeUsers = systemUsersStore.users.length;
            systemUsersStore.users = systemUsersStore.users.filter((user) => {
                if (normalizeEmail(String(user?.email ?? "")) !== email)
                    return true;
                return String(user?.role ?? "").trim().toLowerCase() === "master";
            });
            summary.systemUserRemoved = systemUsersStore.users.length < beforeUsers;
            if (summary.systemUserRemoved)
                writeJson(systemUsersPath, systemUsersStore);
        }
        const ordersPath = (0, data_path_1.resolveDataFile)("waba-billing-orders.json");
        const orders = readJson(ordersPath, []);
        if (Array.isArray(orders)) {
            const kept = orders.filter((order) => normalizeEmail(String(order?.ownerEmail ?? "")) !== email);
            summary.billingOrdersRemoved = orders.length - kept.length;
            if (summary.billingOrdersRemoved > 0)
                writeJson(ordersPath, kept);
        }
        const creditPath = (0, data_path_1.resolveDataFile)("waba-disparos-credit-usage.json");
        const creditStore = readJson(creditPath, { version: 2, entries: [] });
        if (Array.isArray(creditStore.entries)) {
            const kept = creditStore.entries.filter((entry) => normalizeEmail(String(entry?.email ?? "")) !== email);
            summary.creditUsageRemoved = kept.length < creditStore.entries.length;
            if (summary.creditUsageRemoved)
                writeJson(creditPath, { ...creditStore, entries: kept });
        }
        const bonusPath = (0, data_path_1.resolveDataFile)("waba-disparos-bonus-balances.json");
        const bonusStore = readJson(bonusPath, { version: 2, entries: [] });
        if (Array.isArray(bonusStore.entries)) {
            const kept = bonusStore.entries.filter((entry) => normalizeEmail(String(entry?.email ?? "")) !== email);
            summary.bonusBalanceRemoved = kept.length < bonusStore.entries.length;
            if (summary.bonusBalanceRemoved)
                writeJson(bonusPath, { ...bonusStore, entries: kept });
        }
        const intakesPath = (0, data_path_1.resolveDataFile)("waba-campaign-intakes.json");
        const intakesStore = readJson(intakesPath, { version: 1, intakes: [] });
        if (!Array.isArray(intakesStore.intakes))
            intakesStore.intakes = [];
        const removedIntakeIds = [];
        const keptIntakes = intakesStore.intakes.filter((intake) => {
            if (normalizeEmail(String(intake?.ownerEmail ?? "")) !== email)
                return true;
            if (intake?.id)
                removedIntakeIds.push(String(intake.id));
            return false;
        });
        summary.campaignIntakesRemoved = intakesStore.intakes.length - keptIntakes.length;
        if (summary.campaignIntakesRemoved > 0) {
            writeJson(intakesPath, { ...intakesStore, intakes: keptIntakes });
            const intakesDir = node_path_1.default.join(dataDir, "campaign-intakes");
            for (const intakeId of removedIntakeIds) {
                const dir = node_path_1.default.join(intakesDir, intakeId);
                if ((0, node_fs_1.existsSync)(dir)) {
                    removeDirRecursive(dir);
                    summary.campaignIntakeDirsRemoved += 1;
                }
            }
        }
        const altPath = (0, data_path_1.resolveDataFile)("alternativa-number-activations.json");
        const altStore = readJson(altPath, { byEmail: {} });
        if (altStore?.byEmail && Object.prototype.hasOwnProperty.call(altStore.byEmail, email)) {
            delete altStore.byEmail[email];
            summary.alternativaActivationsRemoved = true;
            writeJson(altPath, altStore);
        }
        const ownersPath = (0, data_path_1.resolveDataFile)("instance-owners.json");
        const ownersStore = readJson(ownersPath, {
            instances: {},
            deletedInstances: {},
        });
        if (ownersStore?.instances && typeof ownersStore.instances === "object") {
            for (const [key, value] of Object.entries(ownersStore.instances)) {
                if (normalizeEmail(String(value?.ownerEmail ?? "")) === email) {
                    delete ownersStore.instances[key];
                    summary.instanceOwnersRemoved += 1;
                }
            }
            if (summary.instanceOwnersRemoved > 0)
                writeJson(ownersPath, ownersStore);
        }
        const ticketsPath = (0, data_path_1.resolveDataFile)("waba-support-tickets.json");
        const ticketsStore = readJson(ticketsPath, {
            version: 1,
            tickets: [],
        });
        if (Array.isArray(ticketsStore.tickets)) {
            const removedTickets = ticketsStore.tickets.filter((ticket) => normalizeEmail(String(ticket?.ownerEmail ?? "")) === email);
            const keptTickets = ticketsStore.tickets.filter((ticket) => normalizeEmail(String(ticket?.ownerEmail ?? "")) !== email);
            summary.supportTicketsRemoved = removedTickets.length;
            if (summary.supportTicketsRemoved > 0) {
                writeJson(ticketsPath, { ...ticketsStore, tickets: keptTickets });
                const supportDir = node_path_1.default.join(dataDir, "support-tickets");
                for (const ticket of removedTickets) {
                    const dir = node_path_1.default.join(supportDir, String(ticket.id || ""));
                    if ((0, node_fs_1.existsSync)(dir))
                        removeDirRecursive(dir);
                }
            }
        }
        const settlementsPath = (0, data_path_1.resolveDataFile)("waba-financeiro-split-settlements.json");
        const settlementsStore = readJson(settlementsPath, {
            version: 1,
            settlements: [],
        });
        if (Array.isArray(settlementsStore.settlements)) {
            const kept = settlementsStore.settlements.filter((row) => normalizeEmail(String(row?.ownerEmail ?? "")) !== email);
            summary.splitSettlementsRemoved = settlementsStore.settlements.length - kept.length;
            if (summary.splitSettlementsRemoved > 0) {
                writeJson(settlementsPath, { ...settlementsStore, settlements: kept });
            }
        }
        return summary;
    }
}
exports.WabaAdminSubscriberPurgeService = WabaAdminSubscriberPurgeService;
