import { promises as fs } from "fs";
import path from "path";
import { isWabaAuthConfigured, isWabaMasterEmail } from "../auth/waba-auth.service";
import type { WabaRequestAuth } from "../auth/waba-request-auth";import { resolveDataFile } from "../data-path";

export type InstanceOwnerRecord = {
  ownerEmail: string;
  createdAt: string;
};

type InstanceOwnersStore = {
  instances: Record<string, InstanceOwnerRecord>;
};

const OWNERS_FILE = resolveDataFile("instance-owners.json");

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const normalizeInstanceName = (value: string): string => String(value || "").trim();

export class WabaInstanceOwnershipService {
  private cache: InstanceOwnersStore | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  private runLocked<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.writeChain.then(fn, fn);
    this.writeChain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  private async loadStore(): Promise<InstanceOwnersStore> {
    if (this.cache) return this.cache;
    try {
      const raw = await fs.readFile(OWNERS_FILE, "utf-8");
      const parsed = JSON.parse(raw || "{}") as Partial<InstanceOwnersStore>;
      const instances =
        parsed?.instances && typeof parsed.instances === "object" ? parsed.instances : {};
      this.cache = { instances };
      return this.cache;
    } catch {
      this.cache = { instances: {} };
      return this.cache;
    }
  }

  private async saveStore(store: InstanceOwnersStore): Promise<void> {
    this.cache = store;
    await fs.mkdir(path.dirname(OWNERS_FILE), { recursive: true });
    await fs.writeFile(OWNERS_FILE, JSON.stringify(store, null, 2), "utf-8");
  }

  private findStoreKey(store: InstanceOwnersStore, instanceName: string): string | null {
    const target = normalizeInstanceName(instanceName).toLowerCase();
    if (!target) return null;
    for (const key of Object.keys(store.instances)) {
      if (key.toLowerCase() === target) return key;
    }
    return null;
  }

  /** Sem login configurado (dev local): não filtra. Com auth: estrito por dono. */
  private bypassOwnershipFilter(auth: WabaRequestAuth): boolean {
    return !isWabaAuthConfigured();
  }

  async getOwnerEmail(instanceName: string): Promise<string | null> {
    const store = await this.loadStore();
    const key = this.findStoreKey(store, instanceName);
    if (!key) return null;
    const owner = normalizeEmail(store.instances[key]?.ownerEmail || "");
    return owner.includes("@") ? owner : null;
  }

  async assignOwner(instanceName: string, ownerEmail: string): Promise<void> {
    const name = normalizeInstanceName(instanceName);
    const email = normalizeEmail(ownerEmail);
    if (!name || !email.includes("@")) return;

    await this.runLocked(async () => {
      const store = await this.loadStore();
      const existingKey = this.findStoreKey(store, name);
      if (existingKey) {
        store.instances[existingKey] = {
          ownerEmail: email,
          createdAt: store.instances[existingKey]?.createdAt || new Date().toISOString(),
        };
      } else {
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
  async claimOnRegister(
    instanceName: string,
    ownerEmail: string
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const name = normalizeInstanceName(instanceName);
    const email = normalizeEmail(ownerEmail);
    if (!name) return { ok: false, error: "Nome da instância inválido." };
    if (!email.includes("@")) return { ok: false, error: "Sessão inválida para registrar instância." };

    return this.runLocked(async () => {
      const store = await this.loadStore();
      const existingKey = this.findStoreKey(store, name);
      if (existingKey) {
        const currentOwner = normalizeEmail(store.instances[existingKey]?.ownerEmail || "");
        if (currentOwner && currentOwner !== email) {
          return {
            ok: false as const,
            error: "Esta instância já está vinculada a outro usuário.",
          };
        }
        store.instances[existingKey] = {
          ownerEmail: email,
          createdAt: store.instances[existingKey]?.createdAt || new Date().toISOString(),
        };
      } else {
        store.instances[name] = {
          ownerEmail: email,
          createdAt: new Date().toISOString(),
        };
      }
      await this.saveStore(store);
      return { ok: true as const };
    });
  }

  async renameInstance(oldName: string, newName: string): Promise<void> {
    const from = normalizeInstanceName(oldName);
    const to = normalizeInstanceName(newName);
    if (!from || !to || from.toLowerCase() === to.toLowerCase()) return;

    await this.runLocked(async () => {
      const store = await this.loadStore();
      const key = this.findStoreKey(store, from);
      if (!key) return;
      const record = store.instances[key];
      delete store.instances[key];
      const destKey = this.findStoreKey(store, to);
      if (destKey) {
        store.instances[destKey] = record;
      } else {
        store.instances[to] = record;
      }
      await this.saveStore(store);
    });
  }

  async removeOwner(instanceName: string): Promise<void> {
    const name = normalizeInstanceName(instanceName);
    if (!name) return;

    await this.runLocked(async () => {
      const store = await this.loadStore();
      const key = this.findStoreKey(store, name);
      if (!key) return;
      delete store.instances[key];
      await this.saveStore(store);
    });
  }

  async canAccessInstance(auth: WabaRequestAuth, instanceName: string): Promise<boolean> {
    if (this.bypassOwnershipFilter(auth)) return true;

    const email = normalizeEmail(auth.email);
    if (!email.includes("@")) return false;

    const owner = await this.getOwnerEmail(instanceName);
    if (!owner) return false;
    return owner === email;
  }

  async filterItemsForAuth<T>(
    auth: WabaRequestAuth,
    items: T[],
    readName: (item: T) => string
  ): Promise<T[]> {
    if (this.bypassOwnershipFilter(auth)) return items;

    const email = normalizeEmail(auth.email);
    if (!email.includes("@")) return [];

    const store = await this.loadStore();
    return items.filter((item) => {
      const name = normalizeInstanceName(readName(item));
      if (!name) return false;
      const key = this.findStoreKey(store, name);
      if (!key) return false;
      const owner = normalizeEmail(store.instances[key]?.ownerEmail || "");
      return owner === email;
    });
  }

  async filterInstanceNamesForAuth(
    auth: WabaRequestAuth,
    names: string[]
  ): Promise<Set<string>> {
    if (this.bypassOwnershipFilter(auth)) {
      return new Set(names.map((n) => normalizeInstanceName(n)).filter(Boolean));
    }

    const email = normalizeEmail(auth.email);
    const store = await this.loadStore();
    const allowed = new Set<string>();
    for (const name of names) {
      const normalized = normalizeInstanceName(name);
      if (!normalized) continue;
      const key = this.findStoreKey(store, normalized);
      if (!key) continue;
      const owner = normalizeEmail(store.instances[key]?.ownerEmail || "");
      if (owner === email) allowed.add(normalized);
    }
    return allowed;
  }

  async listOwnedInstanceNames(ownerEmail: string): Promise<string[]> {
    const email = normalizeEmail(ownerEmail);
    if (!email.includes("@")) return [];
    const store = await this.loadStore();
    const names: string[] = [];
    for (const [instanceName, record] of Object.entries(store.instances)) {
      if (normalizeEmail(record?.ownerEmail || "") === email) {
        names.push(instanceName);
      }
    }
    return names.sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  async filterStringListForAuth(auth: WabaRequestAuth, names: string[]): Promise<string[]> {
    const allowed = await this.filterInstanceNamesForAuth(auth, names);
    const allowedLower = new Set(Array.from(allowed).map((n) => n.toLowerCase()));
    return names.filter((name) => allowedLower.has(normalizeInstanceName(name).toLowerCase()));
  }

  /**
   * Instâncias legadas na Evolution sem dono em instance-owners.json ficam invisíveis.
   * O master reconcilia órfãs para o próprio e-mail na primeira listagem.
   */
  async reconcileOrphanInstancesForMaster(
    auth: WabaRequestAuth,
    instanceNames: string[],
  ): Promise<number> {
    if (!isWabaAuthConfigured()) return 0;

    const email = normalizeEmail(auth.email);
    if (!email.includes("@")) return 0;
    const isMaster = auth.role === "master" || isWabaMasterEmail(email);
    if (!isMaster) return 0;

    let assigned = 0;
    await this.runLocked(async () => {
      const store = await this.loadStore();
      let changed = false;
      for (const rawName of instanceNames) {
        const name = normalizeInstanceName(rawName);
        if (!name) continue;
        const existingKey = this.findStoreKey(store, name);
        if (existingKey) continue;
        store.instances[name] = {
          ownerEmail: email,
          createdAt: new Date().toISOString(),
        };
        assigned += 1;
        changed = true;
      }
      if (changed) await this.saveStore(store);
    });
    return assigned;
  }
}

export const wabaInstanceOwnershipService = new WabaInstanceOwnershipService();
