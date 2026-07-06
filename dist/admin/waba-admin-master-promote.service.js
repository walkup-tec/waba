"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaAdminMasterPromoteService = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const data_path_1 = require("../data-path");
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
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
const writeJsonAtomic = (filePath, data) => {
    const dir = node_path_1.default.dirname(filePath);
    if (!(0, node_fs_1.existsSync)(dir))
        (0, node_fs_1.mkdirSync)(dir, { recursive: true });
    const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    (0, node_fs_1.writeFileSync)(tmp, JSON.stringify(data, null, 2), "utf8");
    (0, node_fs_1.renameSync)(tmp, filePath);
};
const mergeById = (list, incoming, idKey = "id") => {
    const out = Array.isArray(list) ? [...list] : [];
    const index = new Map();
    out.forEach((row, i) => {
        const id = String(row?.[idKey] || "").trim();
        if (id)
            index.set(id, i);
    });
    for (const row of incoming || []) {
        const id = String(row?.[idKey] || "").trim();
        if (!id)
            continue;
        const existingIdx = index.get(id);
        if (existingIdx !== undefined)
            out[existingIdx] = { ...out[existingIdx], ...row };
        else {
            index.set(id, out.length);
            out.push(row);
        }
    }
    return out;
};
const rewriteIntakePathsForDataDir = (intake, dataDir) => {
    const id = String(intake?.id || "").trim();
    if (!id)
        return intake;
    const storageDir = node_path_1.default.join(dataDir, "campaign-intakes", id);
    const next = { ...intake };
    for (const field of ["imageStoredPath", "spreadsheetStoredPath", "spreadsheetTrimmedPath"]) {
        const baseName = node_path_1.default.basename(String(next[field] || ""));
        if (!baseName)
            continue;
        next[field] = node_path_1.default.join(storageDir, baseName);
    }
    return next;
};
class WabaAdminMasterPromoteService {
    promoteFromV02Bundle(bundle) {
        const email = normalizeEmail(bundle.email);
        if (!email.includes("@"))
            throw new Error("E-mail inválido no bundle.");
        const systemUser = bundle.systemUser;
        if (!systemUser?.passwordHash || normalizeEmail(systemUser.email) !== email) {
            throw new Error("Bundle de master inválido.");
        }
        if (String(systemUser.role || "").toLowerCase() !== "master") {
            throw new Error("O bundle não corresponde a um usuário master.");
        }
        const summary = {
            ok: true,
            email,
            kind: "master",
            systemUser: "updated",
            financeiroSplitConfig: false,
            financeiroSettlementsMerged: 0,
            masterMenuSeen: false,
            aquecedorConfig: false,
            billingOrdersAdded: 0,
            creditUsage: false,
            bonusBalance: false,
            instanceOwners: 0,
            alternativaActivations: false,
            campaignsMerged: 0,
            campaignIntakesMerged: 0,
            aquecedorEnviosLogMerged: 0,
            aquecedorLifecycleInstances: 0,
            skippedSubscriberRecords: true,
        };
        const usersPath = (0, data_path_1.resolveDataFile)("waba-system-users.json");
        const usersStore = readJson(usersPath, {
            version: 1,
            users: [],
        });
        if (!Array.isArray(usersStore.users))
            usersStore.users = [];
        const userIdx = usersStore.users.findIndex((row) => normalizeEmail(row.email) === email);
        const userPayload = {
            ...systemUser,
            email,
            role: "master",
            updatedAt: new Date().toISOString(),
        };
        if (userIdx >= 0) {
            usersStore.users[userIdx] = {
                ...usersStore.users[userIdx],
                ...userPayload,
                id: usersStore.users[userIdx].id,
            };
            summary.systemUser = "updated";
        }
        else {
            usersStore.users.push(userPayload);
            summary.systemUser = "created";
        }
        writeJsonAtomic(usersPath, usersStore);
        if (bundle.financeiroSplitConfig && typeof bundle.financeiroSplitConfig === "object") {
            writeJsonAtomic((0, data_path_1.resolveDataFile)("waba-financeiro-split-config.json"), bundle.financeiroSplitConfig);
            summary.financeiroSplitConfig = true;
        }
        if (Array.isArray(bundle.financeiroSettlements) && bundle.financeiroSettlements.length > 0) {
            const settlementsPath = (0, data_path_1.resolveDataFile)("waba-financeiro-split-settlements.json");
            const settlementsStore = readJson(settlementsPath, { version: 1, settlements: [] });
            if (!Array.isArray(settlementsStore.settlements))
                settlementsStore.settlements = [];
            settlementsStore.settlements = mergeById(settlementsStore.settlements, bundle.financeiroSettlements);
            writeJsonAtomic(settlementsPath, settlementsStore);
            summary.financeiroSettlementsMerged = bundle.financeiroSettlements.length;
        }
        if (bundle.masterMenuSeen && typeof bundle.masterMenuSeen === "object") {
            const seenPath = (0, data_path_1.resolveDataFile)("waba-master-menu-seen.json");
            const seenStore = readJson(seenPath, { version: 1, masters: {} });
            if (!seenStore.masters || typeof seenStore.masters !== "object")
                seenStore.masters = {};
            const mergedSeen = { ...(seenStore.masters[email] ?? {}) };
            for (const [key, value] of Object.entries(bundle.masterMenuSeen)) {
                if (typeof value === "string" && value.trim())
                    mergedSeen[key] = value.trim();
            }
            seenStore.masters[email] = mergedSeen;
            writeJsonAtomic(seenPath, seenStore);
            summary.masterMenuSeen = true;
        }
        if (bundle.aquecedorConfig && typeof bundle.aquecedorConfig === "object") {
            writeJsonAtomic((0, data_path_1.resolveDataFile)("aquecedor-config.json"), bundle.aquecedorConfig);
            summary.aquecedorConfig = true;
        }
        const ordersPath = (0, data_path_1.resolveDataFile)("waba-billing-orders.json");
        const orders = readJson(ordersPath, []);
        const orderList = Array.isArray(orders) ? orders : [];
        const knownOrderIds = new Set(orderList.map((row) => String(row?.id || "").trim()).filter(Boolean));
        for (const order of bundle.billingOrders || []) {
            if (normalizeEmail(String(order?.ownerEmail || "")) !== email)
                continue;
            const id = String(order?.id || "").trim();
            if (!id || knownOrderIds.has(id))
                continue;
            orderList.unshift(order);
            knownOrderIds.add(id);
            summary.billingOrdersAdded = Number(summary.billingOrdersAdded) + 1;
        }
        writeJsonAtomic(ordersPath, orderList);
        if (bundle.creditUsage) {
            const usagePath = (0, data_path_1.resolveDataFile)("waba-disparos-credit-usage.json");
            const usageStore = readJson(usagePath, { version: 2, entries: [] });
            if (!Array.isArray(usageStore.entries))
                usageStore.entries = [];
            const entry = { ...bundle.creditUsage, email };
            const usageIdx = usageStore.entries.findIndex((row) => normalizeEmail(String(row?.email || "")) === email);
            if (usageIdx >= 0)
                usageStore.entries[usageIdx] = entry;
            else
                usageStore.entries.push(entry);
            writeJsonAtomic(usagePath, usageStore);
            summary.creditUsage = true;
        }
        if (bundle.bonusBalance) {
            const bonusPath = (0, data_path_1.resolveDataFile)("waba-disparos-bonus-balances.json");
            const bonusStore = readJson(bonusPath, { version: 2, entries: [] });
            if (!Array.isArray(bonusStore.entries))
                bonusStore.entries = [];
            const entry = { ...bundle.bonusBalance, email };
            const bonusIdx = bonusStore.entries.findIndex((row) => normalizeEmail(String(row?.email || "")) === email);
            if (bonusIdx >= 0)
                bonusStore.entries[bonusIdx] = entry;
            else
                bonusStore.entries.push(entry);
            writeJsonAtomic(bonusPath, bonusStore);
            summary.bonusBalance = true;
        }
        const ownersPath = (0, data_path_1.resolveDataFile)("instance-owners.json");
        const ownersStore = readJson(ownersPath, {
            instances: {},
        });
        if (!ownersStore.instances || typeof ownersStore.instances !== "object")
            ownersStore.instances = {};
        const now = new Date().toISOString();
        const forceTransfer = bundle.forceInstanceOwnerTransfer === true;
        for (const [name, meta] of Object.entries(bundle.instanceOwners || {})) {
            const key = String(name || "").trim();
            if (!key || normalizeEmail(String(meta?.ownerEmail || "")) !== email)
                continue;
            const existingOwner = normalizeEmail(String(ownersStore.instances[key]?.ownerEmail || ""));
            if (existingOwner && existingOwner !== email && !forceTransfer)
                continue;
            ownersStore.instances[key] = {
                ownerEmail: email,
                createdAt: String(meta?.createdAt || now),
                ...(meta?.syncedFromWalkupProdAt
                    ? { syncedFromWalkupProdAt: String(meta.syncedFromWalkupProdAt) }
                    : { promotedFromV02At: now }),
                ...(forceTransfer && existingOwner && existingOwner !== email
                    ? { transferredAt: now, transferredFrom: existingOwner }
                    : {}),
            };
            summary.instanceOwners = Number(summary.instanceOwners) + 1;
        }
        writeJsonAtomic(ownersPath, ownersStore);
        if (bundle.alternativaActivations) {
            const actPath = (0, data_path_1.resolveDataFile)("alternativa-number-activations.json");
            const actStore = readJson(actPath, { byEmail: {} });
            if (!actStore.byEmail || typeof actStore.byEmail !== "object")
                actStore.byEmail = {};
            actStore.byEmail[email] = bundle.alternativaActivations;
            writeJsonAtomic(actPath, actStore);
            summary.alternativaActivations = true;
        }
        const dispatchPath = (0, data_path_1.resolveDataFile)("disparos-local-state.json");
        const dispatchStore = readJson(dispatchPath, { version: 1, campaigns: [] });
        if (!Array.isArray(dispatchStore.campaigns))
            dispatchStore.campaigns = [];
        const masterCampaigns = (bundle.campaigns || []).filter((row) => normalizeEmail(String(row?.ownerEmail || "")) === email);
        dispatchStore.campaigns = mergeById(dispatchStore.campaigns, masterCampaigns);
        dispatchStore.savedAt = new Date().toISOString();
        summary.campaignsMerged = masterCampaigns.length;
        writeJsonAtomic(dispatchPath, dispatchStore);
        const intakesPath = (0, data_path_1.resolveDataFile)("waba-campaign-intakes.json");
        const intakesStore = readJson(intakesPath, { version: 1, intakes: [] });
        if (!Array.isArray(intakesStore.intakes))
            intakesStore.intakes = [];
        const dataDir = node_path_1.default.dirname(intakesPath);
        const masterIntakes = (bundle.campaignIntakes || [])
            .filter((row) => normalizeEmail(String(row?.ownerEmail || "")) === email)
            .map((row) => rewriteIntakePathsForDataDir(row, dataDir));
        intakesStore.intakes = mergeById(intakesStore.intakes, masterIntakes);
        summary.campaignIntakesMerged = masterIntakes.length;
        writeJsonAtomic(intakesPath, intakesStore);
        if ((bundle.aquecedorEnviosLog || []).length > 0) {
            const logPath = (0, data_path_1.resolveDataFile)("aquecedor-envios-log.json");
            const logStore = readJson(logPath, { items: [] });
            const logList = Array.isArray(logStore)
                ? logStore
                : Array.isArray(logStore.items)
                    ? logStore.items
                    : [];
            const masterLog = (bundle.aquecedorEnviosLog || []).filter((row) => normalizeEmail(String(row?.ownerEmail || "")) === email);
            const merged = mergeById(logList, masterLog);
            writeJsonAtomic(logPath, { items: merged });
            summary.aquecedorEnviosLogMerged = masterLog.length;
        }
        if (bundle.aquecedorLifecycleInstances && Object.keys(bundle.aquecedorLifecycleInstances).length > 0) {
            const lifePath = (0, data_path_1.resolveDataFile)("aquecedor-instance-lifecycle.json");
            const lifeStore = readJson(lifePath, {
                version: 1,
                instances: {},
            });
            if (!lifeStore.instances || typeof lifeStore.instances !== "object")
                lifeStore.instances = {};
            for (const [name, row] of Object.entries(bundle.aquecedorLifecycleInstances)) {
                const ownerInBundle = normalizeEmail(String((bundle.instanceOwners || {})[name]?.ownerEmail || email));
                if (ownerInBundle !== email)
                    continue;
                lifeStore.instances[name] = row;
                summary.aquecedorLifecycleInstances = Number(summary.aquecedorLifecycleInstances) + 1;
            }
            writeJsonAtomic(lifePath, lifeStore);
        }
        return summary;
    }
}
exports.WabaAdminMasterPromoteService = WabaAdminMasterPromoteService;
