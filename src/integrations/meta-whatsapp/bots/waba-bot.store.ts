import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataDir } from "../../../data-path";
import { normalizeBotDraft } from "./waba-bot-flow.normalize";
import type { BotFlowDraft, BotHandledClaim, BotPhoneLink, BotRunState } from "./waba-bot.types";

const TENANT_RE = /^[a-zA-Z0-9._-]{8,80}$/;

function safeTenantId(tenantId: string): string {
  const id = String(tenantId || "").trim();
  if (!id) throw new Error("Tenant inválido para bots.");
  if (TENANT_RE.test(id)) return id;
  return createHash("sha256").update(id).digest("hex").slice(0, 40);
}

function tenantRoot(tenantId: string): string {
  return path.join(resolveDataDir(), "meta-whatsapp", "bots", safeTenantId(tenantId));
}

function flowsDir(tenantId: string): string {
  return path.join(tenantRoot(tenantId), "flows");
}

function runsDir(tenantId: string): string {
  return path.join(tenantRoot(tenantId), "runs");
}

function claimsDir(tenantId: string): string {
  return path.join(tenantRoot(tenantId), "claims");
}

function linksPath(tenantId: string): string {
  return path.join(tenantRoot(tenantId), "phone-links.json");
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!existsSync(file)) return fallback;
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function listBotFlows(tenantId: string): BotFlowDraft[] {
  const dir = flowsDir(tenantId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => readBotFlow(tenantId, file.slice(0, -5)))
    .filter((row): row is BotFlowDraft => Boolean(row))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function readBotFlow(tenantId: string, botId: string): BotFlowDraft | null {
  const id = String(botId || "").trim();
  if (!id) return null;
  const file = path.join(flowsDir(tenantId), `${id}.json`);
  if (!existsSync(file)) return null;
  try {
    return normalizeBotDraft(JSON.parse(readFileSync(file, "utf8")));
  } catch {
    return null;
  }
}

export function upsertBotFlow(tenantId: string, draft: BotFlowDraft): BotFlowDraft {
  const next = normalizeBotDraft({ ...draft, updatedAt: new Date().toISOString() });
  ensureDir(flowsDir(tenantId));
  writeFileSync(path.join(flowsDir(tenantId), `${next.id}.json`), JSON.stringify(next), "utf8");
  return next;
}

export function deleteBotFlow(tenantId: string, botId: string): boolean {
  const id = String(botId || "").trim();
  if (!id) return false;
  const file = path.join(flowsDir(tenantId), `${id}.json`);
  if (!existsSync(file)) return false;
  unlinkSync(file);
  const links = listBotPhoneLinks(tenantId).filter((row) => row.botId !== id);
  writePhoneLinks(tenantId, links);
  return true;
}

function writePhoneLinks(tenantId: string, links: BotPhoneLink[]): void {
  ensureDir(tenantRoot(tenantId));
  writeFileSync(linksPath(tenantId), JSON.stringify(links), "utf8");
}

export function listBotPhoneLinks(tenantId: string): BotPhoneLink[] {
  const raw = readJson<BotPhoneLink[]>(linksPath(tenantId), []);
  return Array.isArray(raw)
    ? raw.filter((row) => row && row.phoneNumberId && row.botId)
    : [];
}

export function getBotIdForPhone(tenantId: string, phoneNumberId: string): string | null {
  const phone = String(phoneNumberId || "").trim();
  if (!phone) return null;
  return listBotPhoneLinks(tenantId).find((row) => row.phoneNumberId === phone)?.botId || null;
}

export function setBotPhoneLink(input: {
  tenantId: string;
  phoneNumberId: string;
  botId: string | null;
}): BotPhoneLink[] {
  const phone = String(input.phoneNumberId || "").trim();
  if (!phone) throw new Error("Número Inbox inválido.");
  const links = listBotPhoneLinks(input.tenantId).filter((row) => row.phoneNumberId !== phone);
  const botId = String(input.botId || "").trim();
  if (botId) {
    if (!readBotFlow(input.tenantId, botId)) throw new Error("Bot não encontrado neste tenant.");
    links.push({
      tenantId: input.tenantId,
      phoneNumberId: phone,
      botId,
      updatedAt: new Date().toISOString(),
    });
  }
  writePhoneLinks(input.tenantId, links);
  return links;
}

export function readConversationBotRun(tenantId: string, conversationId: string): BotRunState | null {
  const id = String(conversationId || "").trim();
  if (!id) return null;
  const file = path.join(runsDir(tenantId), `${id}.json`);
  return readJson<BotRunState | null>(file, null);
}

export function writeConversationBotRun(
  tenantId: string,
  conversationId: string,
  run: BotRunState | null,
): void {
  const id = String(conversationId || "").trim();
  if (!id) return;
  ensureDir(runsDir(tenantId));
  const file = path.join(runsDir(tenantId), `${id}.json`);
  if (!run) {
    if (existsSync(file)) unlinkSync(file);
    return;
  }
  writeFileSync(file, JSON.stringify(run), "utf8");
}

export function tryClaimBotMessage(input: {
  tenantId: string;
  messageId: string;
  conversationId: string;
  botId: string;
}): { claimed: boolean; record: BotHandledClaim } {
  const messageId = String(input.messageId || "").trim();
  ensureDir(claimsDir(input.tenantId));
  const file = path.join(claimsDir(input.tenantId), `${messageId}.json`);
  if (existsSync(file)) {
    const existing = readJson<BotHandledClaim>(file, {
      tenantId: input.tenantId,
      messageId,
      conversationId: input.conversationId,
      botId: input.botId,
      handled: true,
      at: new Date().toISOString(),
    });
    return { claimed: false, record: existing };
  }
  const record: BotHandledClaim = {
    tenantId: input.tenantId,
    messageId,
    conversationId: input.conversationId,
    botId: input.botId,
    handled: true,
    at: new Date().toISOString(),
  };
  writeFileSync(file, JSON.stringify(record), "utf8");
  return { claimed: true, record };
}

export function wasBotMessageClaimed(tenantId: string, messageId: string): boolean {
  const id = String(messageId || "").trim();
  if (!id) return false;
  return existsSync(path.join(claimsDir(tenantId), `${id}.json`));
}

export function resetWabaBotStoreForTests(tenantId?: string): void {
  const root = tenantId
    ? tenantRoot(tenantId)
    : path.join(resolveDataDir(), "meta-whatsapp", "bots");
  if (existsSync(root)) rmSync(root, { recursive: true, force: true });
}
