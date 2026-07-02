import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataDir, resolveDataFile } from "../data-path";

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

export type AdminSubscriberPurgeSummary = {
  email: string;
  subscriberRemoved: boolean;
  billingOrdersRemoved: number;
  creditUsageRemoved: boolean;
  bonusBalanceRemoved: boolean;
  campaignIntakesRemoved: number;
  campaignIntakeDirsRemoved: number;
  alternativaActivationsRemoved: boolean;
  instanceOwnersRemoved: number;
  supportTicketsRemoved: number;
  splitSettlementsRemoved: number;
};

const readJson = <T>(filePath: string, fallback: T): T => {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
};

const writeJson = (filePath: string, data: unknown) => {
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  writeFileSync(filePath, readFileSync(tmp));
};

const removeDirRecursive = (dir: string) => {
  if (!existsSync(dir)) return;
  rmSync(dir, { recursive: true, force: true });
};

export class WabaAdminSubscriberPurgeService {
  purgeByEmail(rawEmail: string): AdminSubscriberPurgeSummary {
    const email = normalizeEmail(rawEmail);
    if (!email.includes("@")) throw new Error("Informe um e-mail válido.");

    const dataDir = resolveDataDir();
    const summary: AdminSubscriberPurgeSummary = {
      email,
      subscriberRemoved: false,
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

    const subscribersPath = resolveDataFile("waba-subscribers.json");
    const subscribersStore = readJson(subscribersPath, { version: 1, subscribers: [] as Array<{ email?: string }> });
    if (!Array.isArray(subscribersStore.subscribers)) subscribersStore.subscribers = [];
    const beforeSubs = subscribersStore.subscribers.length;
    subscribersStore.subscribers = subscribersStore.subscribers.filter(
      (row) => normalizeEmail(String(row?.email ?? "")) !== email,
    );
    summary.subscriberRemoved = subscribersStore.subscribers.length < beforeSubs;
    if (!summary.subscriberRemoved) throw new Error("Assinante não encontrado.");
    writeJson(subscribersPath, subscribersStore);

    const ordersPath = resolveDataFile("waba-billing-orders.json");
    const orders = readJson<Array<{ ownerEmail?: string }>>(ordersPath, []);
    if (Array.isArray(orders)) {
      const kept = orders.filter((order) => normalizeEmail(String(order?.ownerEmail ?? "")) !== email);
      summary.billingOrdersRemoved = orders.length - kept.length;
      if (summary.billingOrdersRemoved > 0) writeJson(ordersPath, kept);
    }

    const creditPath = resolveDataFile("waba-disparos-credit-usage.json");
    const creditStore = readJson(creditPath, { version: 2, entries: [] as Array<{ email?: string }> });
    if (Array.isArray(creditStore.entries)) {
      const kept = creditStore.entries.filter((entry) => normalizeEmail(String(entry?.email ?? "")) !== email);
      summary.creditUsageRemoved = kept.length < creditStore.entries.length;
      if (summary.creditUsageRemoved) writeJson(creditPath, { ...creditStore, entries: kept });
    }

    const bonusPath = resolveDataFile("waba-disparos-bonus-balances.json");
    const bonusStore = readJson(bonusPath, { version: 2, entries: [] as Array<{ email?: string }> });
    if (Array.isArray(bonusStore.entries)) {
      const kept = bonusStore.entries.filter((entry) => normalizeEmail(String(entry?.email ?? "")) !== email);
      summary.bonusBalanceRemoved = kept.length < bonusStore.entries.length;
      if (summary.bonusBalanceRemoved) writeJson(bonusPath, { ...bonusStore, entries: kept });
    }

    const intakesPath = resolveDataFile("waba-campaign-intakes.json");
    const intakesStore = readJson(intakesPath, { version: 1, intakes: [] as Array<{ id?: string; ownerEmail?: string }> });
    if (!Array.isArray(intakesStore.intakes)) intakesStore.intakes = [];
    const removedIntakeIds: string[] = [];
    const keptIntakes = intakesStore.intakes.filter((intake) => {
      if (normalizeEmail(String(intake?.ownerEmail ?? "")) !== email) return true;
      if (intake?.id) removedIntakeIds.push(String(intake.id));
      return false;
    });
    summary.campaignIntakesRemoved = intakesStore.intakes.length - keptIntakes.length;
    if (summary.campaignIntakesRemoved > 0) {
      writeJson(intakesPath, { ...intakesStore, intakes: keptIntakes });
      const intakesDir = path.join(dataDir, "campaign-intakes");
      for (const intakeId of removedIntakeIds) {
        const dir = path.join(intakesDir, intakeId);
        if (existsSync(dir)) {
          removeDirRecursive(dir);
          summary.campaignIntakeDirsRemoved += 1;
        }
      }
    }

    const altPath = resolveDataFile("alternativa-number-activations.json");
    const altStore = readJson(altPath, { byEmail: {} as Record<string, unknown> });
    if (altStore?.byEmail && Object.prototype.hasOwnProperty.call(altStore.byEmail, email)) {
      delete altStore.byEmail[email];
      summary.alternativaActivationsRemoved = true;
      writeJson(altPath, altStore);
    }

    const ownersPath = resolveDataFile("instance-owners.json");
    const ownersStore = readJson(ownersPath, {
      instances: {} as Record<string, { ownerEmail?: string }>,
      deletedInstances: {},
    });
    if (ownersStore?.instances && typeof ownersStore.instances === "object") {
      for (const [key, value] of Object.entries(ownersStore.instances)) {
        if (normalizeEmail(String(value?.ownerEmail ?? "")) === email) {
          delete ownersStore.instances[key];
          summary.instanceOwnersRemoved += 1;
        }
      }
      if (summary.instanceOwnersRemoved > 0) writeJson(ownersPath, ownersStore);
    }

    const ticketsPath = resolveDataFile("waba-support-tickets.json");
    const ticketsStore = readJson(ticketsPath, {
      version: 1,
      tickets: [] as Array<{ id?: string; ownerEmail?: string }>,
    });
    if (Array.isArray(ticketsStore.tickets)) {
      const removedTickets = ticketsStore.tickets.filter(
        (ticket) => normalizeEmail(String(ticket?.ownerEmail ?? "")) === email,
      );
      const keptTickets = ticketsStore.tickets.filter(
        (ticket) => normalizeEmail(String(ticket?.ownerEmail ?? "")) !== email,
      );
      summary.supportTicketsRemoved = removedTickets.length;
      if (summary.supportTicketsRemoved > 0) {
        writeJson(ticketsPath, { ...ticketsStore, tickets: keptTickets });
        const supportDir = path.join(dataDir, "support-tickets");
        for (const ticket of removedTickets) {
          const dir = path.join(supportDir, String(ticket.id || ""));
          if (existsSync(dir)) removeDirRecursive(dir);
        }
      }
    }

    const settlementsPath = resolveDataFile("waba-financeiro-split-settlements.json");
    const settlementsStore = readJson(settlementsPath, {
      version: 1,
      settlements: [] as Array<{ ownerEmail?: string }>,
    });
    if (Array.isArray(settlementsStore.settlements)) {
      const kept = settlementsStore.settlements.filter(
        (row) => normalizeEmail(String(row?.ownerEmail ?? "")) !== email,
      );
      summary.splitSettlementsRemoved = settlementsStore.settlements.length - kept.length;
      if (summary.splitSettlementsRemoved > 0) {
        writeJson(settlementsPath, { ...settlementsStore, settlements: kept });
      }
    }

    return summary;
  }
}
