import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "path";
import { resolveDataFile } from "../../data-path";
import { canAdvanceMetaMessageStatus, type MetaMessageStatus } from "./meta-whatsapp-messaging.types";

export type MetaBroadcastLead = {
  waId: string;
  nome?: string;
  numero?: string;
  texto?: string;
  status: "queued" | "sent" | "failed" | "skipped";
  metaStatus?: MetaMessageStatus;
  wamid?: string;
  error?: string;
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
  sendFinishedAt?: string;
  lastMetaStatusAt?: string;
  reportFinalizedAt?: string;
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

export function saveBroadcastCampaign(row: MetaBroadcastCampaign): MetaBroadcastCampaign {
  const store = readStore();
  const index = store.campaigns.findIndex((item) => item.id === row.id);
  const next = { ...row, updatedAt: new Date().toISOString() };
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
  return readStore()
    .campaigns.filter((item) => item.tenantId === tenantId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, Math.max(1, limit))
    .map((row) => ({ ...row, leads: row.leads.map((lead) => ({ ...lead })) }));
}

export function findBroadcastByIntakeCampaignId(intakeCampaignId: string): MetaBroadcastCampaign | null {
  const id = String(intakeCampaignId || "").trim();
  if (!id) return null;
  const row = readStore().campaigns.find((item) => String(item.intakeCampaignId || "") === id);
  return row ? { ...row, leads: row.leads.map((lead) => ({ ...lead })) } : null;
}

export function applyMetaStatusToBroadcastByWamid(
  wamid: string,
  status: MetaMessageStatus,
): MetaBroadcastCampaign | null {
  const id = String(wamid || "").trim();
  if (!id) return null;
  const store = readStore();
  for (const row of store.campaigns) {
    const lead = row.leads.find((item) => String(item.wamid || "") === id);
    if (!lead) continue;
    const current = lead.metaStatus || (lead.status === "sent" ? "accepted" : lead.status === "failed" ? "failed" : "queued");
    if (!canAdvanceMetaMessageStatus(current, status) && current !== status) return row;
    lead.metaStatus = status;
    if (status === "failed") {
      lead.status = "failed";
      lead.error = lead.error || "Falha informada pela Meta.";
    }
    row.lastMetaStatusAt = new Date().toISOString();
    row.updatedAt = row.lastMetaStatusAt;
    writeStore(store);
    return { ...row, leads: row.leads.map((item) => ({ ...item })) };
  }
  return null;
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
