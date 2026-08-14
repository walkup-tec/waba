"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyLeadFromCnpj = exports.normalizeCnpjDigits = exports.WabaLeadsCnpjRepository = exports.resolveLeadsCnpjExportsDir = void 0;
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const data_path_1 = require("../../data-path");
const FILE_NAME = "waba-leads-cnpj-lists.json";
const POOL_FILE_NAME = "waba-leads-cnpj-pools.json";
const ENRICH_QUEUE_FILE_NAME = "waba-leads-cnpj-enrich-queue.json";
const EXPORTS_DIR_NAME = "leads-cnpj-exports";
const DEBOUNCE_MS = 2500;
const emptyStore = () => ({ version: 1, lists: [] });
const emptyPoolStore = () => ({ version: 1, pools: [] });
const emptyEnrichQueue = () => ({
    version: 1,
    dayKey: "",
    activeCampaignKey: null,
    lastCompletedCampaignKey: null,
    order: [],
});
const resolveLeadsCnpjExportsDir = () => node_path_1.default.join((0, data_path_1.resolveDataDir)(), EXPORTS_DIR_NAME);
exports.resolveLeadsCnpjExportsDir = resolveLeadsCnpjExportsDir;
/** Escrita atômica assíncrona — evita travar o event loop (histórico timeout) em JSON multi-MB. */
async function atomicWriteJson(filePath, payload) {
    const dir = node_path_1.default.dirname(filePath);
    if (!(0, node_fs_1.existsSync)(dir))
        (0, node_fs_1.mkdirSync)(dir, { recursive: true });
    // Cede o event loop antes do stringify (payload pode ter vários MB).
    await new Promise((resolve) => setImmediate(resolve));
    const data = JSON.stringify(payload);
    await new Promise((resolve) => setImmediate(resolve));
    const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await (0, promises_1.writeFile)(tmp, data, "utf8");
    try {
        await (0, promises_1.rename)(tmp, filePath);
    }
    catch {
        try {
            await (0, promises_1.writeFile)(filePath, data, "utf8");
        }
        finally {
            try {
                await (0, promises_1.unlink)(tmp);
            }
            catch {
                /* ignore */
            }
        }
    }
}
class WabaLeadsCnpjRepository {
    constructor() {
        this.listCache = null;
        this.poolCache = null;
        this.enrichQueueCache = null;
        this.listFlushTimer = null;
        this.poolFlushTimer = null;
        this.listWriteChain = Promise.resolve();
        this.poolWriteChain = Promise.resolve();
    }
    loadListStoreFromDisk() {
        const filePath = (0, data_path_1.resolveDataFile)(FILE_NAME);
        const dir = node_path_1.default.dirname(filePath);
        if (!(0, node_fs_1.existsSync)(dir))
            (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        if (!(0, node_fs_1.existsSync)(filePath))
            return emptyStore();
        try {
            const raw = (0, node_fs_1.readFileSync)(filePath, "utf8");
            if (!String(raw || "").trim())
                return emptyStore();
            const parsed = JSON.parse(raw);
            if (parsed?.version !== 1 || !Array.isArray(parsed.lists))
                return emptyStore();
            return parsed;
        }
        catch {
            return emptyStore();
        }
    }
    loadPoolStoreFromDisk() {
        const filePath = (0, data_path_1.resolveDataFile)(POOL_FILE_NAME);
        if (!(0, node_fs_1.existsSync)(filePath))
            return emptyPoolStore();
        try {
            const raw = (0, node_fs_1.readFileSync)(filePath, "utf8");
            if (!String(raw || "").trim())
                return emptyPoolStore();
            const parsed = JSON.parse(raw);
            if (parsed?.version !== 1 || !Array.isArray(parsed.pools))
                return emptyPoolStore();
            return parsed;
        }
        catch {
            return emptyPoolStore();
        }
    }
    getListStore() {
        if (!this.listCache)
            this.listCache = this.loadListStoreFromDisk();
        return this.listCache;
    }
    getPoolStore() {
        if (!this.poolCache)
            this.poolCache = this.loadPoolStoreFromDisk();
        return this.poolCache;
    }
    enqueueListFlush() {
        const snapshot = this.listCache;
        if (!snapshot)
            return;
        // Clona referência superficial do store; stringify assíncrono libera o event loop entre jobs.
        this.listWriteChain = this.listWriteChain
            .then(() => atomicWriteJson((0, data_path_1.resolveDataFile)(FILE_NAME), snapshot))
            .catch(() => undefined);
    }
    enqueuePoolFlush() {
        const snapshot = this.poolCache;
        if (!snapshot)
            return;
        this.poolWriteChain = this.poolWriteChain
            .then(() => atomicWriteJson((0, data_path_1.resolveDataFile)(POOL_FILE_NAME), snapshot))
            .catch(() => undefined);
    }
    scheduleListPersist(mode = "debounce") {
        if (mode === "flush") {
            if (this.listFlushTimer) {
                clearTimeout(this.listFlushTimer);
                this.listFlushTimer = null;
            }
            // Escrita síncrona no flush crítico (finalize/boot) evita ler JSON antigo em outro processo.
            try {
                if (this.listCache) {
                    (0, node_fs_1.writeFileSync)((0, data_path_1.resolveDataFile)(FILE_NAME), JSON.stringify(this.listCache), "utf8");
                }
            }
            catch {
                this.enqueueListFlush();
            }
            return;
        }
        if (this.listFlushTimer)
            return;
        this.listFlushTimer = setTimeout(() => {
            this.listFlushTimer = null;
            this.enqueueListFlush();
        }, DEBOUNCE_MS);
    }
    schedulePoolPersist(mode = "debounce") {
        if (mode === "flush") {
            if (this.poolFlushTimer) {
                clearTimeout(this.poolFlushTimer);
                this.poolFlushTimer = null;
            }
            this.enqueuePoolFlush();
            return;
        }
        if (this.poolFlushTimer)
            return;
        this.poolFlushTimer = setTimeout(() => {
            this.poolFlushTimer = null;
            this.enqueuePoolFlush();
        }, DEBOUNCE_MS);
    }
    ensureExportsDir() {
        const dir = (0, exports.resolveLeadsCnpjExportsDir)();
        if (!(0, node_fs_1.existsSync)(dir))
            (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        return dir;
    }
    list() {
        return this.getListStore()
            .lists.slice()
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    getById(id) {
        const normalized = String(id || "").trim();
        if (!normalized)
            return null;
        return this.getListStore().lists.find((item) => item.id === normalized) ?? null;
    }
    /**
     * CNPJs já usados na campanha (anti-duplicidade entre dias da MESMA extração).
     * Sem campaignKey: legado (todas as listas) — preferir sempre passar a chave.
     */
    collectUsedCnpjs(campaignKey) {
        const used = new Set();
        const key = String(campaignKey || "").trim();
        for (const list of this.getListStore().lists) {
            if (key && String(list.campaignKey || "").trim() !== key)
                continue;
            for (const lead of list.leads || []) {
                const cnpj = (0, exports.normalizeCnpjDigits)(lead.cnpj);
                if (cnpj.length === 14)
                    used.add(cnpj);
            }
        }
        return used;
    }
    findListByCampaignDay(campaignKey, dayKey) {
        const key = String(campaignKey || "").trim();
        const day = String(dayKey || "").trim();
        if (!key || !day)
            return null;
        return (this.getListStore().lists.find((item) => item.campaignKey === key && item.dayKey === day) ?? null);
    }
    create(list) {
        const store = this.getListStore();
        if (store.lists.some((item) => item.id === list.id))
            throw new Error("Lista já existe.");
        store.lists.unshift(list);
        this.scheduleListPersist("flush");
        return list;
    }
    /**
     * Atualiza lista em memória.
     * `persist: "debounce"` (default em progresso) evita regravar multi-MB a cada 1s.
     * `persist: "flush"` para checkpoint de leads / status crítico.
     */
    update(list, options) {
        const store = this.getListStore();
        const index = store.lists.findIndex((item) => item.id === list.id);
        if (index < 0)
            throw new Error("Lista não encontrada.");
        store.lists[index] = list;
        this.scheduleListPersist(options?.persist || "debounce");
        return list;
    }
    getPool(key) {
        const normalized = String(key || "").trim();
        if (!normalized)
            return null;
        return this.getPoolStore().pools.find((p) => p.key === normalized) ?? null;
    }
    listPools() {
        return this.getPoolStore().pools.slice();
    }
    /**
     * Mescla novos itens no pool (sem CNPJs já usados em listas) e devolve o pool atualizado.
     */
    mergePool(input) {
        const store = this.getPoolStore();
        let pool = store.pools.find((p) => p.key === input.key);
        if (!pool) {
            pool = {
                key: input.key,
                name: input.name,
                source: input.source,
                filters: input.filters,
                pending: [],
                updatedAt: new Date().toISOString(),
            };
            store.pools.push(pool);
        }
        const pendingMap = new Map();
        for (const item of pool.pending) {
            const cnpj = (0, exports.normalizeCnpjDigits)(item.cnpj);
            if (cnpj.length !== 14 || input.usedCnpjs.has(cnpj))
                continue;
            pendingMap.set(cnpj, { cnpj, nome: String(item.nome || "").trim() });
        }
        for (const item of input.items) {
            const cnpj = (0, exports.normalizeCnpjDigits)(item.cnpj);
            if (cnpj.length !== 14 || input.usedCnpjs.has(cnpj))
                continue;
            if (pendingMap.has(cnpj))
                continue;
            pendingMap.set(cnpj, { cnpj, nome: String(item.nome || "").trim() });
        }
        pool.name = input.name;
        pool.source = input.source;
        pool.filters = input.filters;
        pool.pending = [...pendingMap.values()];
        pool.updatedAt = new Date().toISOString();
        this.schedulePoolPersist(input.persist || "debounce");
        return pool;
    }
    /** Retira até `limit` CNPJs do pool (FIFO) e persiste o restante. */
    takeFromPool(key, limit) {
        const store = this.getPoolStore();
        const pool = store.pools.find((p) => p.key === key);
        if (!pool || !pool.pending.length || limit <= 0)
            return [];
        const taken = pool.pending.slice(0, limit);
        pool.pending = pool.pending.slice(limit);
        pool.updatedAt = new Date().toISOString();
        this.schedulePoolPersist("flush");
        return taken;
    }
    saveExportFile(listId, buffer, safeBaseName, dayKey) {
        const dir = this.ensureExportsDir();
        const day = String(dayKey || "").trim();
        const prefix = day ? `${day}-` : `${listId.slice(0, 8)}-`;
        const fileName = `${prefix}${safeBaseName}.xlsx`;
        (0, node_fs_1.writeFileSync)(node_path_1.default.join(dir, fileName), buffer);
        return fileName;
    }
    resolveExportPath(fileName) {
        const safe = node_path_1.default.basename(String(fileName || "").trim());
        if (!safe || safe !== fileName)
            return null;
        const filePath = node_path_1.default.join((0, exports.resolveLeadsCnpjExportsDir)(), safe);
        return (0, node_fs_1.existsSync)(filePath) ? filePath : null;
    }
    /** Remove a lista do histórico e o Excel exportado (se existir). */
    delete(id) {
        const normalized = String(id || "").trim();
        if (!normalized)
            return null;
        const store = this.getListStore();
        const index = store.lists.findIndex((item) => item.id === normalized);
        if (index < 0)
            return null;
        const [removed] = store.lists.splice(index, 1);
        this.scheduleListPersist("flush");
        if (removed?.exportFileName) {
            this.unlinkExport(removed.exportFileName);
        }
        return removed ?? null;
    }
    /** Remove todas as listas de uma campanha (histórico + Excels). */
    deleteByCampaignKey(campaignKey) {
        const key = String(campaignKey || "").trim();
        if (!key)
            return [];
        const store = this.getListStore();
        const removed = [];
        const kept = [];
        for (const item of store.lists) {
            const itemKey = String(item.campaignKey || "").trim();
            if (itemKey === key) {
                removed.push(item);
                if (item.exportFileName)
                    this.unlinkExport(item.exportFileName);
            }
            else {
                kept.push(item);
            }
        }
        if (!removed.length)
            return [];
        store.lists = kept;
        this.scheduleListPersist("flush");
        return removed;
    }
    /** Apaga o pool da campanha por completo (pendentes + metadados). */
    deletePool(key) {
        const normalized = String(key || "").trim();
        if (!normalized)
            return false;
        const store = this.getPoolStore();
        const before = store.pools.length;
        store.pools = store.pools.filter((p) => p.key !== normalized);
        if (store.pools.length === before)
            return false;
        this.schedulePoolPersist("flush");
        return true;
    }
    setPoolAutoContinuePaused(key, paused) {
        const normalized = String(key || "").trim();
        if (!normalized)
            return;
        const store = this.getPoolStore();
        const pool = store.pools.find((p) => p.key === normalized);
        if (!pool)
            return;
        pool.autoContinuePaused = Boolean(paused);
        pool.updatedAt = new Date().toISOString();
        this.schedulePoolPersist("flush");
    }
    getEnrichQueue() {
        if (!this.enrichQueueCache) {
            const filePath = (0, data_path_1.resolveDataFile)(ENRICH_QUEUE_FILE_NAME);
            if (!(0, node_fs_1.existsSync)(filePath)) {
                this.enrichQueueCache = emptyEnrichQueue();
            }
            else {
                try {
                    const parsed = JSON.parse((0, node_fs_1.readFileSync)(filePath, "utf8"));
                    this.enrichQueueCache =
                        parsed?.version === 1
                            ? {
                                version: 1,
                                dayKey: String(parsed.dayKey || ""),
                                activeCampaignKey: parsed.activeCampaignKey
                                    ? String(parsed.activeCampaignKey)
                                    : null,
                                lastCompletedCampaignKey: parsed.lastCompletedCampaignKey
                                    ? String(parsed.lastCompletedCampaignKey)
                                    : null,
                                order: Array.isArray(parsed.order)
                                    ? parsed.order.map((k) => String(k || "").trim()).filter(Boolean)
                                    : [],
                            }
                            : emptyEnrichQueue();
                }
                catch {
                    this.enrichQueueCache = emptyEnrichQueue();
                }
            }
        }
        return this.enrichQueueCache;
    }
    saveEnrichQueue(next) {
        this.enrichQueueCache = {
            version: 1,
            dayKey: String(next.dayKey || ""),
            activeCampaignKey: next.activeCampaignKey ? String(next.activeCampaignKey) : null,
            lastCompletedCampaignKey: next.lastCompletedCampaignKey
                ? String(next.lastCompletedCampaignKey)
                : null,
            order: Array.isArray(next.order)
                ? next.order.map((k) => String(k || "").trim()).filter(Boolean)
                : [],
        };
        const filePath = (0, data_path_1.resolveDataFile)(ENRICH_QUEUE_FILE_NAME);
        const dir = node_path_1.default.dirname(filePath);
        if (!(0, node_fs_1.existsSync)(dir))
            (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        (0, node_fs_1.writeFileSync)(filePath, JSON.stringify(this.enrichQueueCache), "utf8");
    }
    nextListaIndex(campaignKey) {
        const key = String(campaignKey || "").trim();
        const ready = this.getListStore().lists.filter((l) => String(l.campaignKey || "").trim() === key &&
            l.status === "ready" &&
            Boolean(l.exportFileName));
        let max = 0;
        for (const item of ready) {
            const n = Math.round(Number(item.listaIndex || 0) || 0);
            if (n > max)
                max = n;
        }
        return max + 1;
    }
    unlinkExport(fileName) {
        const filePath = this.resolveExportPath(fileName);
        if (!filePath)
            return;
        try {
            (0, node_fs_1.unlinkSync)(filePath);
        }
        catch {
            /* ignore */
        }
    }
    newId() {
        return (0, node_crypto_1.randomUUID)();
    }
}
exports.WabaLeadsCnpjRepository = WabaLeadsCnpjRepository;
const normalizeCnpjDigits = (value) => String(value ?? "").replace(/\D/g, "").slice(0, 14);
exports.normalizeCnpjDigits = normalizeCnpjDigits;
const emptyLeadFromCnpj = (cnpj) => ({
    cnpj: (0, exports.normalizeCnpjDigits)(cnpj),
    nome: "",
    telefone: "",
    email: "",
    situacao: "",
    dataAbertura: "",
    cidade: "",
    estado: "",
    endereco: "",
});
exports.emptyLeadFromCnpj = emptyLeadFromCnpj;
