import { evoHttpRequest } from "../evo-http.client";
import { WabaPushRepository } from "./waba-push.repository";

const EVO_API_BASE = String(process.env.EVO_API_URL || "").replace(/\/+$/, "");
const EVO_API_KEY = process.env.EVO_API_KEY || "";
const EVO_SEND_TEXT_URL_TEMPLATE =
  process.env.EVO_SEND_TEXT_URL_TEMPLATE || `${EVO_API_BASE}/message/sendText/{instance}`;

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

async function fetchAnnouncementGroupJid(instanceName: string): Promise<string> {
  const config = pushRepository.readConfig();
  if (config.communityAnnouncementGroupJid) {
    return config.communityAnnouncementGroupJid;
  }
  const url = `${EVO_API_BASE}/group/fetchAllGroups/${encodeURIComponent(instanceName)}?getParticipants=false`;
  const result = await evoHttpRequest(url, "GET", { apiKey: EVO_API_KEY });
  if (!result.ok) {
    throw new Error(
      `Não foi possível listar grupos na Evolution (${result.status}): ${String(result.body || result.error || "").slice(0, 180)}`,
    );
  }
  const groups = parseGroupsPayload(result.json);
  const jid = pickAnnouncementGroupJid(groups);
  if (!jid) {
    throw new Error(
      "Grupo de Anúncios da comunidade não encontrado. Configure communityAnnouncementGroupJid em waba-push-config.json ou envie uma mensagem manual no grupo e copie o JID do webhook.",
    );
  }
  pushRepository.writeConfig({
    ...config,
    communityAnnouncementGroupJid: jid,
  });
  return jid;
}

export async function sendPushToWhatsAppCommunity(text: string): Promise<{
  ok: boolean;
  detail: string;
  groupJid?: string;
}> {
  const config = pushRepository.readConfig();
  const instanceName = String(config.communityEvoInstance || "walkup").trim();
  const message = String(text || "").trim();
  if (!message) {
    return { ok: false, detail: "Texto vazio para comunidade." };
  }
  if (!EVO_API_BASE || !EVO_API_KEY) {
    return { ok: false, detail: "Evolution API não configurada (EVO_API_URL / EVO_API_KEY)." };
  }

  const groupJid = await fetchAnnouncementGroupJid(instanceName);
  const sendUrl = buildTemplateUrl(EVO_SEND_TEXT_URL_TEMPLATE, instanceName);
  const sendBody = {
    number: groupJid,
    text: message,
    textMessage: { text: message },
  };
  const sendResult = await evoHttpRequest(sendUrl, "POST", {
    apiKey: EVO_API_KEY,
    body: sendBody,
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
