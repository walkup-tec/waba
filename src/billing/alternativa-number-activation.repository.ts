import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { resolveDataFile } from "../data-path";

export type AlternativaNumberActivationStatus = "active" | "blocked";
export type AlternativaReplacementScope = "campaign" | "standby";

export type AlternativaNumberActivation = {
  instanceName: string;
  orderId: string;
  activatedAt: string;
  status?: AlternativaNumberActivationStatus;
  blockedAt?: string | null;
  replacedByInstanceName?: string | null;
  replacesInstanceName?: string | null;
  replacementScope?: AlternativaReplacementScope | null;
};

type Store = {
  byEmail: Record<string, { activations: AlternativaNumberActivation[] }>;
};

const FILE = resolveDataFile("alternativa-number-activations.json");

const normalizeEmail = (email: string): string => String(email ?? "").trim().toLowerCase();

const normalizeName = (name: string): string => String(name ?? "").trim();

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

const activationStatus = (row: AlternativaNumberActivation): AlternativaNumberActivationStatus =>
  row.status === "blocked" ? "blocked" : "active";

export class AlternativaNumberActivationRepository {
  listForEmail(email: string): AlternativaNumberActivation[] {
    const key = normalizeEmail(email);
    if (!key) return [];
    return (loadStore().byEmail[key]?.activations ?? []).map((row) => ({
      ...row,
      status: activationStatus(row),
    }));
  }

  listActiveForEmail(email: string): AlternativaNumberActivation[] {
    return this.listForEmail(email).filter((row) => activationStatus(row) === "active");
  }

  countForEmail(email: string): number {
    return this.listActiveForEmail(email).length;
  }

  hasInstance(email: string, instanceName: string): boolean {
    const name = normalizeName(instanceName).toLowerCase();
    if (!name) return false;
    return this.listForEmail(email).some((row) => row.instanceName.toLowerCase() === name);
  }

  register(
    email: string,
    instanceName: string,
    orderId: string,
    options?: {
      replacesInstanceName?: string | null;
      replacementScope?: AlternativaReplacementScope | null;
    }
  ): AlternativaNumberActivation {
    const key = normalizeEmail(email);
    const name = normalizeName(instanceName);
    const order = String(orderId ?? "").trim();
    if (!key || !name) {
      throw new Error("E-mail e nome da instância são obrigatórios.");
    }
    const store = loadStore();
    const bucket = store.byEmail[key] ?? { activations: [] };
    const existing = bucket.activations.find((row) => row.instanceName.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (options?.replacesInstanceName) {
        existing.replacesInstanceName = normalizeName(options.replacesInstanceName);
        existing.status = "active";
      }
      if (options?.replacementScope) {
        existing.replacementScope = options.replacementScope;
      }
      store.byEmail[key] = bucket;
      saveStore(store);
      return { ...existing, status: activationStatus(existing) };
    }
    const activation: AlternativaNumberActivation = {
      instanceName: name,
      orderId: order || "manual",
      activatedAt: new Date().toISOString(),
      status: "active",
      blockedAt: null,
      replacedByInstanceName: null,
      replacesInstanceName: options?.replacesInstanceName
        ? normalizeName(options.replacesInstanceName)
        : null,
      replacementScope: options?.replacementScope ?? null,
    };
    bucket.activations.push(activation);
    store.byEmail[key] = bucket;
    saveStore(store);
    return activation;
  }

  markBlocked(email: string, instanceName: string, replacedByInstanceName: string): AlternativaNumberActivation | null {
    const key = normalizeEmail(email);
    const name = normalizeName(instanceName);
    const replacedBy = normalizeName(replacedByInstanceName);
    if (!key || !name) return null;
    const store = loadStore();
    const bucket = store.byEmail[key];
    if (!bucket) return null;
    const row = bucket.activations.find((item) => item.instanceName.toLowerCase() === name.toLowerCase());
    if (!row) return null;
    row.status = "blocked";
    row.blockedAt = new Date().toISOString();
    row.replacedByInstanceName = replacedBy || null;
    store.byEmail[key] = bucket;
    saveStore(store);
    return { ...row, status: "blocked" };
  }

  listSubscriberEmails(): string[] {
    return Object.keys(loadStore().byEmail).filter((email) => email.includes("@"));
  }

  findSubscriberEmailForInstance(instanceName: string): string | null {
    const target = normalizeName(instanceName).toLowerCase();
    if (!target) return null;
    const store = loadStore();
    for (const [email, bucket] of Object.entries(store.byEmail)) {
      if (
        bucket.activations.some(
          (row) =>
            row.instanceName.toLowerCase() === target && activationStatus(row) === "active"
        )
      ) {
        return email;
      }
    }
    return null;
  }
}
