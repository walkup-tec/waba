import fs from "fs/promises";
import path from "path";
import { resolveDataFile } from "../data-path";
import {
  normalizeEvoWhatsAppNumber,
  resolveEvoInstancePhone,
} from "../instances/evo-instance-phone.service";

const PHONES_FILE = resolveDataFile("device-cloud-phones.json");
const ALIASES_FILE = resolveDataFile("instance-aliases.json");
const EVO_CACHE_FILE = resolveDataFile("evo-instances-cache.json");

type PhoneStore = {
  byDeviceId?: Record<string, string>;
  byLabel?: Record<string, string>;
  byInstanceName?: Record<string, string>;
};

export type DeviceCloudPhoneSaveInput = {
  deviceId: string;
  label?: string;
  instanceName?: string;
  phone: string;
};

export type DeviceCloudPhoneResolveInput = {
  deviceId: string;
  label?: string;
  instanceName?: string;
};

function normalizeLabelKey(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeDigits(raw: string): string {
  return normalizeEvoWhatsAppNumber(String(raw || "").replace(/\D/g, ""));
}

async function readPhoneStore(): Promise<PhoneStore> {
  try {
    const raw = await fs.readFile(PHONES_FILE, "utf-8");
    const parsed = JSON.parse(raw) as PhoneStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writePhoneStore(store: PhoneStore): Promise<void> {
  await fs.mkdir(path.dirname(PHONES_FILE), { recursive: true });
  await fs.writeFile(PHONES_FILE, JSON.stringify(store, null, 2), "utf-8");
}

async function readAliasesMap(): Promise<Map<string, string>> {
  try {
    const raw = await fs.readFile(ALIASES_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, string>;
    const map = new Map<string, string>();
    if (parsed && typeof parsed === "object") {
      Object.entries(parsed).forEach(([key, value]) => {
        const k = String(key || "").trim();
        const v = String(value || "").trim();
        if (k && v) map.set(k, v);
      });
    }
    return map;
  } catch {
    return new Map();
  }
}

function pickPhoneFromCacheRow(row: Record<string, unknown>): string {
  const raw =
    row?.number ??
    row?.phone ??
    row?.ownerNumber ??
    row?.owner ??
    row?.ownerJid ??
    "";
  const base = String(raw || "").trim().split("@")[0];
  return normalizeDigits(base);
}

async function readEvoCacheItems(): Promise<Array<Record<string, unknown>>> {
  try {
    const raw = await fs.readFile(EVO_CACHE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as { items?: Array<Record<string, unknown>> };
    return Array.isArray(parsed?.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

function instanceNamesForLabel(
  label: string,
  instanceName: string,
  aliases: Map<string, string>,
): string[] {
  const names = new Set<string>();
  const labelKey = normalizeLabelKey(label);
  const instKey = normalizeLabelKey(instanceName);
  if (instKey) names.add(instKey);
  if (labelKey) names.add(labelKey);

  aliases.forEach((alias, inst) => {
    const aliasKey = normalizeLabelKey(alias);
    const instNorm = normalizeLabelKey(inst);
    if (labelKey && (aliasKey === labelKey || instNorm === labelKey)) {
      if (instNorm) names.add(instNorm);
      names.add(String(inst || "").trim().toLowerCase());
    }
  });

  return [...names].filter(Boolean);
}

async function phoneFromEvoCacheCandidates(candidates: string[], label: string): Promise<string> {
  const items = await readEvoCacheItems();
  const needles = new Set(candidates.map((name) => name.trim().toLowerCase()).filter(Boolean));
  const labelDigits = String(label || "").replace(/\D/g, "");

  for (const row of items) {
    const name = String(row?.name || row?.instanceName || "")
      .trim()
      .toLowerCase();
    if (name && needles.has(name)) {
      const phone = pickPhoneFromCacheRow(row);
      if (phone) return phone;
    }
  }

  if (labelDigits.length >= 4) {
    const suffixMatches: string[] = [];
    for (const row of items) {
      const phone = pickPhoneFromCacheRow(row);
      if (phone && phone.endsWith(labelDigits)) suffixMatches.push(phone);
    }
    const unique = [...new Set(suffixMatches)];
    if (unique.length === 1) return unique[0];
  }

  return "";
}

export async function saveDeviceCloudRegisteredPhone(input: DeviceCloudPhoneSaveInput): Promise<string> {
  const deviceId = String(input.deviceId || "").trim();
  const phone = normalizeDigits(input.phone);
  if (!deviceId || !phone) return "";

  const labelKey = normalizeLabelKey(input.label || "");
  const instanceKey = normalizeLabelKey(input.instanceName || input.label || "");

  const store = await readPhoneStore();
  store.byDeviceId = store.byDeviceId && typeof store.byDeviceId === "object" ? store.byDeviceId : {};
  store.byLabel = store.byLabel && typeof store.byLabel === "object" ? store.byLabel : {};
  store.byInstanceName =
    store.byInstanceName && typeof store.byInstanceName === "object" ? store.byInstanceName : {};

  store.byDeviceId[deviceId] = phone;
  if (labelKey) store.byLabel[labelKey] = phone;
  if (instanceKey) store.byInstanceName[instanceKey] = phone;

  await writePhoneStore(store);
  return phone;
}

export async function resolveDeviceCloudRegisteredPhone(
  input: DeviceCloudPhoneResolveInput,
): Promise<{ phone: string; source: string }> {
  const deviceId = String(input.deviceId || "").trim();
  const label = String(input.label || "").trim();
  const instanceName = String(input.instanceName || "").trim();
  const labelKey = normalizeLabelKey(label);
  const instanceKey = normalizeLabelKey(instanceName || label);

  const store = await readPhoneStore();
  const fromDevice = normalizeDigits(store.byDeviceId?.[deviceId] || "");
  if (fromDevice) return { phone: fromDevice, source: "device-cloud-phones.byDeviceId" };

  const fromLabel = normalizeDigits(store.byLabel?.[labelKey] || "");
  if (fromLabel) return { phone: fromLabel, source: "device-cloud-phones.byLabel" };

  const fromInstance = normalizeDigits(store.byInstanceName?.[instanceKey] || "");
  if (fromInstance) return { phone: fromInstance, source: "device-cloud-phones.byInstanceName" };

  const aliases = await readAliasesMap();
  const candidates = instanceNamesForLabel(label, instanceName, aliases);

  const fromCache = await phoneFromEvoCacheCandidates(candidates, label);
  if (fromCache) return { phone: fromCache, source: "evo-instances-cache" };

  for (const candidate of candidates) {
    const resolved = normalizeDigits(await resolveEvoInstancePhone(candidate));
    if (resolved) return { phone: resolved, source: "resolveEvoInstancePhone" };
  }

  return { phone: "", source: "" };
}
