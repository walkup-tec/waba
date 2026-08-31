import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataFile } from "../data-path";
import type { WabaSubscriberSegment } from "./waba-subscriber-segment";

export type WabaSubscriber = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  whatsapp: string;
  phone: string;
  cpfCnpj: string;
  /** Segmento comercial: Bets (bet.waba.info) ou Outros (wabadisparos / demais). */
  segment?: WabaSubscriberSegment;
  /** Liberado pelo master sem exigir compra de envios (parceiros). */
  aquecedorGranted?: boolean;
  createdAt: string;
  updatedAt: string;
};

type Store = {
  version: 1;
  subscribers: WabaSubscriber[];
};

const FILE_NAME = "waba-subscribers.json";

const emptyStore = (): Store => ({ version: 1, subscribers: [] });

export class WabaSubscriberRepository {
  private readStore(): Store {
    const filePath = resolveDataFile(FILE_NAME);
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (!existsSync(filePath)) return emptyStore();
    try {
      const raw = readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as Store;
      if (parsed?.version !== 1 || !Array.isArray(parsed.subscribers)) return emptyStore();
      return parsed;
    } catch {
      return emptyStore();
    }
  }

  private writeStore(store: Store) {
    const filePath = resolveDataFile(FILE_NAME);
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const tmp = `${filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
    renameSync(tmp, filePath);
  }

  list(): WabaSubscriber[] {
    return this.readStore().subscribers;
  }

  getByEmail(email: string): WabaSubscriber | null {
    const normalized = email.trim().toLowerCase();
    return this.list().find((item) => item.email === normalized) ?? null;
  }

  getById(id: string): WabaSubscriber | null {
    return this.list().find((item) => item.id === id) ?? null;
  }

  create(subscriber: WabaSubscriber): WabaSubscriber {
    const store = this.readStore();
    if (store.subscribers.some((item) => item.email === subscriber.email)) {
      throw new Error("Já existe uma conta com este e-mail.");
    }
    store.subscribers.push(subscriber);
    this.writeStore(store);
    return subscriber;
  }

  update(id: string, patch: Partial<Omit<WabaSubscriber, "id" | "createdAt">>): WabaSubscriber {
    const normalizedId = String(id ?? "").trim();
    if (!normalizedId) throw new Error("Assinante inválido.");
    const store = this.readStore();
    const index = store.subscribers.findIndex((item) => item.id === normalizedId);
    if (index < 0) throw new Error("Assinante não encontrado.");

    const current = store.subscribers[index];
    const nextEmail = String(patch.email ?? current.email)
      .trim()
      .toLowerCase();
    if (
      nextEmail !== current.email &&
      store.subscribers.some((item) => item.email === nextEmail && item.id !== normalizedId)
    ) {
      throw new Error("Já existe uma conta com este e-mail.");
    }

    const updated: WabaSubscriber = {
      ...current,
      ...patch,
      id: current.id,
      email: nextEmail,
      createdAt: current.createdAt,
      updatedAt: String(patch.updatedAt ?? new Date().toISOString()),
    };
    store.subscribers[index] = updated;
    this.writeStore(store);
    return updated;
  }
}
