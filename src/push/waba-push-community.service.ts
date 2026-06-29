import { evoHttpRequest } from "../evo-http.client";
import { resolveEvoInstanceKey } from "../instances/evo-instance-key";
import { resolveWabaPublicBaseUrl } from "../lib/waba-public-base-url";
import { readPushMediaBase64 } from "./waba-push-media.service";
import { WabaPushRepository } from "./waba-push.repository";
import type { WabaPushImageAttachment } from "./waba-push.types";
import { resolveDefaultPushCommunityEvoInstance } from "./waba-push.types";

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
  }
  return raw ? [raw as Record<string, unknown>] : [];
}

function isEvoInstanceMissingError(result: { status: number; body?: string; json?: unknown | null }): boolean {
  if (result.status !== 404) return false;
  const text = `${String(result.body || "")} ${JSON.stringify(result.json ?? "")}`.toLowerCase();
  return text.includes("does not exist") || text.includes("not found") || text.includes("instance");
}

function scorePushCommunityInstance(name: string, preferred: string): number {
  const lower = name.toLowerCase();
  const prefLower = preferred.toLowerCase();
  if (!lower) return 0;
  if (lower === prefLower) return 100;
  if (PUSH_COMMUNITY_PHONE_HINT && lower.includes(PUSH_COMMUNITY_PHONE_HINT.toLowerCase())) return 92;
  if (prefLower && lower.includes(prefLower)) return 88;
  if (lower.includes("drax sistemas")) return 82;
  if (lower.includes("drax")) return 72;
  if (lower === "walkup") return 62;
  return 0;
}

async function fetchEvoInstanceNames(): Promise<string[]> {
  if (!EVO_API_BASE || !EVO_API_KEY) return [];
  const result = await evoHttpRequest(EVO_INSTANCES_URL, "GET", { apiKey: EVO_API_KEY });
  if (!result.ok) return [];
  return parseEvoInstancesList(result.json)
    .map((row) => resolveEvoInstanceKey(row))
    .filter(Boolean);
}

async function resolvePushCommunityEvoInstance(configured: string): Promise<string> {
  const preferred = String(configured || resolveDefaultPushCommunityEvoInstance()).trim();
  const names = await fetchEvoInstanceNames();
  if (!names.length) return preferred;

  const exact = names.find((name) => name.toLowerCase() === preferred.toLowerCase());
  if (exact) return exact;

  let best = preferred;
  let bestScore = 0;
  for (const name of names) {
    const score = scorePushCommunityInstance(name, preferred);
    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }

  if (bestScore <= 0) {
    throw new Error(
      `Instância "${preferred}" não existe na Evolution. Disponíveis: ${names.slice(0, 8).join(", ")}. Configure WABA_PUSH_COMMUNITY_EVO_INSTANCE no .env.`,
    );
  }

  if (best !== preferred) {
    const config = pushRepository.readConfig();
    pushRepository.writeConfig({
      ...config,
      communityEvoInstance: best,
      communityAnnouncementGroupJid: "",
    });
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
  const result = await evoHttpRequest(url, "GET", { apiKey: EVO_API_KEY });
  if (!result.ok) {
    if (allowInstanceResolve && isEvoInstanceMissingError(result)) {
      const resolved = await resolvePushCommunityEvoInstance(instanceName);
      if (resolved.toLowerCase() !== instanceName.toLowerCase()) {
        return fetchAnnouncementGroupJid(resolved, false);
      }
    }
    throw new Error(
      `Não foi possível listar grupos na Evolution (${result.status}): ${String(result.body || result.error || "").slice(0, 220)}`,
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
  return `${base}/push/public-media/${encodeURIComponent(imageId)}`;
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

export async function sendPushToWhatsAppCommunity(
  title: string,
  text: string,
  image?: WabaPushImageAttachment | null,
): Promise<{
  ok: boolean;
  detail: string;
  groupJid?: string;
}> {
  const config = pushRepository.readConfig();
  let instanceName = String(
    config.communityEvoInstance || resolveDefaultPushCommunityEvoInstance(),
  ).trim();
  try {
    instanceName = await resolvePushCommunityEvoInstance(instanceName);
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "Falha ao resolver instância Evolution da comunidade.",
    };
  }
  const message = formatWhatsAppCommunityMessage(title, text);
  const hasImage = Boolean(image?.id);
  if (!message && !hasImage) {
    return { ok: false, detail: "Informe título/texto ou imagem para a comunidade." };
  }
  if (!EVO_API_BASE || !EVO_API_KEY) {
    return { ok: false, detail: "Evolution API não configurada (EVO_API_URL / EVO_API_KEY)." };
  }

  let groupJid = "";
  try {
    const resolved = await fetchAnnouncementGroupJid(instanceName);
    groupJid = resolved.jid;
    instanceName = resolved.instanceName;
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "Falha ao listar grupos na Evolution.",
    };
  }

  if (hasImage && image) {
    const mediaData = readPushMediaBase64(image.id);
    if (!mediaData) {
      return { ok: false, detail: "Imagem do push não encontrada no servidor.", groupJid };
    }
    const sendUrl = buildTemplateUrl(EVO_SEND_MEDIA_URL_TEMPLATE, instanceName);
    const publicUrl = resolvePublicMediaUrl(image.id);
    const sendBody: Record<string, unknown> = {
      number: groupJid,
      mediatype: "image",
      mimetype: mediaData.mimeType,
      caption: message || undefined,
      fileName: image.fileName || "push-image.jpg",
      media: publicUrl,
    };
    let sendResult = await evoHttpRequest(sendUrl, "POST", {
      apiKey: EVO_API_KEY,
      body: sendBody,
    });
    if (!sendResult.ok) {
      sendBody.media = mediaData.base64;
      sendResult = await evoHttpRequest(sendUrl, "POST", {
        apiKey: EVO_API_KEY,
        body: sendBody,
      });
    }
    if (!sendResult.ok) {
      return {
        ok: false,
        detail: `Falha ao publicar imagem na comunidade (HTTP ${sendResult.status}): ${String(sendResult.body || sendResult.error || "").slice(0, 220)}`,
        groupJid,
      };
    }
    return {
      ok: true,
      detail: `Imagem publicada no grupo de anúncios (${groupJid}).`,
      groupJid,
    };
  }

  const sendUrl = buildTemplateUrl(EVO_SEND_TEXT_URL_TEMPLATE, instanceName);
  const sendResult = await evoHttpRequest(sendUrl, "POST", {
    apiKey: EVO_API_KEY,
    body: buildEvoTextBody(groupJid, message),
  });
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
