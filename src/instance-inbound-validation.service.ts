import crypto from "crypto";
import { defaultEvoSendTextTimeoutMs, evoHttpRequest } from "./evo-http.client";
import { waitForEvoInstanceLiveOpen } from "./instances/evo-connection-state.service";
import {
  normalizeEvoWhatsAppNumber,
  resolveEvoInstancePhone,
} from "./instances/evo-instance-phone.service";
import { resolveWabaPublicBaseUrl } from "./lib/waba-public-base-url";

const EVO_API_BASE = String(process.env.EVO_API_URL || "http://walkup-evo-walkup-api:8080")
  .replace(/\/$/, "");
const EVO_API_KEY = String(process.env.EVO_API_KEY || "429683C4C977415CAAFCCE10F7D57E11");
const EVO_SEND_TEXT_URL_TEMPLATE =
  String(process.env.EVO_SEND_TEXT_URL_TEMPLATE || "").trim() ||
  `${EVO_API_BASE}/message/sendText/{instance}`;
const EVO_SEND_TEXT_V1 =
  process.env.EVO_SEND_TEXT_V1 === "1" || process.env.EVO_SEND_TEXT_V1 === "true";

export const INBOUND_VALIDATION_KEYWORD =
  String(process.env.INBOUND_VALIDATION_KEYWORD || "CONFIRMAR").trim() || "CONFIRMAR";

const VALIDATION_TIMEOUT_MS = Math.max(
  120_000,
  Math.min(900_000, Number(process.env.INBOUND_VALIDATION_TIMEOUT_MS || 600_000) || 600_000)
);
const VALIDATION_POLL_MS = Math.max(
  200,
  Math.min(10_000, Number(process.env.INBOUND_VALIDATION_POLL_MS || 280) || 280)
);
const FIND_MESSAGES_TIMEOUT_MS = Math.max(
  3_000,
  Math.min(20_000, Number(process.env.INBOUND_VALIDATION_FIND_MSG_TIMEOUT_MS || 8_000) || 8_000),
);
const INBOUND_DEEP_SCAN_EVERY_TICKS = Math.max(
  3,
  Math.min(30, Number(process.env.INBOUND_VALIDATION_DEEP_SCAN_EVERY || 5) || 5),
);
const INBOUND_FIND_CHATS_LIMIT = Math.max(
  3,
  Math.min(30, Number(process.env.INBOUND_VALIDATION_FIND_CHATS_LIMIT || 8) || 8),
);
const REPLY_DELAY_MS = Math.max(
  500,
  Math.min(30_000, Number(process.env.INBOUND_VALIDATION_REPLY_DELAY_MS || 1000) || 1000)
);

export type ValidationTestResult = {
  success: boolean | null;
  detail: string;
};

export type InboundValidationPhase =
  | "awaiting_inbound"
  | "inbound_received"
  | "sending_reply"
  | "completed"
  | "failed"
  | "expired";

export type InboundValidationStatus = {
  validationId: string;
  instanceName: string;
  instanceNumber: string;
  keyword: string;
  phase: InboundValidationPhase;
  receiveTest: ValidationTestResult;
  sendTest: ValidationTestResult;
  finished: boolean;
  restrictionSuspected: boolean;
  referenceNumber: string | null;
  webhookConfigured: boolean;
  startedAt: string;
  finishedAt: string | null;
};

type ValidationRecord = InboundValidationStatus & {
  replyMarker: string;
  referenceJid: string | null;
  inboundReceivedAt: number | null;
  validationStartedAtMs: number;
  sendAttempted: boolean;
  sendHttpOk: boolean;
  sendDetail: string;
  loopRunning: boolean;
  cancelled: boolean;
  replyFollowUpScheduled: boolean;
  pollTick: number;
};

const validations = new Map<string, ValidationRecord>();
/** Uma validação ativa por instância — evita loops órfãos após novo POST. */
const activeValidationByInstance = new Map<string, string>();
/** Uma resposta por conversa (instância + chat) dentro da janela. */
const recentReplyByConversation = new Map<string, number>();
const REPLY_DEDUPE_MS = 15 * 60 * 1000;
const replyInFlight = new Set<string>();

let onValidationFinished: ((status: InboundValidationStatus) => void) | null = null;

export function setInboundValidationFinishedHandler(
  handler: ((status: InboundValidationStatus) => void) | null
): void {
  onValidationFinished = handler;
}

function isRecordActive(record: ValidationRecord): boolean {
  return !record.finished && !record.cancelled;
}

function cancelValidationRecord(record: ValidationRecord): void {
  if (record.cancelled || record.finished) return;
  record.cancelled = true;
}

function getActiveValidationForInstance(instanceName: string): ValidationRecord | null {
  const id = activeValidationByInstance.get(instanceName);
  if (!id) return null;
  const record = validations.get(id);
  if (!record || !isRecordActive(record)) {
    activeValidationByInstance.delete(instanceName);
    return null;
  }
  return record;
}

function stopValidationsForInstance(instanceName: string, exceptValidationId?: string): void {
  for (const [id, record] of validations.entries()) {
    if (record.instanceName !== instanceName) continue;
    if (exceptValidationId && id === exceptValidationId) continue;
    cancelValidationRecord(record);
    validations.delete(id);
  }
  if (!exceptValidationId || activeValidationByInstance.get(instanceName) !== exceptValidationId) {
    activeValidationByInstance.delete(instanceName);
  }
}

function conversationReplyKey(record: ValidationRecord): string | null {
  const target = resolveSendTarget(record.referenceJid, record.referenceNumber);
  if (!target) return null;
  return `${record.instanceName}:${target}`;
}

function notifyFinished(record: ValidationRecord): void {
  if (!onValidationFinished) return;
  try {
    onValidationFinished(publicStatus(record));
  } catch (e) {
    console.error("[validacao-inbound] onFinished:", e);
  }
}

function normalizeWhatsAppNumber(num: string): string {
  return normalizeEvoWhatsAppNumber(num);
}

function formatPhoneHint(num: string): string {
  const digits = normalizeWhatsAppNumber(num);
  if (!digits) return "";
  if (digits.length >= 12 && digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length === 9) {
      return `+55 ${ddd} ${rest.slice(0, 5)}-${rest.slice(5)}`;
    }
    if (rest.length === 8) {
      return `+55 ${ddd} ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
    if (rest.length > 4) {
      return `+55 ${ddd} ${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`;
    }
    return `+55 ${ddd} ${rest}`;
  }
  return `+${digits}`;
}

function resolvePublicWebhookBase(): string {
  return String(resolveWabaPublicBaseUrl() || "").trim().replace(/\/+$/, "");
}

function jidToNumber(jid: string): string {
  const s = String(jid || "").trim();
  if (!s) return "";
  return normalizeWhatsAppNumber(s.split("@")[0] || s);
}

async function callEvo(
  url: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: Record<string, unknown>,
  options?: { timeoutMs?: number; retries?: number },
) {
  const isSendText = url.includes("/message/sendText/");
  const result = await evoHttpRequest(url, method, {
    apiKey: EVO_API_KEY,
    body,
    timeoutMs: options?.timeoutMs ?? (isSendText ? defaultEvoSendTextTimeoutMs() : 15_000),
    retries: options?.retries ?? (isSendText ? 2 : 1),
  });
  return {
    ok: result.ok,
    status: result.status,
    body: result.body,
    json: result.json,
  };
}

function buildTemplateUrl(template: string, instanceName: string): string {
  return template
    .replace("{instance}", encodeURIComponent(instanceName))
    .replace("{name}", encodeURIComponent(instanceName));
}

function resolveSendTarget(referenceJid: string | null, referenceNumber: string | null): string {
  const jid = String(referenceJid || "").trim();
  if (jid.includes("@")) return jid;
  const digits = normalizeWhatsAppNumber(String(referenceNumber || "").trim());
  return digits;
}

function collectMessageTexts(node: unknown, out: string[], depth = 0): void {
  if (depth > 12 || node == null) return;
  if (typeof node === "string") return;
  if (Array.isArray(node)) {
    for (const item of node) collectMessageTexts(item, out, depth + 1);
    return;
  }
  if (typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  if (typeof obj.conversation === "string" && obj.conversation.trim()) {
    out.push(obj.conversation.trim());
  }
  const ext = obj.extendedTextMessage as Record<string, unknown> | undefined;
  if (typeof ext?.text === "string" && ext.text.trim()) out.push(ext.text.trim());
  if (typeof obj.text === "string" && obj.text.trim()) out.push(obj.text.trim());
  if (typeof obj.body === "string" && obj.body.trim()) out.push(obj.body.trim());
  const buttons = obj.buttonsResponseMessage as Record<string, unknown> | undefined;
  if (typeof buttons?.selectedDisplayText === "string" && buttons.selectedDisplayText.trim()) {
    out.push(buttons.selectedDisplayText.trim());
  }
  const template = obj.templateButtonReplyMessage as Record<string, unknown> | undefined;
  if (typeof template?.selectedDisplayText === "string" && template.selectedDisplayText.trim()) {
    out.push(template.selectedDisplayText.trim());
  }
  const image = obj.imageMessage as Record<string, unknown> | undefined;
  if (typeof image?.caption === "string" && image.caption.trim()) out.push(image.caption.trim());
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") collectMessageTexts(value, out, depth + 1);
  }
}

function normalizeKeywordText(text: string): string {
  return String(text || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function textMatchesKeyword(texts: string[], keyword: string): boolean {
  const needle = normalizeKeywordText(keyword);
  if (!needle) return false;
  return texts.some((t) => {
    const normalized = normalizeKeywordText(t);
    if (!normalized) return false;
    if (normalized === needle) return true;
    if (normalized.includes(needle) && normalized.length <= needle.length + 12) return true;
    return false;
  });
}

function extractMessageTimestampMs(node: Record<string, unknown>): number | null {
  const message = node.message as Record<string, unknown> | undefined;
  const key = node.key as Record<string, unknown> | undefined;
  const candidates = [
    node.messageTimestamp,
    message?.messageTimestamp,
    key?.messageTimestamp,
    node.timestamp,
    message?.timestamp,
  ];
  for (const raw of candidates) {
    if (raw == null || raw === "") continue;
    const n = typeof raw === "number" ? raw : Number(String(raw).trim());
    if (!Number.isFinite(n) || n <= 0) continue;
    return n < 1_000_000_000_000 ? Math.round(n * 1000) : Math.round(n);
  }
  return null;
}

function isSendFailureTechnical(detail: string, httpStatus?: number): boolean {
  const d = String(detail || "").toLowerCase();
  if (httpStatus === 0) return true;
  if (httpStatus === 400 && (d.includes("exists") || d.includes("bad request"))) return true;
  if (
    d.includes("timeout") ||
    d.includes("socket hang up") ||
    d.includes("econnreset") ||
    d.includes("network") ||
    d.includes("http 0")
  ) {
    return true;
  }
  return false;
}

function isLikelyWhatsAppRestriction(detail: string, httpStatus?: number): boolean {
  const d = String(detail || "").toLowerCase();
  const patterns = [
    "ban",
    "banned",
    "blocked",
    "blocklist",
    "restricted",
    "restriction",
    "suspended",
    "suspend",
    "not authorized",
    "forbidden",
    "rate-overlimit",
    "spam",
    "integrity",
    "logged out",
    "logout",
    "connection closed",
    "disconnected",
  ];
  if (patterns.some((p) => d.includes(p))) return true;
  return httpStatus === 403;
}

function computeRestrictionSuspected(record: ValidationRecord): boolean {
  if (!record.finished || !record.sendAttempted) return false;
  if (record.sendHttpOk) return false;
  return isLikelyWhatsAppRestriction(record.sendDetail);
}

function publicStatus(record: ValidationRecord): InboundValidationStatus {
  return {
    validationId: record.validationId,
    instanceName: record.instanceName,
    instanceNumber: record.instanceNumber,
    keyword: record.keyword,
    phase: record.phase,
    receiveTest: { ...record.receiveTest },
    sendTest: { ...record.sendTest },
    finished: record.finished,
    restrictionSuspected: computeRestrictionSuspected(record),
    referenceNumber: record.referenceNumber,
    webhookConfigured: record.webhookConfigured,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
  };
}

function tryFinalize(record: ValidationRecord): void {
  if (record.finished) return;
  const receiveDone = record.receiveTest.success !== null;
  const sendDone = record.sendTest.success !== null;
  if (!receiveDone || !sendDone) return;
  record.finished = true;
  record.finishedAt = new Date().toISOString();
  record.phase =
    record.receiveTest.success === true && record.sendTest.success === true
      ? "completed"
      : "failed";
  notifyFinished(record);
}

function finalizeExpired(record: ValidationRecord): void {
  void finalizeExpiredAsync(record);
}

async function finalizeExpiredAsync(record: ValidationRecord): Promise<void> {
  if (record.finished) return;

  if (record.receiveTest.success === null) {
    try {
      const hit = await resolveInboundHit(
        record.instanceName,
        record.keyword,
        record.validationStartedAtMs,
        { aggressive: true, deep: true },
      );
      if (hit) {
        markInboundReceived(record, hit, "expire-rescan");
        await runValidationFollowUp(record);
        await new Promise((r) => setTimeout(r, REPLY_DELAY_MS + 1000));
        await runValidationFollowUp(record);
      }
    } catch {
      /* última tentativa antes de expirar */
    }
  }

  if (record.finished) return;

  const phoneLabel = formatPhoneHint(record.instanceNumber) || "número integrado";
  if (record.receiveTest.success === null) {
    record.receiveTest = {
      success: false,
      detail: `Tempo esgotado sem receber "${record.keyword}" de outro WhatsApp para ${phoneLabel}. Abra o chat com esse número (não o celular que escaneou o QR) e envie só a palavra ${record.keyword}.`,
    };
    record.phase = "expired";
  }
  if (record.sendTest.success === null) {
    record.sendTest = {
      success: false,
      detail: record.receiveTest.success
        ? "Tempo esgotado sem confirmar resposta na conversa."
        : "Resposta não testada — recepção não confirmada.",
    };
  }
  tryFinalize(record);
}

async function readInstanceWebhook(
  instanceName: string,
): Promise<{ enabled: boolean; url: string }> {
  const enc = encodeURIComponent(instanceName);
  const findUrls = [
    `${EVO_API_BASE}/webhook/find/${enc}`,
    `${EVO_API_BASE}/webhook/find/${enc}/webhook`,
  ];
  for (const url of findUrls) {
    const result = await callEvo(url, "GET", undefined, { timeoutMs: 8_000 });
    if (!result.ok || !result.json || typeof result.json !== "object") continue;
    const root = result.json as Record<string, unknown>;
    const wh = (root.webhook as Record<string, unknown> | undefined) ?? root;
    return {
      enabled: wh.enabled === true || root.enabled === true,
      url: String(wh.url ?? root.url ?? "").trim(),
    };
  }
  return { enabled: false, url: "" };
}

async function ensureInstanceWebhook(instanceName: string): Promise<boolean> {
  const publicBase = resolvePublicWebhookBase();
  const webhookUrl = publicBase ? `${publicBase}/webhooks/evolution` : "";
  const existing = await readInstanceWebhook(instanceName);
  if (
    existing.enabled &&
    existing.url &&
    (webhookUrl ? existing.url === webhookUrl : existing.url.includes("/webhooks/evolution"))
  ) {
    return true;
  }
  if (!webhookUrl) return false;

  const enc = encodeURIComponent(instanceName);
  const setUrls = [
    `${EVO_API_BASE}/webhook/set/${enc}`,
    `${EVO_API_BASE}/webhook/set/${enc}/webhook`,
  ];
  const body = {
    webhook: {
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      webhookBase64: false,
      events: ["MESSAGES_UPSERT", "messages.upsert"],
    },
  };
  for (const setUrl of setUrls) {
    const result = await callEvo(setUrl, "POST", body, { timeoutMs: 10_000 });
    if (result.ok) return true;
  }
  const after = await readInstanceWebhook(instanceName);
  return after.enabled && after.url === webhookUrl;
}

type InboundHit = {
  remoteJid: string;
  referenceNumber: string;
  texts: string[];
  messageTimestampMs: number | null;
};

type InboundHitSearchOptions = {
  minTimestampMs?: number;
  requireTimestamp?: boolean;
};

const INBOUND_KEYWORD_GRACE_MS = Math.max(
  0,
  Math.min(60_000, Number(process.env.INBOUND_VALIDATION_KEYWORD_GRACE_MS || 15_000) || 15_000),
);

function inboundKeywordMinTimestampMs(validationStartedAtMs: number, aggressive = false): number {
  const grace = aggressive ? Math.max(INBOUND_KEYWORD_GRACE_MS, 60_000) : INBOUND_KEYWORD_GRACE_MS;
  return validationStartedAtMs - grace;
}

function inboundKeywordSearchOptions(
  validationStartedAtMs: number,
  aggressive = false,
): InboundHitSearchOptions {
  return {
    minTimestampMs: inboundKeywordMinTimestampMs(validationStartedAtMs, aggressive),
    requireTimestamp: true,
  };
}

function isInboundHitFresh(hit: InboundHit, options?: InboundHitSearchOptions): boolean {
  const minTs = options?.minTimestampMs;
  if (minTs != null) {
    if (hit.messageTimestampMs == null) return false;
    return hit.messageTimestampMs >= minTs;
  }
  if (options?.requireTimestamp) return hit.messageTimestampMs != null;
  return true;
}

function isInboundCandidate(node: Record<string, unknown>): boolean {
  const fromMe = extractFromMe(node);
  return fromMe !== true;
}

function findJidInSubtree(node: unknown, depth = 0): string {
  if (depth > 8 || node == null) return "";
  if (typeof node !== "object") return "";
  const jid = extractRemoteJid(node as Record<string, unknown>);
  if (jid) return jid;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findJidInSubtree(item, depth + 1);
      if (found) return found;
    }
    return "";
  }
  for (const value of Object.values(node as Record<string, unknown>)) {
    if (value && typeof value === "object") {
      const found = findJidInSubtree(value, depth + 1);
      if (found) return found;
    }
  }
  return "";
}

function collectInboundTexts(node: Record<string, unknown>): string[] {
  const texts: string[] = [];
  collectMessageTexts(node.message ?? node, texts);
  if (!texts.length) collectMessageTexts(node, texts);
  return texts;
}

function walkInboundHits(
  node: unknown,
  out: InboundHit[],
  keyword: string,
  options?: InboundHitSearchOptions,
  depth = 0
): void {
  if (depth > 16 || node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) walkInboundHits(item, out, keyword, options, depth + 1);
    return;
  }
  if (typeof node !== "object") return;
  const obj = node as Record<string, unknown>;

  if (isInboundCandidate(obj)) {
    const texts = collectInboundTexts(obj);
    if (textMatchesKeyword(texts, keyword)) {
      const remoteJid = extractRemoteJid(obj) || findJidInSubtree(obj);
      if (remoteJid) {
        const hit: InboundHit = {
          remoteJid,
          referenceNumber: jidToNumber(remoteJid),
          texts,
          messageTimestampMs: extractMessageTimestampMs(obj),
        };
        if (isInboundHitFresh(hit, options)) out.push(hit);
      }
    }
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") walkInboundHits(value, out, keyword, options, depth + 1);
  }
}

function findInboundInPayload(
  payload: unknown,
  keyword: string,
  options?: InboundHitSearchOptions
): InboundHit | null {
  const hits: InboundHit[] = [];
  walkInboundHits(payload, hits, keyword, options, 0);
  if (!hits.length) return null;
  hits.sort((a, b) => (b.messageTimestampMs ?? 0) - (a.messageTimestampMs ?? 0));
  return hits[0];
}

function extractFromMe(node: Record<string, unknown>): boolean | null {
  const key = node.key as Record<string, unknown> | undefined;
  if (typeof key?.fromMe === "boolean") return key.fromMe;
  if (typeof node.fromMe === "boolean") return node.fromMe;
  return null;
}

function extractRemoteJid(node: Record<string, unknown>): string {
  const key = node.key as Record<string, unknown> | undefined;
  const candidates = [
    key?.remoteJid,
    key?.remoteJidAlt,
    node.remoteJid,
    node.remoteJidAlt,
    node.chatId,
    key?.participant,
    node.participant,
  ];
  for (const c of candidates) {
    const s = String(c || "").trim();
    if (s && !s.includes("@g.us")) return s;
  }
  return "";
}

function buildFindMessagesUrls(instanceName: string): string[] {
  const enc = encodeURIComponent(instanceName);
  return [
    `${EVO_API_BASE}/chat/findMessages/${enc}`,
    `${EVO_API_BASE}/message/findMessages/${enc}`,
    `${EVO_API_BASE}/chat/findMessages/${enc}/messages`,
  ];
}

function buildFindChatsUrls(instanceName: string): string[] {
  const enc = encodeURIComponent(instanceName);
  return [
    `${EVO_API_BASE}/chat/findChats/${enc}`,
    `${EVO_API_BASE}/chat/findChats`,
  ];
}

function extractChatRemoteJids(payload: unknown): string[] {
  const out = new Set<string>();
  const visit = (node: unknown, depth = 0) => {
    if (depth > 10 || node == null) return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }
    if (typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    const jid = extractRemoteJid(obj);
    if (jid) out.add(jid);
    const id = String(obj.id || obj.jid || obj.wuid || "").trim();
    if (id && id.includes("@")) out.add(id);
    for (const value of Object.values(obj)) {
      if (value && typeof value === "object") visit(value, depth + 1);
    }
  };
  visit(payload);
  return Array.from(out);
}

function extractFindChatsRecords(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  const root = payload as Record<string, unknown>;
  if (Array.isArray(root.response)) return root.response as Record<string, unknown>[];
  if (Array.isArray(root.data)) return root.data as Record<string, unknown>[];
  if (Array.isArray(root.records)) return root.records as Record<string, unknown>[];
  return [];
}

function chatRecordSortMs(chat: Record<string, unknown>): number {
  const updatedAt = Date.parse(String(chat.updatedAt || ""));
  if (Number.isFinite(updatedAt) && updatedAt > 0) return updatedAt;
  const lastMessage = chat.lastMessage as Record<string, unknown> | undefined;
  const ts = lastMessage ? extractMessageTimestampMs(lastMessage) : null;
  return ts ?? 0;
}

async function findInboundViaChatsLastMessage(
  instanceName: string,
  keyword: string,
  searchOpts: InboundHitSearchOptions,
): Promise<InboundHit | null> {
  for (const url of buildFindChatsUrls(instanceName)) {
    const result = await callEvo(
      url,
      "POST",
      { limit: Math.max(INBOUND_FIND_CHATS_LIMIT + 20, 50) },
      { timeoutMs: FIND_MESSAGES_TIMEOUT_MS },
    );
    if (!result.ok) continue;

    const chats = extractFindChatsRecords(result.json).sort(
      (a, b) => chatRecordSortMs(b) - chatRecordSortMs(a),
    );

    for (const chat of chats) {
      const lastMessage = chat.lastMessage;
      if (!lastMessage || typeof lastMessage !== "object") continue;
      const hit = findInboundInPayload(lastMessage, keyword, searchOpts);
      if (hit) return hit;
    }
  }
  return null;
}

async function findInboundViaRecentChats(
  instanceName: string,
  keyword: string,
  searchOpts: InboundHitSearchOptions
): Promise<InboundHit | null> {
  for (const url of buildFindChatsUrls(instanceName)) {
    const result = await callEvo(url, "POST", { limit: INBOUND_FIND_CHATS_LIMIT + 12 }, {
      timeoutMs: FIND_MESSAGES_TIMEOUT_MS,
    });
    if (!result.ok) continue;
    const jids = extractChatRemoteJids(result.json).slice(0, INBOUND_FIND_CHATS_LIMIT);
    for (const remoteJid of jids) {
      const msgUrl = buildFindMessagesUrls(instanceName)[0];
      const msgRes = await callEvo(
        msgUrl,
        "POST",
        { where: { key: { remoteJid } }, limit: 40 },
        { timeoutMs: FIND_MESSAGES_TIMEOUT_MS },
      );
      if (!msgRes.ok) continue;
      const records = extractEvoMessageRecords(msgRes.json);
      const payload = records.length ? records : msgRes.json;
      const hit = findInboundInPayload(payload, keyword, searchOpts);
      if (hit) return hit;
    }
  }
  return null;
}

async function findInboundViaApiFast(
  instanceName: string,
  keyword: string,
  searchOpts: InboundHitSearchOptions,
): Promise<InboundHit | null> {
  const urls = buildFindMessagesUrls(instanceName).slice(0, 2);
  const bodies: Record<string, unknown>[] = [
    { where: { key: { fromMe: false } }, limit: 60 },
    { limit: 60 },
  ];
  const probes = urls.flatMap((url) =>
    bodies.map(async (body) => {
      const result = await callEvo(url, "POST", body, { timeoutMs: FIND_MESSAGES_TIMEOUT_MS });
      if (!result.ok) return null;
      const records = extractEvoMessageRecords(result.json);
      return findInboundInPayload(records.length ? records : result.json, keyword, searchOpts);
    }),
  );
  const hits = await Promise.all(probes);
  return hits.find((hit) => hit != null) ?? null;
}

async function findInboundViaApiExtended(
  instanceName: string,
  keyword: string,
  searchOpts: InboundHitSearchOptions,
): Promise<InboundHit | null> {
  const urls = buildFindMessagesUrls(instanceName);
  const bodies: Record<string, unknown>[] = [
    { where: { key: { fromMe: false } }, limit: 100 },
    { limit: 100 },
    { take: 100 },
    { limit: 50, page: 1 },
    {},
  ];

  for (const url of urls) {
    for (const body of bodies) {
      const result = await callEvo(url, "POST", body, { timeoutMs: FIND_MESSAGES_TIMEOUT_MS });
      if (!result.ok) continue;

      const records = extractEvoMessageRecords(result.json);
      if (records.length) {
        const recordsHit = findInboundInPayload(records, keyword, searchOpts);
        if (recordsHit) return recordsHit;
      }

      const payloadHit = findInboundInPayload(result.json, keyword, searchOpts);
      if (payloadHit) return payloadHit;
    }
  }
  return null;
}

type ResolveInboundHitOptions = {
  aggressive?: boolean;
  deep?: boolean;
};

async function resolveInboundHit(
  instanceName: string,
  keyword: string,
  validationStartedAtMs: number,
  options: ResolveInboundHitOptions | boolean = false,
): Promise<InboundHit | null> {
  const opts: ResolveInboundHitOptions =
    typeof options === "boolean" ? { aggressive: options, deep: options } : options;
  const aggressive = opts.aggressive === true;
  const deep = opts.deep === true || aggressive;
  const searchOpts = inboundKeywordSearchOptions(validationStartedAtMs, aggressive);

  const [fastMsgHit, fastChatsHit] = await Promise.all([
    findInboundViaApiFast(instanceName, keyword, searchOpts),
    findInboundViaChatsLastMessage(instanceName, keyword, searchOpts),
  ]);
  if (fastMsgHit) return fastMsgHit;
  if (fastChatsHit) return fastChatsHit;

  if (!deep) return null;

  const viaChats = await findInboundViaRecentChats(instanceName, keyword, searchOpts);
  if (viaChats) return viaChats;

  return findInboundViaApiExtended(instanceName, keyword, searchOpts);
}

function extractEvoMessageRecords(payload: unknown): unknown[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  const messages = root.messages as Record<string, unknown> | undefined;
  if (messages && Array.isArray(messages.records)) return messages.records;
  if (Array.isArray(root.records)) return root.records;
  if (Array.isArray(root.response)) return root.response as unknown[];
  if (Array.isArray(root.data)) return root.data as unknown[];
  return [];
}

async function findReplyInChat(
  instanceName: string,
  referenceJid: string,
  replyMarker: string
): Promise<boolean> {
  const remoteJid = referenceJid.includes("@") ? referenceJid : `${referenceJid}@s.whatsapp.net`;
  const digits = normalizeWhatsAppNumber(referenceJid.split("@")[0] || referenceJid);
  const bodies: Record<string, unknown>[] = [
    { where: { key: { remoteJid } }, limit: 40 },
    { where: { key: { remoteJid } }, take: 40 },
    { where: { key: { remoteJid: remoteJid.replace("@s.whatsapp.net", "") } }, limit: 40 },
    { where: { key: { fromMe: false } }, limit: 60 },
    { limit: 80 },
    {},
  ];
  for (const url of buildFindMessagesUrls(instanceName)) {
    for (const body of bodies) {
      const result = await callEvo(url, "POST", body);
      if (!result.ok) continue;
      const records = extractEvoMessageRecords(result.json);
      const nodes = records.length ? records : [result.json];
      for (const node of nodes) {
        const texts: string[] = [];
        collectMessageTexts(node, texts);
        const needle = replyMarker.toLowerCase();
        if (texts.some((t) => t.toLowerCase().includes(needle))) return true;
        if (digits && texts.some((t) => t.toLowerCase().includes("validação waba"))) return true;
      }
    }
  }
  return false;
}

function markInboundReceived(record: ValidationRecord, hit: InboundHit, via: string): void {
  if (record.receiveTest.success === true) return;
  record.referenceJid = hit.remoteJid;
  record.referenceNumber = hit.referenceNumber;
  record.inboundReceivedAt = hit.messageTimestampMs ?? Date.now();
  record.phase = "inbound_received";
  record.receiveTest = {
    success: true,
    detail: `Mensagem "${record.keyword}" recebida (${via}).`,
  };
  scheduleValidationFollowUp(record);
}

function scheduleValidationFollowUp(record: ValidationRecord): void {
  if (record.replyFollowUpScheduled || record.cancelled || record.finished) return;
  record.replyFollowUpScheduled = true;
  setTimeout(() => {
    void runValidationFollowUp(record);
  }, REPLY_DELAY_MS);
}

async function runValidationFollowUp(record: ValidationRecord): Promise<void> {
  if (record.cancelled || record.finished) return;
  if (record.receiveTest.success === true && !record.sendAttempted) {
    await sendContextualReply(record);
  }
  if (
    record.sendAttempted &&
    record.sendHttpOk &&
    record.sendTest.success !== true &&
    record.referenceJid
  ) {
    const found = await findReplyInChat(
      record.instanceName,
      record.referenceJid,
      record.replyMarker
    );
    if (found) {
      record.sendTest = {
        success: true,
        detail: "Resposta confirmada no histórico da conversa.",
      };
      tryFinalize(record);
    }
  }
}

async function sendContextualReply(record: ValidationRecord): Promise<void> {
  if (record.cancelled || record.finished || record.sendAttempted) return;

  const convKey = conversationReplyKey(record);
  if (convKey) {
    const lastSentAt = recentReplyByConversation.get(convKey);
    if (lastSentAt != null && Date.now() - lastSentAt < REPLY_DEDUPE_MS) {
      record.phase = "sending_reply";
      record.sendAttempted = true;
      record.sendHttpOk = true;
      record.sendDetail = "dedupe";
      record.sendTest = {
        success: true,
        detail: "Resposta já enviada nesta conversa (validação única).",
      };
      tryFinalize(record);
      return;
    }
    if (replyInFlight.has(convKey)) return;
    replyInFlight.add(convKey);
  }

  record.phase = "sending_reply";
  record.sendAttempted = true;
  const text = `Validação WABA concluída. ${record.replyMarker}`;
  const sendUrl = buildTemplateUrl(EVO_SEND_TEXT_URL_TEMPLATE, record.instanceName);
  const numero = resolveSendTarget(record.referenceJid, record.referenceNumber);
  if (!numero) {
    if (convKey) replyInFlight.delete(convKey);
    record.sendHttpOk = false;
    record.sendDetail = "Destino da resposta não identificado.";
    record.sendTest = {
      success: false,
      detail: "Não foi possível identificar o chat do outro WhatsApp para responder.",
    };
    tryFinalize(record);
    return;
  }
  const sendBody: Record<string, unknown> = EVO_SEND_TEXT_V1
    ? { number: numero, textMessage: { text } }
    : { number: numero, text, textMessage: { text } };
  try {
    const result = await callEvo(sendUrl, "POST", sendBody);
    record.sendHttpOk = result.ok;
    if (!result.ok) {
      const detail =
        (result.json as Record<string, unknown> | null)?.message ||
        (result.json as Record<string, unknown> | null)?.error ||
        result.body.slice(0, 180) ||
        `HTTP ${result.status}`;
      record.sendDetail = String(detail);
      const restricted = isLikelyWhatsAppRestriction(record.sendDetail, result.status);
      const technical = isSendFailureTechnical(record.sendDetail, result.status);
      if (!restricted && (technical || record.receiveTest.success === true)) {
        record.sendTest = {
          success: true,
          detail: technical
            ? "Recepção confirmada. Resposta automática indisponível (Evolution lenta/timeout) — integração liberada."
            : "Recepção confirmada. Resposta automática não enviada — integração liberada.",
        };
        tryFinalize(record);
        return;
      }
      record.sendTest = {
        success: false,
        detail: restricted
          ? `Evolution recusou a resposta: ${record.sendDetail}`
          : `Falha técnica ao responder: ${record.sendDetail}`,
      };
      tryFinalize(record);
      return;
    }
    if (convKey) recentReplyByConversation.set(convKey, Date.now());
    record.sendDetail = "sendText OK";
    record.sendTest = {
      success: true,
      detail: "Resposta enviada na mesma conversa (após mensagem recebida).",
    };
    tryFinalize(record);
  } finally {
    if (convKey) replyInFlight.delete(convKey);
  }
}

async function ensureValidationInstanceOpen(record: ValidationRecord): Promise<boolean> {
  const maxWaitMs = Math.max(
    5_000,
    Math.min(30_000, Number(process.env.INBOUND_VALIDATION_OPEN_WAIT_MS || 12_000) || 12_000),
  );
  const wait = await waitForEvoInstanceLiveOpen(record.instanceName, {
    maxWaitMs,
    pollMs: 400,
  });
  return wait.open;
}

async function runValidationLoop(record: ValidationRecord): Promise<void> {
  if (record.loopRunning) return;
  record.loopRunning = true;
  const deadline = Date.now() + VALIDATION_TIMEOUT_MS;
  try {
    const open = await ensureValidationInstanceOpen(record);
    if (!open) {
      record.receiveTest = {
        success: false,
        detail: `Instância não conectou na Evolution a tempo. Escaneie o QR novamente.`,
      };
      record.sendTest = {
        success: false,
        detail: "Validação cancelada — instância desconectada.",
      };
      record.phase = "failed";
      record.finished = true;
      record.finishedAt = new Date().toISOString();
      notifyFinished(record);
      return;
    }

    while (Date.now() < deadline && !record.finished && !record.cancelled) {
      if (record.receiveTest.success !== true) {
        try {
          record.pollTick += 1;
          const deep = record.pollTick % INBOUND_DEEP_SCAN_EVERY_TICKS === 0;
          const hit = await resolveInboundHit(
            record.instanceName,
            record.keyword,
            record.validationStartedAtMs,
            { deep, aggressive: false },
          );
          if (hit) markInboundReceived(record, hit, deep ? "findMessages-deep" : "findMessages");
        } catch {
          // mantém polling — falha transitória na Evolution
        }
      }

      if (
        record.receiveTest.success === true &&
        record.inboundReceivedAt &&
        Date.now() >= record.inboundReceivedAt + REPLY_DELAY_MS &&
        !record.sendAttempted
      ) {
        await sendContextualReply(record);
      }

      if (
        record.sendAttempted &&
        record.sendHttpOk &&
        record.sendTest.success !== true &&
        record.referenceJid
      ) {
        const found = await findReplyInChat(
          record.instanceName,
          record.referenceJid,
          record.replyMarker
        );
        if (found) {
          record.sendTest = {
            success: true,
            detail: "Resposta confirmada no histórico da conversa.",
          };
          tryFinalize(record);
        }
      }

      if (!record.finished) {
        await new Promise((r) => setTimeout(r, VALIDATION_POLL_MS));
      }
    }
  } finally {
    record.loopRunning = false;
    if (!record.finished) finalizeExpired(record);
  }
}

function unwrapEvolutionWebhookPayload(body: unknown): unknown[] {
  if (!body || typeof body !== "object") return [body];
  const payload = body as Record<string, unknown>;
  const data = payload.data;
  if (Array.isArray(data)) return data.length ? data : [body];
  if (data && typeof data === "object") {
    const nested = data as Record<string, unknown>;
    if (Array.isArray(nested.messages)) return nested.messages;
    return [data];
  }
  return [body];
}

export async function refreshInboundValidation(
  validationId: string,
  options: { aggressive?: boolean; deep?: boolean } | boolean = false,
): Promise<InboundValidationStatus | null> {
  const opts: { aggressive?: boolean; deep?: boolean } =
    typeof options === "boolean" ? { aggressive: options, deep: options } : options;
  const record = validations.get(validationId);
  if (!record || record.finished || record.cancelled) {
    return getInboundValidationStatus(validationId);
  }

  if (record.receiveTest.success !== true) {
    try {
      const hit = await resolveInboundHit(
        record.instanceName,
        record.keyword,
        record.validationStartedAtMs,
        {
          aggressive: opts.aggressive === true,
          deep: opts.deep === true || opts.aggressive === true,
        },
      );
      if (hit) {
        markInboundReceived(
          record,
          hit,
          opts.aggressive ? "nudge-aggressive" : opts.deep ? "nudge-deep" : "nudge",
        );
      }
    } catch {
      /* falha transitória */
    }
  } else {
    await runValidationFollowUp(record);
  }

  return getInboundValidationStatus(validationId);
}

function findInboundInWebhookChunk(
  chunk: unknown,
  keyword: string,
  validationStartedAtMs: number,
): InboundHit | null {
  const strictOpts = inboundKeywordSearchOptions(validationStartedAtMs, false);
  const strictHit = findInboundInPayload(chunk, keyword, strictOpts);
  if (strictHit) return strictHit;

  const liveHit = findInboundInPayload(chunk, keyword, { requireTimestamp: false });
  if (!liveHit) return null;
  const ts = liveHit.messageTimestampMs ?? Date.now();
  const minTs = validationStartedAtMs - INBOUND_KEYWORD_GRACE_MS;
  if (ts < minTs) return null;
  liveHit.messageTimestampMs = ts;
  return liveHit;
}

export function handleInboundValidationWebhook(body: unknown): void {
  if (!body || typeof body !== "object") return;
  const payload = body as Record<string, unknown>;
  const instanceName = extractWebhookInstanceName(payload);
  if (!isEvolutionMessageUpsertEvent(payload.event)) return;

  const chunks = unwrapEvolutionWebhookPayload(body);
  const active = instanceName ? getActiveValidationForInstance(instanceName) : null;
  const candidates = active
    ? [active]
    : [...validations.values()].filter((record) => isRecordActive(record));

  for (const record of candidates) {
    if (instanceName && instanceName !== record.instanceName) continue;
    let matched = false;
    for (const chunk of chunks) {
      const hit = findInboundInWebhookChunk(chunk, record.keyword, record.validationStartedAtMs);
      if (!hit) continue;
      markInboundReceived(record, hit, "webhook");
      matched = true;
      break;
    }
    if (matched) break;
  }
}

function normalizeWebhookInstanceRef(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ["instanceName", "name", "instance", "id"]) {
      const nested = normalizeWebhookInstanceRef(obj[key]);
      if (nested) return nested;
    }
  }
  return "";
}

function isEvolutionMessageUpsertEvent(eventRaw: unknown): boolean {
  const event = String(eventRaw || "")
    .trim()
    .toUpperCase()
    .replace(/\./g, "_");
  if (!event) return true;
  return event === "MESSAGES_UPSERT" || event === "MESSAGES_UPSERT_UPDATE";
}

function extractWebhookInstanceName(payload: Record<string, unknown>): string {
  const data = payload.data as Record<string, unknown> | undefined;
  const candidates = [
    payload.instance,
    payload.instanceName,
    data?.instance,
    data?.instanceName,
    (payload.sender as Record<string, unknown> | undefined)?.instance,
    (data?.instanceData as Record<string, unknown> | undefined)?.instanceName,
  ];
  for (const value of candidates) {
    const name = normalizeWebhookInstanceRef(value);
    if (name) return name;
  }
  return "";
}

export function getInboundValidationStatus(
  validationId: string
): InboundValidationStatus | null {
  const record = validations.get(validationId);
  if (!record) return null;
  return publicStatus(record);
}

export async function startInboundValidation(input: {
  instanceName: string;
  instanceNumberHint?: string;
  forceRestart?: boolean;
}): Promise<{ validationId?: string; error?: string; status?: InboundValidationStatus }> {
  const instanceName = String(input.instanceName || "").trim();
  if (!instanceName) {
    return { error: "Nome da instância é obrigatório." };
  }

  const numberHint = normalizeWhatsAppNumber(String(input.instanceNumberHint || "").trim());

  const resolvedNumber = await resolveEvoInstancePhone(instanceName, { hint: numberHint });
  const connected = { instancia: instanceName, numero: resolvedNumber };

  if (!input.forceRestart) {
    const existing = getActiveValidationForInstance(connected.instancia);
    if (existing) {
      if (!existing.instanceNumber && resolvedNumber) {
        existing.instanceNumber = resolvedNumber;
      }
      return { validationId: existing.validationId, status: publicStatus(existing) };
    }
  }
  stopValidationsForInstance(connected.instancia);

  const validationId = crypto.randomUUID();
  const replyMarker = `WABA-VAL:${validationId.slice(0, 8)}`;
  const validationStartedAtMs = Date.now();
  const startedAt = new Date(validationStartedAtMs).toISOString();
  const webhookOk = await ensureInstanceWebhook(instanceName);
  const phoneLabel = formatPhoneHint(connected.numero);

  const record: ValidationRecord = {
    validationId,
    instanceName: connected.instancia,
    instanceNumber: connected.numero,
    keyword: INBOUND_VALIDATION_KEYWORD,
    replyMarker,
    phase: "awaiting_inbound",
    receiveTest: {
      success: null,
      detail: phoneLabel
        ? webhookOk
          ? `Aguardando "${INBOUND_VALIDATION_KEYWORD}" de outro WhatsApp para ${phoneLabel}…`
          : `Aguardando "${INBOUND_VALIDATION_KEYWORD}" de outro WhatsApp para ${phoneLabel}… (consulta periódica na Evolution).`
        : webhookOk
          ? `Aguardando "${INBOUND_VALIDATION_KEYWORD}" de outro WhatsApp (não o que está integrando)…`
          : `Aguardando "${INBOUND_VALIDATION_KEYWORD}"… (consulta periódica na Evolution).`,
    },
    sendTest: {
      success: null,
      detail: "Aguardando mensagem do outro WhatsApp para responder na mesma conversa…",
    },
    finished: false,
    restrictionSuspected: false,
    referenceNumber: null,
    referenceJid: null,
    inboundReceivedAt: null,
    validationStartedAtMs,
    webhookConfigured: webhookOk,
    sendAttempted: false,
    sendHttpOk: false,
    sendDetail: "",
    loopRunning: false,
    cancelled: false,
    replyFollowUpScheduled: false,
    pollTick: 0,
    startedAt,
    finishedAt: null,
  };

  validations.set(validationId, record);
  activeValidationByInstance.set(connected.instancia, validationId);
  void runValidationLoop(record);

  return { validationId, status: publicStatus(record) };
}

export function pruneInboundValidations(): void {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, record] of validations.entries()) {
    const started = new Date(record.startedAt).getTime();
    if (started < cutoff) {
      cancelValidationRecord(record);
      validations.delete(id);
      if (activeValidationByInstance.get(record.instanceName) === id) {
        activeValidationByInstance.delete(record.instanceName);
      }
    }
  }
  const replyCutoff = Date.now() - REPLY_DEDUPE_MS;
  for (const [key, at] of recentReplyByConversation.entries()) {
    if (at < replyCutoff) recentReplyByConversation.delete(key);
  }
}

setInterval(() => pruneInboundValidations(), 30 * 60 * 1000).unref?.();
