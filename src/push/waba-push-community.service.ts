import { existsSync, readFileSync } from "node:fs";
import { evoHttpRequest } from "../evo-http.client";
import { resolveDataFile } from "../data-path";
import { BASE_PATH } from "../base-path";
import { resolveEvoInstanceKey } from "../instances/evo-instance-key";
import { resolveWabaPublicBaseUrl } from "../lib/waba-public-base-url";
import { readPushMediaBase64 } from "./waba-push-media.service";
import { WabaPushRepository } from "./waba-push.repository";
import type { WabaPushImageAttachment, WabaPushConfig } from "./waba-push.types";
import {
  resolveDefaultPushCommunityEvoInstance,
  resolvePushCommunityEvoInstanceFallbacks,
} from "./waba-push.types";

const EVO_API_BASE = String(process.env.EVO_API_URL || "").replace(/\/+$/, "");
const EVO_API_KEY = process.env.EVO_API_KEY || "";
const EVO_INSTANCES_URL =
  String(process.env.EVO_INSTANCES_URL || "").trim() ||
  `${EVO_API_BASE}/instance/fetchInstances`;
const PUSH_COMMUNITY_PHONE_HINT = String(
  process.env.WABA_PUSH_COMMUNITY_PHONE_HINT || "5181077770",
).trim();
const PUSH_COMMUNITY_JID_ENV = String(
  process.env.WABA_PUSH_COMMUNITY_ANNOUNCEMENT_GROUP_JID || "",
).trim();
const EVO_SEND_TEXT_URL_TEMPLATE =
  process.env.EVO_SEND_TEXT_URL_TEMPLATE || `${EVO_API_BASE}/message/sendText/{instance}`;
const EVO_SEND_MEDIA_URL_TEMPLATE =
  process.env.EVO_SEND_MEDIA_URL_TEMPLATE || `${EVO_API_BASE}/message/sendMedia/{instance}`;
const PUSH_COMMUNITY_PROBE_MAX = 3;
const PUSH_COMMUNITY_GROUP_FETCH_TIMEOUT_MS = 15000;
const PUSH_COMMUNITY_SEND_MEDIA_TIMEOUT_MS = 60_000;
/** Base64 inline só para imagens pequenas — payload grande derruba conexão com a Evolution. */
const PUSH_COMMUNITY_MEDIA_INLINE_BASE64_MAX_CHARS = 400_000;
const PUSH_COMMUNITY_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const PUSH_COMMUNITY_SEND_MEDIA_RETRIES = 2;
const PUSH_COMMUNITY_INSTANCE_SEND_MAX = 3;
const EVO_SEND_TEXT_V1 =
  process.env.EVO_SEND_TEXT_V1 === "1" || process.env.EVO_SEND_TEXT_V1 === "true";

const pushRepository = new WabaPushRepository();

function buildTemplateUrl(template: string, instanceName: string): string {
  return String(template || "").replace(/\{instance\}/gi, encodeURIComponent(instanceName));
}

function parseGroupsPayload(raw: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if (Array.isArray(record.response)) return record.response as Array<Record<string, unknown>>;
    if (Array.isArray(record.data)) return record.data as Array<Record<string, unknown>>;
    if (Array.isArray(record.groups)) return record.groups as Array<Record<string, unknown>>;
  }
  return [];
}

function isTruthyFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  return text === "true" || text === "1" || text === "yes";
}

function pickAnnouncementGroupJid(groups: Array<Record<string, unknown>>): string {
  for (const group of groups) {
    if (
      isTruthyFlag(group.isCommunityAnnounce) ||
      isTruthyFlag(group.isCommunityAnnouncement) ||
      isTruthyFlag(group.announce) ||
      isTruthyFlag(group.announcement)
    ) {
      const jid = String(group.id || group.jid || group.groupJid || "").trim();
      if (jid.includes("@g.us")) return jid;
    }
  }
  for (const group of groups) {
    const jid = String(group.id || group.jid || group.groupJid || "").trim();
    const subject = String(group.subject || group.name || "").toLowerCase();
    if (jid.includes("@g.us") && subject.includes("anúncio")) return jid;
  }
  return "";
}

function parseEvoInstancesList(raw: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if (Array.isArray(record.response)) return record.response as Array<Record<string, unknown>>;
    if (Array.isArray(record.data)) return record.data as Array<Record<string, unknown>>;
    if (Array.isArray(record.instances)) return record.instances as Array<Record<string, unknown>>;
  }
  return raw ? [raw as Record<string, unknown>] : [];
}

function loadEvoInstancesFromCache(): string[] {
  try {
    const filePath = resolveDataFile("evo-instances-cache.json");
    if (!existsSync(filePath)) return [];
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as {
      items?: Array<Record<string, unknown>>;
    };
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    return items
      .map((row) => resolveEvoInstanceKey(row) || String(row?.name || "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function uniqueInstanceNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const trimmed = String(name || "").trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function isEvoInstanceMissingError(result: { status: number; body?: string; json?: unknown | null }): boolean {
  if (result.status !== 404) return false;
  const text = `${String(result.body || "")} ${JSON.stringify(result.json ?? "")}`.toLowerCase();
  return text.includes("does not exist") || text.includes("not found") || text.includes("instance");
}

function describeEvoError(result: { status: number; body?: string; json?: unknown | null; error?: string }): string {
  return `${String(result.body || result.error || "")} ${JSON.stringify(result.json ?? "")}`.toLowerCase();
}

/** Evolution instável (404 instância ou 500 Prisma/integrationSession) — tentar outra instância ou probe. */
function isEvoGroupListRecoverableError(result: {
  status: number;
  body?: string;
  json?: unknown | null;
  error?: string;
}): boolean {
  if (isEvoInstanceMissingError(result)) return true;
  if (result.status >= 500) return true;
  const text = describeEvoError(result);
  return (
    text.includes("integrationsession") ||
    text.includes("prismaclient") ||
    text.includes("internal server error")
  );
}

async function recoverAnnouncementGroupAfterEvoFailure(
  instanceName: string,
  config: WabaPushConfig,
): Promise<{ jid: string; instanceName: string } | null> {
  const preferred = String(instanceName || "").trim();
  if (config.communityEvoInstance.toLowerCase() === preferred.toLowerCase()) {
    pushRepository.writeConfig({
      ...config,
      communityAnnouncementGroupJid: "",
    });
  }

  const resolved = await resolvePushCommunityEvoInstance(preferred).catch(() => "");
  if (resolved && resolved.toLowerCase() !== preferred.toLowerCase()) {
    try {
      return await fetchAnnouncementGroupJid(resolved, false);
    } catch {
      /* continua probe */
    }
  }

  const discovered = await discoverPushCommunityInstanceWithGroups(preferred);
  if (!discovered) return null;

  pushRepository.writeConfig({
    ...pushRepository.readConfig(),
    communityEvoInstance: discovered.instanceName,
    communityAnnouncementGroupJid: discovered.jid,
  });
  console.info(
    `[push] comunidade recuperada após falha Evolution: instância "${discovered.instanceName}", jid ${discovered.jid}`,
  );
  return discovered;
}

function extractEvoInstanceNumber(inst: Record<string, unknown>): string {
  const raw =
    inst.ownerJid ??
    inst.owner ??
    inst.number ??
    inst.phone ??
    inst.ownerNumber ??
    (inst.profile as Record<string, unknown> | undefined)?.owner ??
    "";
  const text = String(raw).trim();
  if (!text) return "";
  if (text.includes("@")) return text.split("@")[0].replace(/\D/g, "");
  return text.replace(/\D/g, "");
}

function scorePushCommunityInstance(name: string, preferred: string, numberDigits = ""): number {
  const lower = name.toLowerCase();
  const prefLower = preferred.toLowerCase();
  const hint = PUSH_COMMUNITY_PHONE_HINT.replace(/\D/g, "");
  if (!lower && !numberDigits) return 0;
  if (lower && lower === prefLower) return 100;
  if (hint && numberDigits.includes(hint)) return 98;
  if (hint && lower.includes(hint)) return 92;
  if (lower.includes("drax sistemas") && /\d{8,}/.test(lower)) return 90;
  if (prefLower && lower.includes(prefLower)) return 88;
  if (lower.includes("drax sistemas")) return 82;
  if (lower.includes("drax")) return 72;
  if (lower === "drax-oficial" && hint && numberDigits.endsWith(hint)) return 97;
  if (lower === "walkup") return 62;
  return 0;
}

type EvoCatalogRow = {
  name: string;
  number: string;
  connectionStatus: string;
  isOpen: boolean;
};

function extractConnectionStatus(row: Record<string, unknown>): string {
  return String(row.connectionStatus ?? row.status ?? "").trim();
}

function isEvoInstanceOpen(row: Record<string, unknown>): boolean {
  const status = extractConnectionStatus(row).toLowerCase();
  return status.includes("open") || status === "connected";
}

async function fetchEvoInstanceCatalog(): Promise<EvoCatalogRow[]> {
  const catalog = new Map<string, EvoCatalogRow>();
  for (const name of resolvePushCommunityEvoInstanceFallbacks()) {
    const trimmed = String(name || "").trim();
    if (trimmed) {
      catalog.set(trimmed.toLowerCase(), {
        name: trimmed,
        number: "",
        connectionStatus: "",
        isOpen: false,
      });
    }
  }
  if (EVO_API_BASE && EVO_API_KEY) {
    const result = await evoHttpRequest(EVO_INSTANCES_URL, "GET", {
      apiKey: EVO_API_KEY,
      retries: 2,
      timeoutMs: 20000,
    });
    if (result.ok) {
      for (const row of parseEvoInstancesList(result.json)) {
        const name = resolveEvoInstanceKey(row);
        if (!name) continue;
        catalog.set(name.toLowerCase(), {
          name,
          number: extractEvoInstanceNumber(row),
          connectionStatus: extractConnectionStatus(row),
          isOpen: isEvoInstanceOpen(row),
        });
      }
    }
  }
  for (const name of loadEvoInstancesFromCache()) {
    const trimmed = String(name || "").trim();
    if (!trimmed || catalog.has(trimmed.toLowerCase())) continue;
    catalog.set(trimmed.toLowerCase(), {
      name: trimmed,
      number: "",
      connectionStatus: "",
      isOpen: false,
    });
  }
  return Array.from(catalog.values());
}

async function fetchEvoInstanceNames(): Promise<string[]> {
  const catalog = await fetchEvoInstanceCatalog();
  return uniqueInstanceNames(catalog.map((row) => row.name));
}

async function probeAnnouncementGroupForInstance(
  instanceName: string,
): Promise<{ instanceName: string; jid: string } | null> {
  const url = `${EVO_API_BASE}/group/fetchAllGroups/${encodeURIComponent(instanceName)}?getParticipants=false`;
  const result = await evoHttpRequest(url, "GET", {
    apiKey: EVO_API_KEY,
    timeoutMs: PUSH_COMMUNITY_GROUP_FETCH_TIMEOUT_MS,
    retries: 0,
  });
  if (!result.ok) return null;
  const jid = pickAnnouncementGroupJid(parseGroupsPayload(result.json));
  if (!jid) return null;
  return { instanceName, jid };
}

async function discoverPushCommunityInstanceWithGroups(
  preferred: string,
): Promise<{ instanceName: string; jid: string } | null> {
  const catalog = await fetchEvoInstanceCatalog();
  const ranked = catalog
    .map((row) => ({
      name: row.name,
      score: scorePushCommunityInstance(row.name, preferred, row.number),
    }))
    .sort((a, b) => b.score - a.score);
  const tryOrder = uniqueInstanceNames([
    ...ranked.filter((row) => row.score > 0).map((row) => row.name),
    ...ranked.filter((row) => row.score <= 0).map((row) => row.name),
  ]).slice(0, PUSH_COMMUNITY_PROBE_MAX);
  for (const name of tryOrder) {
    const hit = await probeAnnouncementGroupForInstance(name);
    if (hit) return hit;
  }
  return null;
}

async function resolvePushCommunityEvoInstance(configured: string): Promise<string> {
  const preferred = String(configured || resolveDefaultPushCommunityEvoInstance()).trim();
  const catalog = await fetchEvoInstanceCatalog();
  const names = catalog.map((row) => row.name);

  const exact = names.find((name) => name.toLowerCase() === preferred.toLowerCase());
  if (exact) return exact;

  if (!names.length) {
    throw new Error(
      `Não foi possível listar instâncias na Evolution. Configure WABA_PUSH_COMMUNITY_EVO_INSTANCE no .env (ex.: Drax Sistemas 5181077770).`,
    );
  }

  let best = preferred;
  let bestScore = 0;
  for (const row of catalog) {
    const score = scorePushCommunityInstance(row.name, preferred, row.number);
    if (score > bestScore) {
      bestScore = score;
      best = row.name;
    }
  }

  if (bestScore <= 0) {
    throw new Error(
      `Instância "${preferred}" não existe na Evolution. Disponíveis: ${names.slice(0, 8).join(", ")}. Configure WABA_PUSH_COMMUNITY_EVO_INSTANCE no .env.`,
    );
  }

  if (best !== preferred) {
    const hint = PUSH_COMMUNITY_PHONE_HINT.replace(/\D/g, "");
    const preferredDigits = preferred.replace(/\D/g, "");
    const keepPreferredInConfig =
      Boolean(hint) &&
      (preferredDigits.includes(hint) || preferred.toLowerCase().includes(hint));
    if (!keepPreferredInConfig) {
      const config = pushRepository.readConfig();
      pushRepository.writeConfig({
        ...config,
        communityEvoInstance: best,
        communityAnnouncementGroupJid: "",
      });
    }
    console.info(`[push] instância comunidade ajustada automaticamente: "${preferred}" → "${best}"`);
  }

  return best;
}

function resolveAnnouncementGroupJidOverride(): string {
  if (PUSH_COMMUNITY_JID_ENV.includes("@g.us")) return PUSH_COMMUNITY_JID_ENV;
  return "";
}

async function fetchAnnouncementGroupJid(
  instanceName: string,
  allowInstanceResolve = true,
): Promise<{ jid: string; instanceName: string }> {
  const overrideJid = resolveAnnouncementGroupJidOverride();
  if (overrideJid) return { jid: overrideJid, instanceName };

  const config = pushRepository.readConfig();
  if (config.communityAnnouncementGroupJid) {
    return { jid: config.communityAnnouncementGroupJid, instanceName };
  }

  const url = `${EVO_API_BASE}/group/fetchAllGroups/${encodeURIComponent(instanceName)}?getParticipants=false`;
  const result = await evoHttpRequest(url, "GET", {
    apiKey: EVO_API_KEY,
    timeoutMs: PUSH_COMMUNITY_GROUP_FETCH_TIMEOUT_MS,
    retries: 0,
  });
  if (!result.ok) {
    if (allowInstanceResolve && isEvoGroupListRecoverableError(result)) {
      const recovered = await recoverAnnouncementGroupAfterEvoFailure(instanceName, config);
      if (recovered) return recovered;
    }
    throw new Error(
      `Não foi possível listar grupos na Evolution (${result.status}): ${String(result.body || result.error || "").slice(0, 220)}. Configure WABA_PUSH_COMMUNITY_ANNOUNCEMENT_GROUP_JID no Easypanel ou reconecte a instância na Evolution.`,
    );
  }
  const groups = parseGroupsPayload(result.json);
  const jid = pickAnnouncementGroupJid(groups);
  if (!jid) {
    throw new Error(
      "Grupo de Anúncios da comunidade não encontrado. Configure communityAnnouncementGroupJid em waba-push-config.json ou WABA_PUSH_COMMUNITY_ANNOUNCEMENT_GROUP_JID no .env.",
    );
  }
  pushRepository.writeConfig({
    ...config,
    communityEvoInstance: instanceName,
    communityAnnouncementGroupJid: jid,
  });
  return { jid, instanceName };
}

function buildEvoTextBody(number: string, text: string): Record<string, unknown> {
  return EVO_SEND_TEXT_V1
    ? { number, textMessage: { text } }
    : { number, text };
}

function resolvePublicMediaUrl(imageId: string): string {
  const base = resolveWabaPublicBaseUrl().replace(/\/+$/, "");
  const prefix = BASE_PATH ? BASE_PATH.replace(/\/+$/, "") : "";
  return `${base}${prefix}/push/public-media/${encodeURIComponent(imageId)}`;
}

function resolvePushMediaUrlForEvo(imageId: string): string {
  const explicit = String(
    process.env.WABA_PUSH_MEDIA_INTERNAL_BASE_URL || process.env.WABA_INTERNAL_BASE_URL || "",
  )
    .trim()
    .replace(/\/+$/, "");
  const prefix = BASE_PATH ? BASE_PATH.replace(/\/+$/, "") : "";
  const path = `${prefix}/push/public-media/${encodeURIComponent(imageId)}`;

  if (explicit) return `${explicit}${path}`;

  const runtime = String(process.env.RUNTIME_MODE || "production").toLowerCase();
  const wabaEnv = String(process.env.WABA_ENV || "").trim().toLowerCase();
  if (runtime === "production" && wabaEnv !== "v01" && wabaEnv !== "v02") {
    const hostPort = String(process.env.WABA_HOST_PUBLISHED_PORT || "30180").trim();
    if (/^\d+$/.test(hostPort)) {
      return `http://172.17.0.1:${hostPort}${path}`;
    }
  }

  return resolvePublicMediaUrl(imageId);
}

function listPushMediaUrlsForEvo(imageId: string): string[] {
  const prefix = BASE_PATH ? BASE_PATH.replace(/\/+$/, "") : "";
  const path = `${prefix}/push/public-media/${encodeURIComponent(imageId)}`;
  const urls: string[] = [];

  const explicit = String(
    process.env.WABA_PUSH_MEDIA_INTERNAL_BASE_URL || process.env.WABA_INTERNAL_BASE_URL || "",
  )
    .trim()
    .replace(/\/+$/, "");
  if (explicit) urls.push(`${explicit}${path}`);

  const runtime = String(process.env.RUNTIME_MODE || "production").toLowerCase();
  const wabaEnv = String(process.env.WABA_ENV || "").trim().toLowerCase();
  if (runtime === "production" && wabaEnv !== "v01" && wabaEnv !== "v02") {
    const hostPort = String(process.env.WABA_HOST_PUBLISHED_PORT || "30180").trim();
    if (/^\d+$/.test(hostPort)) {
      urls.push(`http://172.17.0.1:${hostPort}${path}`);
    }
  }

  urls.push(resolvePublicMediaUrl(imageId));
  return Array.from(new Set(urls.filter(Boolean)));
}

function describeEvoMediaError(result: {
  status: number;
  body?: string;
  error?: string;
  json?: unknown | null;
}): string {
  return `${String(result.body || result.error || "")} ${JSON.stringify(result.json ?? "")}`.toLowerCase();
}

function isEvoMediaUrlFetchRecoverableError(result: {
  status: number;
  body?: string;
  error?: string;
  json?: unknown | null;
}): boolean {
  const text = describeEvoMediaError(result);
  return (
    text.includes("401") ||
    text.includes("403") ||
    text.includes("unauthorized") ||
    text.includes("não autenticado") ||
    text.includes("tls") ||
    text.includes("socket disconnected") ||
    text.includes("connection closed") ||
    text.includes("econnreset") ||
    text.includes("etimedout") ||
    text.includes("network") ||
    text.includes("getaddrinfo") ||
    text.includes("certificate") ||
    text.includes("axioserror") ||
    text.includes("media upload failed")
  );
}

function isEvoSendRecoverableError(result: {
  status: number;
  body?: string;
  error?: string;
  json?: unknown | null;
}): boolean {
  if (result.status >= 500) return true;
  if (isEvoMediaUrlFetchRecoverableError(result)) return true;
  const text = describeEvoMediaError(result);
  return text.includes("connection closed") || text.includes("integrationsession");
}

function rankPushCommunityInstances(preferred: string, catalog: EvoCatalogRow[]): string[] {
  const ranked = catalog
    .map((row) => ({
      name: row.name,
      score: scorePushCommunityInstance(row.name, preferred, row.number) + (row.isOpen ? 12 : 0),
    }))
    .sort((a, b) => b.score - a.score);
  const openFirst = ranked.filter((row) => row.score > 0).map((row) => row.name);
  const rest = ranked.filter((row) => row.score <= 0).map((row) => row.name);
  return uniqueInstanceNames([preferred, ...openFirst, ...rest]).slice(
    0,
    PUSH_COMMUNITY_INSTANCE_SEND_MAX,
  );
}

function buildEvoMediaVariants(
  mediaData: { base64: string; mimeType: string },
): string[] {
  const raw = String(mediaData.base64 || "").replace(/\s+/g, "");
  const mime = String(mediaData.mimeType || "image/jpeg").trim() || "image/jpeg";
  const variants = [raw, `data:${mime};base64,${raw}`];
  return Array.from(new Set(variants.filter(Boolean)));
}

function canSendPushCommunityMediaAsBase64(
  image: WabaPushImageAttachment,
  mediaData: { base64: string; mimeType: string },
): boolean {
  const sizeBytes = Number(image.sizeBytes) || 0;
  if (sizeBytes > PUSH_COMMUNITY_MAX_IMAGE_BYTES) return false;
  if (sizeBytes > 0 && sizeBytes <= 300_000) return true;
  return mediaData.base64.length <= PUSH_COMMUNITY_MEDIA_INLINE_BASE64_MAX_CHARS;
}

function buildEvoMediaBodyVariants(
  baseBody: Record<string, unknown>,
  media: string,
): Array<Record<string, unknown>> {
  const withCaption = { ...baseBody, media };
  if (!baseBody.caption) return [withCaption];
  const { caption: _caption, ...rest } = baseBody;
  return [withCaption, { ...rest, media }];
}

async function postPushCommunityMedia(
  sendUrl: string,
  body: Record<string, unknown>,
): Promise<Awaited<ReturnType<typeof evoHttpRequest>>> {
  return evoHttpRequest(sendUrl, "POST", {
    apiKey: EVO_API_KEY,
    body,
    timeoutMs: PUSH_COMMUNITY_SEND_MEDIA_TIMEOUT_MS,
    retries: PUSH_COMMUNITY_SEND_MEDIA_RETRIES,
  });
}

async function sendPushCommunityMediaToEvo(input: {
  sendUrl: string;
  groupJid: string;
  message: string;
  image: WabaPushImageAttachment;
  mediaData: { base64: string; mimeType: string };
}): Promise<Awaited<ReturnType<typeof evoHttpRequest>>> {
  const { sendUrl, groupJid, message, image, mediaData } = input;
  const baseBody: Record<string, unknown> = {
    number: groupJid,
    mediatype: "image",
    mimetype: mediaData.mimeType,
    caption: message || undefined,
    fileName: image.fileName || "push-image.jpg",
  };
  const canSendBase64 = canSendPushCommunityMediaAsBase64(image, mediaData);
  let lastResult: Awaited<ReturnType<typeof evoHttpRequest>> | null = null;

  for (const mediaUrl of listPushMediaUrlsForEvo(image.id)) {
    for (const body of buildEvoMediaBodyVariants(baseBody, mediaUrl)) {
      const result = await postPushCommunityMedia(sendUrl, body);
      lastResult = result;
      if (result.ok) return result;
    }
  }

  if (canSendBase64) {
    for (const media of buildEvoMediaVariants(mediaData)) {
      for (const body of buildEvoMediaBodyVariants(baseBody, media)) {
        const result = await postPushCommunityMedia(sendUrl, body);
        lastResult = result;
        if (result.ok) return result;
      }
    }
  }

  return (
    lastResult || {
      ok: false,
      status: 0,
      body: "Falha ao enviar mídia para a Evolution.",
      json: null,
      error: "empty_result",
    }
  );
}

async function sendPushCommunityTextToEvo(
  instanceName: string,
  groupJid: string,
  message: string,
): Promise<Awaited<ReturnType<typeof evoHttpRequest>>> {
  const sendUrl = buildTemplateUrl(EVO_SEND_TEXT_URL_TEMPLATE, instanceName);
  return evoHttpRequest(sendUrl, "POST", {
    apiKey: EVO_API_KEY,
    body: buildEvoTextBody(groupJid, message),
    timeoutMs: PUSH_COMMUNITY_SEND_MEDIA_TIMEOUT_MS,
    retries: PUSH_COMMUNITY_SEND_MEDIA_RETRIES,
  });
}

/** WhatsApp: *negrito* */
export function formatWhatsAppCommunityMessage(title: string, body: string): string {
  const safeTitle = String(title || "").trim();
  const safeBody = String(body || "").trim();
  const boldTitle = safeTitle ? `*${safeTitle.replace(/\*/g, "")}*` : "";
  if (boldTitle && safeBody) return `${boldTitle}\n\n${safeBody}`;
  if (boldTitle) return boldTitle;
  return safeBody;
}

async function resolvePushCommunitySendTarget(): Promise<{ instanceName: string; groupJid: string }> {
  const config = pushRepository.readConfig();
  const preferred = String(
    config.communityEvoInstance || resolveDefaultPushCommunityEvoInstance(),
  ).trim();
  const overrideJid = resolveAnnouncementGroupJidOverride();
  const cachedJid = overrideJid || String(config.communityAnnouncementGroupJid || "").trim();

  let instanceName = preferred;
  try {
    instanceName = await resolvePushCommunityEvoInstance(preferred);
  } catch {
    const catalog = await fetchEvoInstanceCatalog();
    const ranked = catalog
      .map((row) => ({
        name: row.name,
        score: scorePushCommunityInstance(row.name, preferred, row.number),
      }))
      .sort((a, b) => b.score - a.score);
    if (ranked[0]?.name) instanceName = ranked[0].name;
  }

  if (cachedJid.includes("@g.us")) {
    return { instanceName, groupJid: cachedJid };
  }

  const resolved = await fetchAnnouncementGroupJid(instanceName);
  return { instanceName: resolved.instanceName, groupJid: resolved.jid };
}

export async function sendPushToWhatsAppCommunity(
  title: string,
  text: string,
  image?: WabaPushImageAttachment | null,
): Promise<{
  ok: boolean;
  detail: string;
  groupJid?: string;
}> {
  const message = formatWhatsAppCommunityMessage(title, text);
  const hasImage = Boolean(image?.id);
  if (!message && !hasImage) {
    return { ok: false, detail: "Informe título/texto ou imagem para a comunidade." };
  }
  if (!EVO_API_BASE || !EVO_API_KEY) {
    return { ok: false, detail: "Evolution API não configurada (EVO_API_URL / EVO_API_KEY)." };
  }

  let instanceName = "";
  let groupJid = "";
  try {
    const target = await resolvePushCommunitySendTarget();
    instanceName = target.instanceName;
    groupJid = target.groupJid;
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "Falha ao resolver instância/grupo da comunidade.",
    };
  }

  if (hasImage && image) {
    const mediaData = readPushMediaBase64(image.id);
    if (!mediaData) {
      return { ok: false, detail: "Imagem do push não encontrada no servidor.", groupJid };
    }

    const catalog = await fetchEvoInstanceCatalog();
    const instanceCandidates = rankPushCommunityInstances(instanceName, catalog);
    let lastError = "";
    let lastStatus = 0;

    for (const candidate of instanceCandidates) {
      const sendUrl = buildTemplateUrl(EVO_SEND_MEDIA_URL_TEMPLATE, candidate);
      const sendResult = await sendPushCommunityMediaToEvo({
        sendUrl,
        groupJid,
        message,
        image,
        mediaData,
      });
      if (sendResult.ok) {
        if (candidate.toLowerCase() !== instanceName.toLowerCase()) {
          console.info(
            `[push] imagem comunidade enviada via instância fallback "${candidate}" (preferida: "${instanceName}")`,
          );
        }
        return {
          ok: true,
          detail: `Imagem publicada no grupo de anúncios (${groupJid}) via ${candidate}.`,
          groupJid,
        };
      }
      lastStatus = sendResult.status;
      lastError = String(sendResult.body || sendResult.error || "").slice(0, 220);
      if (!isEvoSendRecoverableError(sendResult)) break;
    }

    if (message) {
      const textFallback = await sendPushCommunityTextToEvo(instanceName, groupJid, message);
      if (textFallback.ok) {
        return {
          ok: false,
          detail: `Imagem não publicada (HTTP ${lastStatus}: ${lastError}). Texto enviado ao grupo como fallback.`,
          groupJid,
        };
      }
    }

    const hint = isEvoMediaUrlFetchRecoverableError({
      status: lastStatus,
      body: lastError,
    })
      ? " Verifique conexão da instância na Evolution (Connection Closed) ou use imagem JPEG até ~300 KB."
      : "";
    return {
      ok: false,
      detail: `Falha ao publicar imagem na comunidade (HTTP ${lastStatus}): ${lastError}.${hint}`,
      groupJid,
    };
  }

  const sendResult = await sendPushCommunityTextToEvo(instanceName, groupJid, message);
  if (!sendResult.ok) {
    return {
      ok: false,
      detail: `Falha ao publicar na comunidade (HTTP ${sendResult.status}): ${String(sendResult.body || sendResult.error || "").slice(0, 220)}`,
      groupJid,
    };
  }
  return {
    ok: true,
    detail: `Publicado no grupo de anúncios (${groupJid}).`,
    groupJid,
  };
}

export function getPushCommunityConfig() {
  return pushRepository.readConfig();
}

export async function loadPushCommunityConfigForAdmin(): Promise<{
  config: WabaPushConfig;
  evoInstancesAvailable: string[];
}> {
  const evoInstancesAvailable = await fetchEvoInstanceNames();
  const config = pushRepository.readConfig();
  try {
    await resolvePushCommunityEvoInstance(config.communityEvoInstance);
  } catch {
    /* mantém config atual; detalhe aparece no envio */
  }
  return {
    config: pushRepository.readConfig(),
    evoInstancesAvailable,
  };
}

export function updatePushCommunityConfig(input: {
  communityAnnouncementGroupJid?: string;
  communityEvoInstance?: string;
  communityInviteLink?: string;
}) {
  const current = pushRepository.readConfig();
  return pushRepository.writeConfig({
    ...current,
    communityInviteLink: String(input.communityInviteLink ?? current.communityInviteLink).trim(),
    communityAnnouncementGroupJid: String(
      input.communityAnnouncementGroupJid ?? current.communityAnnouncementGroupJid,
    ).trim(),
    communityEvoInstance: String(input.communityEvoInstance ?? current.communityEvoInstance).trim(),
    updatedAt: new Date().toISOString(),
  });
}
