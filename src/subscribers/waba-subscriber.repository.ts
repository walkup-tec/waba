import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataFile } from "../data-path";

export type WabaSubscriber = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  whatsapp: string;
  phone: string;
  cpfCnpj: string;
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
    writeFileSync(filePath, readFileSync(tmp));
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
}
