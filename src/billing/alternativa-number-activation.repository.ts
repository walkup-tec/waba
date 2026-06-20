import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { resolveDataFile } from "../data-path";

export type AlternativaNumberActivation = {
  instanceName: string;
  orderId: string;
  activatedAt: string;
};

type Store = {
  byEmail: Record<string, { activations: AlternativaNumberActivation[] }>;
};

const FILE = resolveDataFile("alternativa-number-activations.json");

const normalizeEmail = (email: string): string => String(email ?? "").trim().toLowerCase();

const ensureStorage = () => {
  const folder = dirname(FILE);
  if (!existsSync(folder)) mkdirSync(folder, { recursive: true });
  if (!existsSync(FILE)) writeFileSync(FILE, JSON.stringify({ byEmail: {} }, null, 2), "utf-8");
};

const loadStore = (): Store => {
  ensureStorage();
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf-8")) as Store;
    return parsed?.byEmail ? parsed : { byEmail: {} };
  } catch {
    return { byEmail: {} };
  }
};

const saveStore = (store: Store) => {
  ensureStorage();
  writeFileSync(FILE, JSON.stringify(store, null, 2), "utf-8");
};

export class AlternativaNumberActivationRepository {
  listForEmail(email: string): AlternativaNumberActivation[] {
    const key = normalizeEmail(email);
    if (!key) return [];
    return loadStore().byEmail[key]?.activations ?? [];
  }

  countForEmail(email: string): number {
    return this.listForEmail(email).length;
  }

  hasInstance(email: string, instanceName: string): boolean {
    const name = String(instanceName ?? "").trim().toLowerCase();
    if (!name) return false;
    return this.listForEmail(email).some((row) => row.instanceName.toLowerCase() === name);
  }

  register(email: string, instanceName: string, orderId: string): AlternativaNumberActivation {
    const key = normalizeEmail(email);
    const name = String(instanceName ?? "").trim();
    const order = String(orderId ?? "").trim();
    if (!key || !name) {
      throw new Error("E-mail e nome da instância são obrigatórios.");
    }
    const store = loadStore();
    const bucket = store.byEmail[key] ?? { activations: [] };
    if (bucket.activations.some((row) => row.instanceName.toLowerCase() === name.toLowerCase())) {
      return bucket.activations.find((row) => row.instanceName.toLowerCase() === name.toLowerCase())!;
    }
    const activation: AlternativaNumberActivation = {
      instanceName: name,
      orderId: order || "manual",
      activatedAt: new Date().toISOString(),
    };
    bucket.activations.push(activation);
    store.byEmail[key] = bucket;
    saveStore(store);
    return activation;
  }
}
