import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { shouldAbortBroadcastOnHeaderMediaFailure, shouldVoidCloudBroadcast } from "./meta-whatsapp-broadcast-void";
import path from "path";
import { resolveDataFile } from "../../data-path";
import { canAdvanceMetaMessageStatus, type MetaMessageStatus } from "./meta-whatsapp-messaging.types";

export type MetaBroadcastLeadStatusLog = {
  status: MetaMessageStatus;
  at: string;
  errorCode?: string;
};

export type MetaBroadcastLead = {
  waId: string;
  nome?: string;
  numero?: string;
  texto?: string;
  status: "queued" | "sent" | "failed" | "skipped";
  metaStatus?: MetaMessageStatus;
  wamid?: string;
  error?: string;
  errorCode?: string;
  statusLog?: MetaBroadcastLeadStatusLog[];
};

export type MetaBroadcastCampaign = {
  id: string;
  tenantId: string;
  connectionId: string;
  templateId: string;
  templateName: string;
  language: string;
  phoneNumberId: string;
  intakeCampaignId?: string;
  shortSlug: string;
  shortUrl: string;
  trackedSlug: string;
  clicksAtStart: number;
  clicks: number;
  status: "queued" | "running" | "done" | "failed";
  sendStartedAt?: string;
  sendFinishedAt?: string;
  templateApprovedAt?: string;
  lastMetaStatusAt?: string;
  reportFinalizedAt?: string;
  /** Cancelado para refazer o Disparo Cloud; não ocupa número nem bloqueia o vínculo. */
  voidedAt?: string;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  createdAt: string;
  updatedAt: string;
  leads: MetaBroadcastLead[];
};

type Store = { version: 1; campaigns: MetaBroadcastCampaign[] };

const FILE_NAME = "meta-whatsapp-broadcasts.json";

function emptyStore(): Store {
  return { version: 1, campaigns: [] };
}

function readStore(): Store {
  const filePath = resolveDataFile(FILE_NAME);
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(filePath)) return emptyStore();
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Store;
    if (!parsed || !Array.isArray(parsed.campaigns)) return emptyStore();
    return { version: 1, campaigns: parsed.campaigns };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: Store): void {
  const filePath = resolveDataFile(FILE_NAME);
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  writeFileSync(filePath, readFileSync(tmp));
}

function leadMetaRank(lead: MetaBroadcastLead): number {
  const meta = lead.metaStatus;
  if (meta === "read") return 4;
  if (meta === "delivered") return 3;
  if (meta === "sent") return 2;
  if (meta === "accepted") return 1;
  if (meta === "failed" || lead.status === "failed") return 50;
  if (lead.status === "sent") return 1;
  return 0;
}

function sameBroadcastLead(left: MetaBroadcastLead, right: MetaBroadcastLead): boolean {
  const leftWamid = String(left.wamid || "").trim();
  const rightWamid = String(right.wamid || "").trim();
  if (leftWamid && rightWamid && leftWamid === rightWamid) return true;
  const leftWa = String(left.waId || "").replace(/\D/g, "");
  const rightWa = String(right.waId || "").replace(/\D/g, "");
  return Boolean(leftWa && rightWa && leftWa === rightWa);
}

const STATUS_LOG_LIMIT = 8;

function statusLogKey(entry: MetaBroadcastLeadStatusLog): string {
  return `${entry.status}|${entry.at}|${entry.errorCode || ""}`;
}

export function mergeBroadcastLeadStatusLogs(
  left?: MetaBroadcastLeadStatusLog[] | null,
  right?: MetaBroadcastLeadStatusLog[] | null,
): MetaBroadcastLeadStatusLog[] | undefined {
  const rows = [...(left || []), ...(right || [])].filter(
    (item) => item && item.status && item.at,
  );
  if (!rows.length) return undefined;
  const seen = new Set<string>();
  const merged: MetaBroadcastLeadStatusLog[] = [];
  for (const item of rows.sort((a, b) => String(a.at).localeCompare(String(b.at)))) {
    const key = statusLogKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      status: item.status,
      at: item.at,
      ...(item.errorCode ? { errorCode: String(item.errorCode).slice(0, 32) } : {}),
    });
  }
  return merged.slice(-STATUS_LOG_LIMIT);
}

export function appendBroadcastLeadStatusLog(
  lead: MetaBroadcastLead,
  entry: MetaBroadcastLeadStatusLog,
): void {
  const last = (lead.statusLog || [])[(lead.statusLog || []).length - 1];
  if (last && last.status === entry.status && (last.errorCode || "") === (entry.errorCode || "")) {
    return;
  }
  lead.statusLog = mergeBroadcastLeadStatusLogs(lead.statusLog, [entry]);
}

/** O envio regrava o JSON; não pode apagar delivered/read que o webhook já gravou. */
export function mergeBroadcastCampaignPreservingMeta(
  incoming: MetaBroadcastCampaign,
  stored: MetaBroadcastCampaign | undefined,
): MetaBroadcastCampaign {
  if (!stored) return incoming;
  const mergedLeads = incoming.leads.map((lead) => {
    const previous = stored.leads.find((item) => sameBroadcastLead(item, lead));
    if (!previous) return lead;
    const keepStored = leadMetaRank(previous) > leadMetaRank(lead);
    return {
      ...lead,
      wamid: String(lead.wamid || previous.wamid || "").trim() || lead.wamid || previous.wamid,
      metaStatus: keepStored ? previous.metaStatus : lead.metaStatus || previous.metaStatus,
      error: lead.error || previous.error,
      errorCode: previous.errorCode || lead.errorCode,
      statusLog: mergeBroadcastLeadStatusLogs(previous.statusLog, lead.statusLog),
    };
  });
  const storedMetaMs = Date.parse(String(stored.lastMetaStatusAt || "")) || 0;
  const incomingMetaMs = Date.parse(String(incoming.lastMetaStatusAt || "")) || 0;
  return {
    ...incoming,
    leads: mergedLeads,
    lastMetaStatusAt:
      storedMetaMs > incomingMetaMs ? stored.lastMetaStatusAt : incoming.lastMetaStatusAt || stored.lastMetaStatusAt,
    clicks: Math.max(Number(incoming.clicks || 0), Number(stored.clicks || 0)),
    reportFinalizedAt: incoming.reportFinalizedAt || stored.reportFinalizedAt,
    sendStartedAt: stored.sendStartedAt || incoming.sendStartedAt,
    sendFinishedAt: incoming.sendFinishedAt || stored.sendFinishedAt,
    templateApprovedAt: stored.templateApprovedAt || incoming.templateApprovedAt,
    voidedAt: incoming.voidedAt || stored.voidedAt,
  };
}

export function saveBroadcastCampaign(row: MetaBroadcastCampaign): MetaBroadcastCampaign {
  const store = readStore();
  const index = store.campaigns.findIndex((item) => item.id === row.id);
  const stored = index >= 0 ? store.campaigns[index] : undefined;
  const next = mergeBroadcastCampaignPreservingMeta({ ...row, updatedAt: new Date().toISOString() }, stored);
  if (index >= 0) store.campaigns[index] = next;
  else store.campaigns.push(next);
  writeStore(store);
  return next;
}

export function findBroadcastCampaign(tenantId: string, id: string): MetaBroadcastCampaign | null {
  const row = readStore().campaigns.find((item) => item.id === id && item.tenantId === tenantId);
  return row ? { ...row, leads: row.leads.map((lead) => ({ ...lead })) } : null;
}

export function listBroadcastCampaigns(tenantId: string, limit = 8): MetaBroadcastCampaign[] {
  return listAllBroadcastCampaigns(tenantId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, Math.max(1, limit));
}

export function listAllBroadcastCampaigns(tenantId: string): MetaBroadcastCampaign[] {
  return readStore()
    .campaigns.filter((item) => item.tenantId === tenantId)
    .map((row) => ({ ...row, leads: row.leads.map((lead) => ({ ...lead })) }));
}

export function findBroadcastByIntakeCampaignId(intakeCampaignId: string): MetaBroadcastCampaign | null {
  const id = String(intakeCampaignId || "").trim();
  if (!id) return null;
  const rows = readStore()
    .campaigns.filter((item) => String(item.intakeCampaignId || "") === id && !String(item.voidedAt || "").trim())
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const row = rows[0];
  return row ? { ...row, leads: row.leads.map((lead) => ({ ...lead })) } : null;
}

/** running/queued sem void — lotes que o operacional não deve interromper com Redeploy. */
export function listActiveCloudBroadcasts(): MetaBroadcastCampaign[] {
  return readStore()
    .campaigns.filter((row) => {
      if (String(row.voidedAt || "").trim()) return false;
      return row.status === "running" || row.status === "queued";
    })
    .map((row) => ({ ...row, leads: row.leads.map((lead) => ({ ...lead })) }));
}

/** Lead ainda não processado pelo loop de envio (Graph). */
export function broadcastLeadIsPendingSend(lead: MetaBroadcastLead | null | undefined): boolean {
  const status = String(lead?.status || "").trim();
  return !status || status === "queued";
}

/**
 * Disparos Cloud com status running/queued, sem void, e com leads pendentes.
 * Após Redeploy o loop em memória some — estes precisam de resume no boot.
 */
export function listResumableOrphanedBroadcasts(): MetaBroadcastCampaign[] {
  return readStore()
    .campaigns.filter((row) => {
      if (String(row.voidedAt || "").trim()) return false;
      if (row.status !== "running" && row.status !== "queued") return false;
      return (row.leads || []).some(broadcastLeadIsPendingSend);
    })
    .map((row) => ({ ...row, leads: row.leads.map((lead) => ({ ...lead })) }));
}

/** running sem leads pendentes (tudo sent/failed/skipped) — fechar no boot. */
export function listStaleRunningBroadcastsWithoutPending(): MetaBroadcastCampaign[] {
  return readStore()
    .campaigns.filter((row) => {
      if (String(row.voidedAt || "").trim()) return false;
      if (row.status !== "running") return false;
      return !(row.leads || []).some(broadcastLeadIsPendingSend);
    })
    .map((row) => ({ ...row, leads: row.leads.map((lead) => ({ ...lead })) }));
}

export function finalizeStaleRunningBroadcast(campaignId: string): MetaBroadcastCampaign | null {
  const id = String(campaignId || "").trim();
  if (!id) return null;
  const store = readStore();
  const row = store.campaigns.find((item) => item.id === id);
  if (!row || String(row.voidedAt || "").trim()) return null;
  if (row.status !== "running") return null;
  if ((row.leads || []).some(broadcastLeadIsPendingSend)) return null;
  const now = new Date().toISOString();
  row.status = row.failed === row.total ? "failed" : "done";
  row.sendFinishedAt = row.sendFinishedAt || now;
  row.updatedAt = now;
  writeStore(store);
  return { ...row, leads: row.leads.map((lead) => ({ ...lead })) };
}

export function voidBroadcastCampaignForRetry(campaignId: string): MetaBroadcastCampaign | null {
  const id = String(campaignId || "").trim();
  if (!id) return null;
  const store = readStore();
  const row = store.campaigns.find((item) => item.id === id);
  if (!row) return null;
  if (row.voidedAt) return { ...row, leads: row.leads.map((lead) => ({ ...lead })) };
  const now = new Date().toISOString();
  row.status = "failed";
  row.voidedAt = now;
  row.updatedAt = now;
  writeStore(store);
  return { ...row, leads: row.leads.map((lead) => ({ ...lead })) };
}

export function ensureVoidedFailedCloudBroadcasts(): number {
  return voidAbandonedCloudBroadcastsForRetry(shouldVoidCloudBroadcast);
}

export function voidAbandonedCloudBroadcastsForRetry(
  shouldVoid: (row: MetaBroadcastCampaign) => boolean,
): number {
  const store = readStore();
  const now = new Date().toISOString();
  let changed = 0;
  for (const row of store.campaigns) {
    if (row.voidedAt) continue;
    if (!shouldVoid(row)) continue;
    row.status = "failed";
    row.voidedAt = now;
    row.updatedAt = now;
    changed += 1;
  }
  if (changed) writeStore(store);
  return changed;
}

function recipientDigits(value: string | null | undefined): string {
  return String(value || "").replace(/\D/g, "");
}

export function matchBroadcastLeadForMetaStatus(
  campaigns: MetaBroadcastCampaign[],
  input: { wamid?: string | null; recipientId?: string | null; phoneNumberId?: string | null },
): { campaign: MetaBroadcastCampaign; lead: MetaBroadcastLead } | null {
  const wamid = String(input.wamid || "").trim();
  const recipient = recipientDigits(input.recipientId);
  const phoneNumberId = String(input.phoneNumberId || "").trim();
  const ranked = [...campaigns].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  if (wamid) {
    for (const campaign of ranked) {
      if (phoneNumberId && String(campaign.phoneNumberId || "") !== phoneNumberId) continue;
      const lead = campaign.leads.find((item) => String(item.wamid || "").trim() === wamid);
      if (lead) return { campaign, lead };
    }
    for (const campaign of ranked) {
      const lead = campaign.leads.find((item) => String(item.wamid || "").trim() === wamid);
      if (lead) return { campaign, lead };
    }
  }
  if (!recipient) return null;
  for (const campaign of ranked) {
    if (phoneNumberId && String(campaign.phoneNumberId || "") !== phoneNumberId) continue;
    const lead = campaign.leads.find(
      (item) => recipientDigits(item.waId) === recipient && item.status !== "skipped",
    );
    if (lead) return { campaign, lead };
  }
  return null;
}

export function applyMetaStatusToBroadcastByWamid(
  wamid: string,
  status: MetaMessageStatus,
  extras?: {
    recipientId?: string | null;
    phoneNumberId?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    occurredAt?: string | null;
  },
): MetaBroadcastCampaign | null {
  const store = readStore();
  const matched = matchBroadcastLeadForMetaStatus(store.campaigns, {
    wamid,
    recipientId: extras?.recipientId,
    phoneNumberId: extras?.phoneNumberId,
  });
  if (!matched) return null;
  const { campaign: row, lead } = matched;
  const current =
    lead.metaStatus || (lead.status === "sent" ? "accepted" : lead.status === "failed" ? "failed" : "queued");
  if (!canAdvanceMetaMessageStatus(current, status) && current !== status) return row;
  lead.metaStatus = status;
  if (wamid && !lead.wamid) lead.wamid = String(wamid).trim();
  const errorCode = String(extras?.errorCode || "").trim().slice(0, 32);
  const errorMessage = String(extras?.errorMessage || "").replace(/\s+/g, " ").trim().slice(0, 180);
  if (status === "failed") {
    lead.status = "failed";
    if (errorCode) lead.errorCode = errorCode;
    lead.error = errorMessage || lead.error || "Falha informada pela Meta.";
  }
  const occurredAt = String(extras?.occurredAt || "").trim() || new Date().toISOString();
  appendBroadcastLeadStatusLog(lead, {
    status,
    at: occurredAt,
    ...(errorCode ? { errorCode } : {}),
  });
  row.lastMetaStatusAt = new Date().toISOString();
  row.updatedAt = row.lastMetaStatusAt;
  writeStore(store);
  if (errorCode === "131053" && shouldAbortBroadcastOnHeaderMediaFailure(row) && !row.voidedAt) {
    return voidBroadcastCampaignForRetry(row.id) || row;
  }
  return { ...row, leads: row.leads.map((item) => ({ ...item })) };
}

export function stampTemplateApprovedAtOnBroadcasts(input: {
  tenantId: string;
  templateId?: string | null;
  templateName?: string | null;
  language?: string | null;
  approvedAt: string;
}): void {
  const tenantId = String(input.tenantId || "").trim();
  const approvedAt = String(input.approvedAt || "").trim();
  if (!tenantId || !approvedAt) return;
  const templateId = String(input.templateId || "").trim();
  const templateName = String(input.templateName || "").trim().toLowerCase();
  const language = String(input.language || "").trim().toLowerCase();
  if (!templateId && !templateName) return;
  const store = readStore();
  let changed = false;
  for (const row of store.campaigns) {
    if (String(row.tenantId || "") !== tenantId) continue;
    if (row.templateApprovedAt) continue;
    const sameId = templateId && String(row.templateId || "").trim() === templateId;
    const sameName =
      templateName &&
      String(row.templateName || "").trim().toLowerCase() === templateName &&
      (!language || String(row.language || "").trim().toLowerCase() === language);
    if (!sameId && !sameName) continue;
    row.templateApprovedAt = approvedAt;
    row.updatedAt = new Date().toISOString();
    changed = true;
  }
  if (changed) writeStore(store);
}

export function addClicksToBroadcastCampaign(campaignId: string, amount = 1): void {
  const id = String(campaignId || "").trim();
  const delta = Math.max(0, Math.round(Number(amount) || 0));
  if (!id || !delta) return;
  const store = readStore();
  const row = store.campaigns.find((item) => item.id === id);
  if (!row) return;
  row.clicks = Math.max(0, Number(row.clicks || 0)) + delta;
  row.updatedAt = new Date().toISOString();
  writeStore(store);
}

export function addClicksByBroadcastSlug(slug: string, amount = 1): void {
  const key = String(slug || "").trim().toLowerCase();
  const delta = Math.max(0, Math.round(Number(amount) || 0));
  if (!key || !delta) return;
  const store = readStore();
  const row = store.campaigns.find(
    (item) => String(item.trackedSlug || "").toLowerCase() === key || String(item.shortSlug || "").toLowerCase() === key,
  );
  if (!row) return;
  row.clicks = Math.max(0, Number(row.clicks || 0)) + delta;
  row.updatedAt = new Date().toISOString();
  writeStore(store);
}

export function publicBroadcastCampaign(row: MetaBroadcastCampaign) {
  return {
    id: row.id,
    connectionId: row.connectionId,
    templateName: row.templateName,
    language: row.language,
    phoneNumberId: row.phoneNumberId,
    shortUrl: row.shortUrl,
    clicks: Math.max(0, Number(row.clicks || 0)),
    intakeCampaignId: row.intakeCampaignId || undefined,
    status: row.status,
    total: row.total,
    sent: row.sent,
    failed: row.failed,
    skipped: row.skipped,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
