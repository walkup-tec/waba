import { readFileSync } from "node:fs";
import { AlternativaNumberActivationRepository } from "../billing/alternativa-number-activation.repository";
import type { WabaRequestAuth } from "../auth/waba-request-auth";
import { resolveDataFile } from "../data-path";
import { WabaSystemUserRepository } from "../users/waba-system-user.repository";
import { wabaInstanceOwnershipService } from "./waba-instance-ownership.service";

export type InstanceUsageSnapshot = {
  useAquecedor: boolean;
  useDisparador: boolean;
  useFazenda: boolean;
  updatedAt: string;
};

export type FazendaPoolItem = {
  instanceName: string;
  label: string;
  number?: string;
  connectionStatus: string;
  isOpen: boolean;
  assignedToEmail: string | null;
};

type FazendaPoolDeps = {
  loadInstanceUsageMap: () => Promise<Map<string, InstanceUsageSnapshot>>;
};

let fazendaPoolDeps: FazendaPoolDeps | null = null;

export function configureWabaFazendaPool(deps: FazendaPoolDeps): void {
  fazendaPoolDeps = deps;
}

const normalizeEmail = (value: string): string => String(value ?? "").trim().toLowerCase();

const normalizeInstanceName = (value: string): string => String(value ?? "").trim();

function listMasterOwnerEmails(): string[] {
  const emails = new Set<string>();
  const adminEmail = normalizeEmail(String(process.env.WABA_ADMIN_EMAIL ?? ""));
  if (adminEmail.includes("@")) emails.add(adminEmail);
  const repo = new WabaSystemUserRepository();
  for (const user of repo.list()) {
    if (user.role === "master" && user.email.includes("@")) {
      emails.add(normalizeEmail(user.email));
    }
  }
  return Array.from(emails);
}

function readEvoCacheItems(): Array<Record<string, unknown>> {
  try {
    const raw = readFileSync(resolveDataFile("evo-instances-cache.json"), "utf-8");
    const parsed = JSON.parse(raw) as { items?: Array<Record<string, unknown>> };
    return Array.isArray(parsed?.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

function resolveUsage(
  usageMap: Map<string, InstanceUsageSnapshot>,
  instanceName: string,
): InstanceUsageSnapshot | undefined {
  const key = normalizeInstanceName(instanceName);
  if (!key) return undefined;
  const direct = usageMap.get(key);
  if (direct) return direct;
  const target = key.toLowerCase();
  for (const [mapKey, value] of usageMap.entries()) {
    if (mapKey.toLowerCase() === target) return value;
  }
  return undefined;
}

function resolveCacheRow(
  cacheItems: Array<Record<string, unknown>>,
  instanceName: string,
): Record<string, unknown> | null {
  const target = normalizeInstanceName(instanceName).toLowerCase();
  if (!target) return null;
  return (
    cacheItems.find((row) => String(row?.name || "").trim().toLowerCase() === target) ?? null
  );
}

export class WabaFazendaPoolService {
  constructor(
    private readonly activationRepository = new AlternativaNumberActivationRepository(),
    private readonly ownershipService = wabaInstanceOwnershipService,
  ) {}

  private requireDeps(): FazendaPoolDeps {
    if (!fazendaPoolDeps) {
      throw new Error("Pool da fazenda n├úo configurado no servidor.");
    }
    return fazendaPoolDeps;
  }

  async listMasterFazendaInstanceNames(): Promise<string[]> {
    const deps = this.requireDeps();
    const usageMap = await deps.loadInstanceUsageMap();
    const fazendaMarked: string[] = [];
    for (const [instanceName, usage] of usageMap.entries()) {
      if (usage?.useFazenda === true) {
        fazendaMarked.push(normalizeInstanceName(instanceName));
      }
    }
    const uniqueMarked = Array.from(
      new Set(fazendaMarked.map((name) => name.toLowerCase()).filter(Boolean)),
    )
      .map((key) => fazendaMarked.find((name) => name.toLowerCase() === key) || key)
      .filter(Boolean);
    if (uniqueMarked.length > 0) {
      return uniqueMarked.sort((a, b) => a.localeCompare(b, "pt-BR"));
    }
    const masterEmails = listMasterOwnerEmails();
    const owned = await this.ownershipService.listInstancesOwnedByEmails(masterEmails);
    return owned.filter((instanceName) => resolveUsage(usageMap, instanceName)?.useFazenda === true);
  }

  async isMasterFazendaInstance(instanceName: string): Promise<boolean> {
    const names = await this.listMasterFazendaInstanceNames();
    const target = normalizeInstanceName(instanceName).toLowerCase();
    return names.some((name) => name.toLowerCase() === target);
  }

  async buildPoolForSubscriber(subscriberEmail: string): Promise<{
    items: FazendaPoolItem[];
    availableToClaim: FazendaPoolItem[];
    assignedToSubscriber: FazendaPoolItem[];
  }> {
    const email = normalizeEmail(subscriberEmail);
    const fazendaNames = await this.listMasterFazendaInstanceNames();
    const cacheItems = readEvoCacheItems();
    const items: FazendaPoolItem[] = fazendaNames.map((instanceName) => {
      const cached = resolveCacheRow(cacheItems, instanceName);
      const connectionStatus = String(cached?.connectionStatus || "unknown");
      const label =
        String(cached?.displayName || cached?.instanceAlias || instanceName).trim() || instanceName;
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
    const availableToClaim = items.filter(
      (row) => !row.assignedToEmail && row.isOpen,
    );

    return { items, availableToClaim, assignedToSubscriber };
  }

  async assertCanAssignToSubscriber(subscriberEmail: string, instanceName: string): Promise<void> {
    const email = normalizeEmail(subscriberEmail);
    const name = normalizeInstanceName(instanceName);
    if (!email.includes("@") || !name) {
      throw new Error("Sess├úo ou inst├óncia inv├ílida.");
    }
    const isFazenda = await this.isMasterFazendaInstance(name);
    if (!isFazenda) {
      throw new Error("Este n├║mero n├úo est├í dispon├¡vel na fazenda master.");
    }
    const assignedTo = this.activationRepository.findSubscriberEmailForInstance(name);
    if (assignedTo && assignedTo !== email) {
      throw new Error("Este n├║mero da fazenda j├í est├í vinculado a outro assinante.");
    }
  }

  async filterDisparadorInstancesForAuth(
    auth: WabaRequestAuth,
    names: string[],
  ): Promise<string[]> {
    const owned = await this.ownershipService.filterStringListForAuth(auth, names);
    const ownedLower = new Set(owned.map((name) => name.toLowerCase()));
    const email = normalizeEmail(auth.email);
    const activations = email.includes("@")
      ? this.activationRepository.listForEmail(email)
      : [];
    const activationLower = new Set(
      activations.map((row) => row.instanceName.toLowerCase()),
    );
    return names.filter((name) => {
      const key = normalizeInstanceName(name).toLowerCase();
      if (!key) return false;
      return ownedLower.has(key) || activationLower.has(key);
    });
  }
}

export const wabaFazendaPoolService = new WabaFazendaPoolService();
