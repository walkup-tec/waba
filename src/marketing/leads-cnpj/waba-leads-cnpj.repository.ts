import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { writeFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { resolveDataDir, resolveDataFile } from "../../data-path";
import type {
  WabaLeadsCnpjList,
  WabaLeadsCnpjLead,
  WabaLeadsCnpjPool,
  WabaLeadsCnpjPoolItem,
  WabaLeadsCnpjEnrichQueue,
} from "./waba-leads-cnpj.types";

type Store = {
  version: 1;
  lists: WabaLeadsCnpjList[];
};

type PoolStore = {
  version: 1;
  pools: WabaLeadsCnpjPool[];
};

const FILE_NAME = "waba-leads-cnpj-lists.json";
const POOL_FILE_NAME = "waba-leads-cnpj-pools.json";
const ENRICH_QUEUE_FILE_NAME = "waba-leads-cnpj-enrich-queue.json";
const EXPORTS_DIR_NAME = "leads-cnpj-exports";
const DEBOUNCE_MS = 2500;

const emptyStore = (): Store => ({ version: 1, lists: [] });
const emptyPoolStore = (): PoolStore => ({ version: 1, pools: [] });
const emptyEnrichQueue = (): WabaLeadsCnpjEnrichQueue => ({
  version: 1,
  dayKey: "",
  activeCampaignKey: null,
  lastCompletedCampaignKey: null,
  order: [],
});

export const resolveLeadsCnpjExportsDir = (): string =>
  path.join(resolveDataDir(), EXPORTS_DIR_NAME);

/** Escrita atômica assíncrona — evita travar o event loop (histórico timeout) em JSON multi-MB. */
async function atomicWriteJson(filePath: string, payload: unknown) {
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  // Cede o event loop antes do stringify (payload pode ter vários MB).
  await new Promise<void>((resolve) => setImmediate(resolve));
  const data = JSON.stringify(payload);
  await new Promise<void>((resolve) => setImmediate(resolve));
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, data, "utf8");
  try {
    await rename(tmp, filePath);
  } catch {
    try {
      await writeFile(filePath, data, "utf8");
    } finally {
      try {
        await unlink(tmp);
      } catch {
        /* ignore */
      }
    }
  }
}

export type LeadsCnpjPersistMode = "debounce" | "flush";

export class WabaLeadsCnpjRepository {
  private listCache: Store | null = null;
  private poolCache: PoolStore | null = null;
  private enrichQueueCache: WabaLeadsCnpjEnrichQueue | null = null;
  private listFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private poolFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private listWriteChain: Promise<void> = Promise.resolve();
  private poolWriteChain: Promise<void> = Promise.resolve();

  private loadListStoreFromDisk(): Store {
    const filePath = resolveDataFile(FILE_NAME);
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (!existsSync(filePath)) return emptyStore();
    try {
      const raw = readFileSync(filePath, "utf8");
      if (!String(raw || "").trim()) return emptyStore();
      const parsed = JSON.parse(raw) as Store;
      if (parsed?.version !== 1 || !Array.isArray(parsed.lists)) return emptyStore();
      return parsed;
    } catch {
      return emptyStore();
    }
  }

  private loadPoolStoreFromDisk(): PoolStore {
    const filePath = resolveDataFile(POOL_FILE_NAME);
    if (!existsSync(filePath)) return emptyPoolStore();
    try {
      const raw = readFileSync(filePath, "utf8");
      if (!String(raw || "").trim()) return emptyPoolStore();
      const parsed = JSON.parse(raw) as PoolStore;
      if (parsed?.version !== 1 || !Array.isArray(parsed.pools)) return emptyPoolStore();
      return parsed;
    } catch {
      return emptyPoolStore();
    }
  }

  private getListStore(): Store {
    if (!this.listCache) this.listCache = this.loadListStoreFromDisk();
    return this.listCache;
  }

  private getPoolStore(): PoolStore {
    if (!this.poolCache) this.poolCache = this.loadPoolStoreFromDisk();
    return this.poolCache;
  }

  private enqueueListFlush() {
    const snapshot = this.listCache;
    if (!snapshot) return;
    // Clona referência superficial do store; stringify assíncrono libera o event loop entre jobs.
    this.listWriteChain = this.listWriteChain
      .then(() => atomicWriteJson(resolveDataFile(FILE_NAME), snapshot))
      .catch(() => undefined);
  }

  private enqueuePoolFlush() {
    const snapshot = this.poolCache;
    if (!snapshot) return;
    this.poolWriteChain = this.poolWriteChain
      .then(() => atomicWriteJson(resolveDataFile(POOL_FILE_NAME), snapshot))
      .catch(() => undefined);
  }

  private scheduleListPersist(mode: LeadsCnpjPersistMode = "debounce") {
    if (mode === "flush") {
      if (this.listFlushTimer) {
        clearTimeout(this.listFlushTimer);
        this.listFlushTimer = null;
      }
      // Escrita síncrona no flush crítico (finalize/boot) evita ler JSON antigo em outro processo.
      try {
        if (this.listCache) {
          writeFileSync(resolveDataFile(FILE_NAME), JSON.stringify(this.listCache), "utf8");
        }
      } catch {
        this.enqueueListFlush();
      }
      return;
    }
    if (this.listFlushTimer) return;
    this.listFlushTimer = setTimeout(() => {
      this.listFlushTimer = null;
      this.enqueueListFlush();
    }, DEBOUNCE_MS);
  }

  private schedulePoolPersist(mode: LeadsCnpjPersistMode = "debounce") {
    if (mode === "flush") {
      if (this.poolFlushTimer) {
        clearTimeout(this.poolFlushTimer);
        this.poolFlushTimer = null;
      }
      this.enqueuePoolFlush();
      return;
    }
    if (this.poolFlushTimer) return;
    this.poolFlushTimer = setTimeout(() => {
      this.poolFlushTimer = null;
      this.enqueuePoolFlush();
    }, DEBOUNCE_MS);
  }

  ensureExportsDir(): string {
    const dir = resolveLeadsCnpjExportsDir();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  }

  list(): WabaLeadsCnpjList[] {
    return this.getListStore()
      .lists.slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getById(id: string): WabaLeadsCnpjList | null {
    const normalized = String(id || "").trim();
    if (!normalized) return null;
    return this.getListStore().lists.find((item) => item.id === normalized) ?? null;
  }

  /**
   * CNPJs já usados na campanha (anti-duplicidade entre dias da MESMA extração).
   * Sem campaignKey: legado (todas as listas) — preferir sempre passar a chave.
   */
  collectUsedCnpjs(campaignKey?: string): Set<string> {
    const used = new Set<string>();
    const key = String(campaignKey || "").trim();
    for (const list of this.getListStore().lists) {
      if (key && String(list.campaignKey || "").trim() !== key) continue;
      for (const lead of list.leads || []) {
        const cnpj = normalizeCnpjDigits(lead.cnpj);
        if (cnpj.length === 14) used.add(cnpj);
      }
    }
    return used;
  }

  findListByCampaignDay(campaignKey: string, dayKey: string): WabaLeadsCnpjList | null {
    const key = String(campaignKey || "").trim();
    const day = String(dayKey || "").trim();
    if (!key || !day) return null;
    return (
      this.getListStore().lists.find(
        (item) => item.campaignKey === key && item.dayKey === day,
      ) ?? null
    );
  }

  create(list: WabaLeadsCnpjList): WabaLeadsCnpjList {
    const store = this.getListStore();
    if (store.lists.some((item) => item.id === list.id)) throw new Error("Lista já existe.");
    store.lists.unshift(list);
    this.scheduleListPersist("flush");
    return list;
  }

  /**
   * Atualiza lista em memória.
   * `persist: "debounce"` (default em progresso) evita regravar multi-MB a cada 1s.
   * `persist: "flush"` para checkpoint de leads / status crítico.
   */
  update(
    list: WabaLeadsCnpjList,
    options?: { persist?: LeadsCnpjPersistMode },
  ): WabaLeadsCnpjList {
    const store = this.getListStore();
    const index = store.lists.findIndex((item) => item.id === list.id);
    if (index < 0) throw new Error("Lista não encontrada.");
    store.lists[index] = list;
    this.scheduleListPersist(options?.persist || "debounce");
    return list;
  }

  getPool(key: string): WabaLeadsCnpjPool | null {
    const normalized = String(key || "").trim();
    if (!normalized) return null;
    return this.getPoolStore().pools.find((p) => p.key === normalized) ?? null;
  }

  listPools(): WabaLeadsCnpjPool[] {
    return this.getPoolStore().pools.slice();
  }

  /**
   * Mescla novos itens no pool (sem CNPJs já usados em listas) e devolve o pool atualizado.
   */
  mergePool(input: {
    key: string;
    name: string;
    source: WabaLeadsCnpjPool["source"];
    filters: WabaLeadsCnpjPool["filters"];
    items: WabaLeadsCnpjPoolItem[];
    usedCnpjs: Set<string>;
    persist?: LeadsCnpjPersistMode;
  }): WabaLeadsCnpjPool {
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
    const pendingMap = new Map<string, WabaLeadsCnpjPoolItem>();
    for (const item of pool.pending) {
      const cnpj = normalizeCnpjDigits(item.cnpj);
      if (cnpj.length !== 14 || input.usedCnpjs.has(cnpj)) continue;
      pendingMap.set(cnpj, { cnpj, nome: String(item.nome || "").trim() });
    }
    for (const item of input.items) {
      const cnpj = normalizeCnpjDigits(item.cnpj);
      if (cnpj.length !== 14 || input.usedCnpjs.has(cnpj)) continue;
      if (pendingMap.has(cnpj)) continue;
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
  takeFromPool(key: string, limit: number): WabaLeadsCnpjPoolItem[] {
    const store = this.getPoolStore();
    const pool = store.pools.find((p) => p.key === key);
    if (!pool || !pool.pending.length || limit <= 0) return [];
    const taken = pool.pending.slice(0, limit);
    pool.pending = pool.pending.slice(limit);
    pool.updatedAt = new Date().toISOString();
    this.schedulePoolPersist("flush");
    return taken;
  }

  saveExportFile(listId: string, buffer: Buffer, safeBaseName: string, dayKey?: string): string {
    const dir = this.ensureExportsDir();
    const day = String(dayKey || "").trim();
    const prefix = day ? `${day}-` : `${listId.slice(0, 8)}-`;
    const fileName = `${prefix}${safeBaseName}.xlsx`;
    writeFileSync(path.join(dir, fileName), buffer);
    return fileName;
  }

  resolveExportPath(fileName: string): string | null {
    const safe = path.basename(String(fileName || "").trim());
    if (!safe || safe !== fileName) return null;
    const filePath = path.join(resolveLeadsCnpjExportsDir(), safe);
    return existsSync(filePath) ? filePath : null;
  }

  /** Remove a lista do histórico e o Excel exportado (se existir). */
  delete(id: string): WabaLeadsCnpjList | null {
    const normalized = String(id || "").trim();
    if (!normalized) return null;
    const store = this.getListStore();
    const index = store.lists.findIndex((item) => item.id === normalized);
    if (index < 0) return null;
    const [removed] = store.lists.splice(index, 1);
    this.scheduleListPersist("flush");
    if (removed?.exportFileName) {
      this.unlinkExport(removed.exportFileName);
    }
    return removed ?? null;
  }

  /** Remove todas as listas de uma campanha (histórico + Excels). */
  deleteByCampaignKey(campaignKey: string): WabaLeadsCnpjList[] {
    const key = String(campaignKey || "").trim();
    if (!key) return [];
    const store = this.getListStore();
    const removed: WabaLeadsCnpjList[] = [];
    const kept: WabaLeadsCnpjList[] = [];
    for (const item of store.lists) {
      const itemKey = String(item.campaignKey || "").trim();
      if (itemKey === key) {
        removed.push(item);
        if (item.exportFileName) this.unlinkExport(item.exportFileName);
      } else {
        kept.push(item);
      }
    }
    if (!removed.length) return [];
    store.lists = kept;
    this.scheduleListPersist("flush");
    return removed;
  }

  /** Apaga o pool da campanha por completo (pendentes + metadados). */
  deletePool(key: string): boolean {
    const normalized = String(key || "").trim();
    if (!normalized) return false;
    const store = this.getPoolStore();
    const before = store.pools.length;
    store.pools = store.pools.filter((p) => p.key !== normalized);
    if (store.pools.length === before) return false;
    this.schedulePoolPersist("flush");
    return true;
  }

  setPoolAutoContinuePaused(key: string, paused: boolean): void {
    const normalized = String(key || "").trim();
    if (!normalized) return;
    const store = this.getPoolStore();
    const pool = store.pools.find((p) => p.key === normalized);
    if (!pool) return;
    pool.autoContinuePaused = Boolean(paused);
    pool.updatedAt = new Date().toISOString();
    this.schedulePoolPersist("flush");
  }

  getEnrichQueue(): WabaLeadsCnpjEnrichQueue {
    if (!this.enrichQueueCache) {
      const filePath = resolveDataFile(ENRICH_QUEUE_FILE_NAME);
      if (!existsSync(filePath)) {
        this.enrichQueueCache = emptyEnrichQueue();
      } else {
        try {
          const parsed = JSON.parse(readFileSync(filePath, "utf8")) as WabaLeadsCnpjEnrichQueue;
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
        } catch {
          this.enrichQueueCache = emptyEnrichQueue();
        }
      }
    }
    return this.enrichQueueCache;
  }

  saveEnrichQueue(next: WabaLeadsCnpjEnrichQueue): void {
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
    const filePath = resolveDataFile(ENRICH_QUEUE_FILE_NAME);
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, JSON.stringify(this.enrichQueueCache), "utf8");
  }

  nextListaIndex(campaignKey: string): number {
    const key = String(campaignKey || "").trim();
    const ready = this.getListStore().lists.filter(
      (l) =>
        String(l.campaignKey || "").trim() === key &&
        l.status === "ready" &&
        Boolean(l.exportFileName),
    );
    let max = 0;
    for (const item of ready) {
      const n = Math.round(Number(item.listaIndex || 0) || 0);
      if (n > max) max = n;
    }
    return max + 1;
  }

  private unlinkExport(fileName: string) {
    const filePath = this.resolveExportPath(fileName);
    if (!filePath) return;
    try {
      unlinkSync(filePath);
    } catch {
      /* ignore */
    }
  }

  newId(): string {
    return randomUUID();
  }
}

export const normalizeCnpjDigits = (value: unknown): string =>
  String(value ?? "").replace(/\D/g, "").slice(0, 14);

export const emptyLeadFromCnpj = (cnpj: string): WabaLeadsCnpjLead => ({
  cnpj: normalizeCnpjDigits(cnpj),
  nome: "",
  telefone: "",
  email: "",
  situacao: "",
  dataAbertura: "",
  cidade: "",
  estado: "",
  endereco: "",
});
