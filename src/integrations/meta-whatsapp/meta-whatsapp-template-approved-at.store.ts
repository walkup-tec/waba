import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "path";
import { resolveDataFile } from "../../data-path";
import { isTemplateApprovedForSend } from "./meta-whatsapp-template.types";
import { stampTemplateApprovedAtOnBroadcasts } from "./meta-whatsapp-broadcast.store";

type Store = { version: 1; byKey: Record<string, string> };

const FILE_NAME = "meta-whatsapp-template-approvals.json";

function emptyStore(): Store {
  return { version: 1, byKey: {} };
}

function readStore(): Store {
  const filePath = resolveDataFile(FILE_NAME);
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(filePath)) return emptyStore();
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Store;
    if (!parsed || parsed.version !== 1 || !parsed.byKey || typeof parsed.byKey !== "object") {
      return emptyStore();
    }
    return { version: 1, byKey: parsed.byKey };
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

function normalizeIso(value: string | null | undefined): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

export function templateApprovalKeys(input: {
  tenantId?: string | null;
  templateId?: string | null;
  metaTemplateId?: string | null;
  wabaId?: string | null;
  name?: string | null;
  language?: string | null;
}): string[] {
  const tenantId = String(input.tenantId || "").trim();
  const templateId = String(input.templateId || "").trim();
  const metaTemplateId = String(input.metaTemplateId || "").trim();
  const wabaId = String(input.wabaId || "").trim();
  const name = String(input.name || "").trim().toLowerCase();
  const language = String(input.language || "").trim().toLowerCase();
  const keys: string[] = [];
  if (tenantId && templateId) keys.push(`id:${tenantId}:${templateId}`);
  if (tenantId && metaTemplateId) keys.push(`meta:${tenantId}:${metaTemplateId}`);
  if (tenantId && wabaId && name && language) keys.push(`name:${tenantId}:${wabaId}:${name}:${language}`);
  if (tenantId && name && language) keys.push(`name:${tenantId}:${name}:${language}`);
  return keys;
}

export function lookupTemplateApprovedAt(input: {
  tenantId?: string | null;
  templateId?: string | null;
  metaTemplateId?: string | null;
  wabaId?: string | null;
  name?: string | null;
  language?: string | null;
}): string | null {
  const store = readStore();
  for (const key of templateApprovalKeys(input)) {
    const iso = normalizeIso(store.byKey[key]);
    if (iso) return iso;
  }
  return null;
}

export function rememberTemplateApprovedAt(
  input: {
    tenantId?: string | null;
    templateId?: string | null;
    metaTemplateId?: string | null;
    wabaId?: string | null;
    name?: string | null;
    language?: string | null;
    status?: string | null;
  },
  approvedAt?: string | null,
): string | null {
  if (!isTemplateApprovedForSend(input.status)) return lookupTemplateApprovedAt(input);
  const keys = templateApprovalKeys(input);
  if (!keys.length) return null;
  const store = readStore();
  const existing = keys.map((key) => normalizeIso(store.byKey[key])).find(Boolean) || null;
  const iso = existing || normalizeIso(approvedAt) || new Date().toISOString();
  let changed = false;
  for (const key of keys) {
    if (store.byKey[key] === iso) continue;
    if (!store.byKey[key]) {
      store.byKey[key] = iso;
      changed = true;
    }
  }
  if (changed) writeStore(store);
  stampTemplateApprovedAtOnBroadcasts({
    tenantId: String(input.tenantId || "").trim(),
    templateId: String(input.templateId || "").trim() || null,
    templateName: String(input.name || "").trim() || null,
    language: String(input.language || "").trim() || null,
    approvedAt: iso,
  });
  return iso;
}
