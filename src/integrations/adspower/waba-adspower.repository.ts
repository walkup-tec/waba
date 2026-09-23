import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataFile } from "../../data-path";
import type { AdsPowerProfileRecord, AdsPowerStore } from "./waba-adspower.types";

const FILE = "waba-adspower-profiles.json";

const emptyStore = (): AdsPowerStore => ({
  version: 1,
  updatedAt: new Date().toISOString(),
  profiles: [],
});

export class WabaAdsPowerRepository {
  private read(): AdsPowerStore {
    const filePath = resolveDataFile(FILE);
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (!existsSync(filePath)) return emptyStore();
    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf8")) as AdsPowerStore;
      if (parsed?.version !== 1 || !Array.isArray(parsed.profiles)) return emptyStore();
      return parsed;
    } catch {
      return emptyStore();
    }
  }

  private write(store: AdsPowerStore): AdsPowerStore {
    const filePath = resolveDataFile(FILE);
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const payload: AdsPowerStore = { ...store, updatedAt: new Date().toISOString() };
    const tmp = `${filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
    writeFileSync(filePath, readFileSync(tmp));
    return payload;
  }

  list(): AdsPowerProfileRecord[] {
    return this.read()
      .profiles.slice()
      .sort((a, b) => String(a.name || a.userId).localeCompare(String(b.name || b.userId), "pt-BR"));
  }

  getByUserId(userId: string): AdsPowerProfileRecord | null {
    const id = String(userId || "").trim();
    if (!id) return null;
    return this.read().profiles.find((row) => row.userId === id) ?? null;
  }

  upsertMany(rows: AdsPowerProfileRecord[]): AdsPowerProfileRecord[] {
    const store = this.read();
    const byId = new Map(store.profiles.map((row) => [row.userId, row]));
    for (const row of rows) {
      const prev = byId.get(row.userId);
      byId.set(row.userId, prev ? { ...prev, ...row, userId: row.userId } : row);
    }
    return this.write({ version: 1, updatedAt: "", profiles: [...byId.values()] }).profiles;
  }

  save(row: AdsPowerProfileRecord): AdsPowerProfileRecord {
    this.upsertMany([row]);
    return this.getByUserId(row.userId) || row;
  }

  replaceAll(rows: AdsPowerProfileRecord[]): AdsPowerProfileRecord[] {
    return this.write({ version: 1, updatedAt: "", profiles: rows }).profiles;
  }
}
