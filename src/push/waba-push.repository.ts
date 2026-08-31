import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { resolveDataFile } from "../data-path";
import type { WabaPushConfig, WabaPushMessage } from "./waba-push.types";
import {
  LEGACY_WRONG_PUSH_COMMUNITY_INSTANCES,
  resolveDefaultPushCommunityEvoInstance,
} from "./waba-push.types";

const MESSAGES_FILE = "waba-push-messages.json";
const CONFIG_FILE = "waba-push-config.json";

const DEFAULT_CONFIG: WabaPushConfig = {
  communityInviteLink: "https://chat.whatsapp.com/EoP6r6BIZt83GenpCgvUJ7",
  communityAnnouncementGroupJid: "",
  communityEvoInstance: resolveDefaultPushCommunityEvoInstance(),
  updatedAt: new Date().toISOString(),
};

type MessageStore = {
  version: 1;
  messages: WabaPushMessage[];
};

const emptyStore = (): MessageStore => ({ version: 1, messages: [] });

export class WabaPushRepository {
  private readMessages(): MessageStore {
    const filePath = resolveDataFile(MESSAGES_FILE);
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (!existsSync(filePath)) return emptyStore();
    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf8")) as MessageStore;
      if (parsed?.version !== 1 || !Array.isArray(parsed.messages)) return emptyStore();
      return parsed;
    } catch {
      return emptyStore();
    }
  }

  private writeMessages(store: MessageStore): void {
    const filePath = resolveDataFile(MESSAGES_FILE);
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const tmp = `${filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
    writeFileSync(filePath, readFileSync(tmp));
  }

  listMessages(limit = 50): WabaPushMessage[] {
    return this.readMessages()
      .messages.map((row) => ({
        ...row,
        image: row.image?.id ? row.image : null,
      }))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, Math.max(1, limit));
  }

  getById(id: string): WabaPushMessage | null {
    const normalized = String(id || "").trim();
    if (!normalized) return null;
    return this.readMessages().messages.find((row) => row.id === normalized) ?? null;
  }

  save(message: WabaPushMessage): WabaPushMessage {
    const store = this.readMessages();
    const idx = store.messages.findIndex((row) => row.id === message.id);
    if (idx >= 0) store.messages[idx] = message;
    else store.messages.push(message);
    this.writeMessages(store);
    return message;
  }

  createId(): string {
    return crypto.randomUUID();
  }

  readConfig(): WabaPushConfig {
    const filePath = resolveDataFile(CONFIG_FILE);
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (!existsSync(filePath)) {
      this.writeConfig(DEFAULT_CONFIG);
      return { ...DEFAULT_CONFIG };
    }
    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Partial<WabaPushConfig>;
      const config: WabaPushConfig = {
        communityInviteLink: String(
          parsed.communityInviteLink || DEFAULT_CONFIG.communityInviteLink,
        ).trim(),
        communityAnnouncementGroupJid: String(parsed.communityAnnouncementGroupJid || "").trim(),
        communityEvoInstance: String(
          parsed.communityEvoInstance || DEFAULT_CONFIG.communityEvoInstance,
        ).trim(),
        updatedAt: String(parsed.updatedAt || new Date().toISOString()),
      };
      const targetInstance = resolveDefaultPushCommunityEvoInstance();
      if (LEGACY_WRONG_PUSH_COMMUNITY_INSTANCES.has(config.communityEvoInstance.toLowerCase())) {
        return this.writeConfig({
          ...config,
          communityEvoInstance: targetInstance,
          communityAnnouncementGroupJid: "",
        });
      }
      return config;
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  writeConfig(config: WabaPushConfig): WabaPushConfig {
    const filePath = resolveDataFile(CONFIG_FILE);
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const payload: WabaPushConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
    };
    const tmp = `${filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
    writeFileSync(filePath, readFileSync(tmp));
    return payload;
  }

  dismissForUser(pushId: string, email: string): boolean {
    const normalizedId = String(pushId || "").trim();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedId || !normalizedEmail.includes("@")) return false;
    const store = this.readMessages();
    const row = store.messages.find((item) => item.id === normalizedId);
    if (!row) return false;
    const dismissed = new Set(
      (row.dismissedBy || []).map((value) => String(value || "").trim().toLowerCase()),
    );
    if (dismissed.has(normalizedEmail)) return true;
    dismissed.add(normalizedEmail);
    row.dismissedBy = Array.from(dismissed);
    this.writeMessages(store);
    return true;
  }
}
