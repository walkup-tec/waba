import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { WabaSubscriber } from "../subscribers/waba-subscriber.repository";
import { WabaSubscriberRepository } from "../subscribers/waba-subscriber.repository";
import { resolveDataFile } from "../data-path";

export type SubscriberPromoteFromV02Bundle = {
  email: string;
  subscriber: Partial<WabaSubscriber> & { email: string };
  billingOrders?: Array<Record<string, unknown>>;
  creditUsage?: {
    consumedOficial?: number;
    consumedAlternativa?: number;
    updatedAt?: string;
  };
  instanceOwners?: Record<
    string,
    { ownerEmail: string; createdAt?: string; syncedFromWalkupProdAt?: string }
  >;
};

const normalizeEmail = (value: string): string => String(value || "").trim().toLowerCase();

const readJson = <T>(filePath: string, fallback: T): T => {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
};

const writeJsonAtomic = (filePath: string, data: unknown) => {
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  writeFileSync(filePath, readFileSync(tmp));
};

export class WabaAdminSubscriberPromoteService {
  constructor(private readonly subscriberRepository = new WabaSubscriberRepository()) {}

  promoteFromV02Bundle(bundle: SubscriberPromoteFromV02Bundle) {
    const email = normalizeEmail(bundle.email);
    if (!email.includes("@")) throw new Error("E-mail inválido no bundle.");
    const subscriber = bundle.subscriber;
    const billingOrders = Array.isArray(bundle.billingOrders) ? bundle.billingOrders : [];
    const hasValidSubscriberBundle =
      Boolean(subscriber?.passwordHash) && normalizeEmail(String(subscriber?.email || "")) === email;
    const existing = this.subscriberRepository.getByEmail(email);
    const billingOnly = !hasValidSubscriberBundle;

    if (billingOnly) {
      if (!existing) throw new Error("Bundle de assinante inválido.");
      if (billingOrders.length === 0) {
        throw new Error("Nenhum pedido informado para promover.");
      }
    } else if (!hasValidSubscriberBundle) {
      throw new Error("Bundle de assinante inválido.");
    }

    const summary = {
      email,
      subscriber: "unchanged" as "created" | "updated" | "unchanged",
      billingOrdersAdded: 0,
      creditUsage: false,
      instanceOwners: 0,
    };

    if (!billingOnly) {
      const subscribersPath = resolveDataFile("waba-subscribers.json");
      const store = readJson<{ version: number; subscribers: WabaSubscriber[] }>(subscribersPath, {
        version: 1,
        subscribers: [],
      });
      if (!Array.isArray(store.subscribers)) store.subscribers = [];

      const payload: WabaSubscriber = {
        ...(subscriber as WabaSubscriber),
        email,
        phone: String(subscriber.phone || subscriber.whatsapp || "").trim(),
        updatedAt: new Date().toISOString(),
      };

      const idx = store.subscribers.findIndex((row) => normalizeEmail(row.email) === email);
      if (idx >= 0) {
        store.subscribers[idx] = {
          ...store.subscribers[idx],
          ...payload,
          id: store.subscribers[idx].id,
        };
        summary.subscriber = "updated";
      } else {
        store.subscribers.push(payload);
        summary.subscriber = "created";
      }
      writeJsonAtomic(subscribersPath, store);
    }

    const ordersPath = resolveDataFile("waba-billing-orders.json");
    const orders = readJson<Array<Record<string, unknown>>>(ordersPath, []);
    const orderList = Array.isArray(orders) ? orders : [];
    const knownIds = new Set(orderList.map((row) => String(row?.id || "").trim()).filter(Boolean));
    for (const order of bundle.billingOrders || []) {
      const id = String(order?.id || "").trim();
      if (!id || knownIds.has(id)) continue;
      if (normalizeEmail(String(order?.ownerEmail || "")) !== email) continue;
      orderList.unshift(order);
      knownIds.add(id);
      summary.billingOrdersAdded += 1;
    }
    writeJsonAtomic(ordersPath, orderList);

    if (bundle.creditUsage) {
      const usagePath = resolveDataFile("waba-disparos-credit-usage.json");
      const usageStore = readJson<{ version: number; entries: Array<Record<string, unknown>> }>(
        usagePath,
        { version: 2, entries: [] },
      );
      if (!Array.isArray(usageStore.entries)) usageStore.entries = [];
      const entry = {
        email,
        consumedOficial: Math.max(0, Math.round(Number(bundle.creditUsage.consumedOficial ?? 0))),
        consumedAlternativa: Math.max(
          0,
          Math.round(Number(bundle.creditUsage.consumedAlternativa ?? 0)),
        ),
        updatedAt: String(bundle.creditUsage.updatedAt || new Date().toISOString()),
      };
      const usageIdx = usageStore.entries.findIndex(
        (row) => normalizeEmail(String(row?.email || "")) === email,
      );
      if (usageIdx >= 0) usageStore.entries[usageIdx] = entry;
      else usageStore.entries.push(entry);
      writeJsonAtomic(usagePath, usageStore);
      summary.creditUsage = true;
    }

    const ownersPath = resolveDataFile("instance-owners.json");
    const ownersStore = readJson<{ instances: Record<string, Record<string, unknown>> }>(
      ownersPath,
      { instances: {} },
    );
    if (!ownersStore.instances || typeof ownersStore.instances !== "object") {
      ownersStore.instances = {};
    }
    const now = new Date().toISOString();
    for (const [name, meta] of Object.entries(bundle.instanceOwners || {})) {
      const key = String(name || "").trim();
      if (!key) continue;
      ownersStore.instances[key] = {
        ownerEmail: email,
        createdAt: String(meta?.createdAt || now),
        ...(meta?.syncedFromWalkupProdAt
          ? { syncedFromWalkupProdAt: String(meta.syncedFromWalkupProdAt) }
          : { promotedFromV02At: now }),
      };
      summary.instanceOwners += 1;
    }
    if (summary.instanceOwners > 0) writeJsonAtomic(ownersPath, ownersStore);

    return {
      ok: true,
      ...summary,
      hadExistingSubscriber: Boolean(existing),
    };
  }
}
