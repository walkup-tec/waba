import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataFile } from "../data-path";

export type WabaIndicatorAuditEvent = {
  id: string;
  actorUserId: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  previousValue: unknown;
  nextValue: unknown;
  createdAt: string;
};

type Store = {
  version: 1;
  events: WabaIndicatorAuditEvent[];
};

const FILE_NAME = "waba-indicator-audit.json";
const MAX_EVENTS = 5000;

const emptyStore = (): Store => ({ version: 1, events: [] });

export class WabaIndicatorAuditRepository {
  private readStore(): Store {
    const filePath = resolveDataFile(FILE_NAME);
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (!existsSync(filePath)) return emptyStore();
    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Store;
      if (parsed?.version !== 1 || !Array.isArray(parsed.events)) return emptyStore();
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

  append(input: Omit<WabaIndicatorAuditEvent, "id" | "createdAt"> & { createdAt?: string }) {
    const store = this.readStore();
    store.events.push({
      id: randomUUID(),
      actorUserId: String(input.actorUserId ?? "").trim(),
      actorEmail: String(input.actorEmail ?? "").trim().toLowerCase(),
      action: String(input.action ?? "").trim(),
      entityType: String(input.entityType ?? "").trim(),
      entityId: String(input.entityId ?? "").trim(),
      previousValue: input.previousValue ?? null,
      nextValue: input.nextValue ?? null,
      createdAt: input.createdAt || new Date().toISOString(),
    });
    if (store.events.length > MAX_EVENTS) {
      store.events = store.events.slice(store.events.length - MAX_EVENTS);
    }
    this.writeStore(store);
  }

  listByEntity(entityType: string, entityId: string, limit = 50): WabaIndicatorAuditEvent[] {
    const type = String(entityType ?? "").trim();
    const id = String(entityId ?? "").trim();
    return this.readStore()
      .events.filter((item) => item.entityType === type && item.entityId === id)
      .slice(-Math.max(1, limit))
      .reverse();
  }
}
