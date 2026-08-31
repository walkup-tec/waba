import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataFile } from "../data-path";

export const MASTER_MENU_BADGE_KEYS = [
  "admin-assinantes",
  "admin-campanhas",
  "admin-usuarios",
  "admin-financeiro",
  "admin-chamados",
] as const;

export type MasterMenuBadgeKey = (typeof MASTER_MENU_BADGE_KEYS)[number];

type Store = {
  version: 1;
  masters: Record<string, Partial<Record<MasterMenuBadgeKey, string>>>;
};

const FILE_NAME = "waba-master-menu-seen.json";

const emptyStore = (): Store => ({ version: 1, masters: {} });

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

export class WabaAdminMasterMenuBadgesRepository {
  private readStore(): Store {
    const filePath = resolveDataFile(FILE_NAME);
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (!existsSync(filePath)) return emptyStore();
    try {
      const raw = readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as Store;
      if (parsed?.version !== 1 || typeof parsed.masters !== "object" || !parsed.masters) {
        return emptyStore();
      }
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

  getSeenAt(masterEmail: string, menuKey: MasterMenuBadgeKey): string | null {
    const email = normalizeEmail(masterEmail);
    if (!email) return null;
    const value = this.readStore().masters[email]?.[menuKey];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  getSeenMap(masterEmail: string): Partial<Record<MasterMenuBadgeKey, string>> {
    const email = normalizeEmail(masterEmail);
    if (!email) return {};
    return { ...(this.readStore().masters[email] ?? {}) };
  }

  markSeen(masterEmail: string, menuKey: MasterMenuBadgeKey, seenAt: string) {
    const email = normalizeEmail(masterEmail);
    if (!email) return;
    const store = this.readStore();
    const bucket = { ...(store.masters[email] ?? {}) };
    bucket[menuKey] = seenAt;
    store.masters[email] = bucket;
    this.writeStore(store);
  }
}
