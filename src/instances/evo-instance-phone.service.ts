import fs from "fs/promises";
import path from "path";
import { resolveDataFile } from "../data-path";
import { evoHttpRequest } from "../evo-http.client";
import { resolveEvoInstanceKey } from "./evo-instance-key";
import {
  fetchEvoInstanceLiveState,
  isEvoLiveStateOpen,
} from "./evo-connection-state.service";

const EVO_API_BASE = String(process.env.EVO_API_URL || "http://walkup-evo-walkup-api:8080").replace(
  /\/$/,
  ""
);
const EVO_API_KEY = String(process.env.EVO_API_KEY || "429683C4C977415CAAFCCE10F7D57E11");
const EVO_INSTANCES_URL =
  String(process.env.EVO_INSTANCES_URL || "").trim() ||
  `${EVO_API_BASE}/instance/fetchInstances`;

export function normalizeEvoWhatsAppNumber(num: string): string {
  const digits = String(num || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length >= 12 && digits.startsWith("55")) return digits;
  if (digits.length >= 10 && digits.length <= 11 && /^[1-9]\d/.test(digits)) {
    return `55${digits}`;
  }
  return digits;
}

function pickPhoneFromRecord(rec: Record<string, unknown>): string {
  const raw =
    rec?.ownerJid ??
    rec?.owner ??
    rec?.wid ??
    rec?.wuid ??
    rec?.number ??
    rec?.phone ??
    rec?.ownerNumber ??
    rec?.remoteJid ??
    rec?.jid ??
    (rec?.me as Record<string, unknown> | undefined)?.id ??
    (rec?.profile as Record<string, unknown> | undefined)?.owner ??
    (rec?.profile as Record<string, unknown> | undefined)?.number ??
    "";
  const s = String(raw || "").trim();
  if (!s) return "";
  const base = s.includes("@") ? s.split("@")[0] || s : s;
  return normalizeEvoWhatsAppNumber(base);
}

function deepFindWhatsappDigits(node: unknown, depth = 0): string {
  if (depth > 10 || node == null) return "";
  if (typeof node === "string") {
    const s = node.trim();
    if (!s.includes("@")) return "";
    const base = s.split("@")[0] || "";
    const digits = normalizeEvoWhatsAppNumber(base);
    return digits.length >= 10 ? digits : "";
  }
  if (typeof node !== "object") return "";
  const obj = node as Record<string, unknown>;
  for (const key of ["ownerJid", "owner", "wid", "wuid", "jid", "remoteJid", "id", "number", "phone"]) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) {
      const digits = pickPhoneFromRecord({ [key]: v });
      if (digits) return digits;
    }
  }
  for (const value of Object.values(obj)) {
    const found = deepFindWhatsappDigits(value, depth + 1);
    if (found) return found;
  }
  return "";
}

function parseEvoInstancesList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if (Array.isArray(record.response)) return record.response;
    if (Array.isArray(record.data)) return record.data;
  }
  return raw ? [raw] : [];
}

export type EvoListItemPhone = {
  instanceName: string;
  phone: string;
  open: boolean;
};

/** Lê telefone no item da listagem EVO (wrapper + objeto `instance`). */
export function extractPhoneFromEvoListItem(item: unknown): EvoListItemPhone | null {
  if (!item || typeof item !== "object") return null;
  const wrapper = item as Record<string, unknown>;
  const nested =
    wrapper.instance && typeof wrapper.instance === "object"
      ? (wrapper.instance as Record<string, unknown>)
      : wrapper;
  const instanceName =
    resolveEvoInstanceKey(nested) || resolveEvoInstanceKey(wrapper);
  if (!instanceName) return null;
  const status = String(
    nested?.connectionStatus ??
      nested?.status ??
      wrapper?.connectionStatus ??
      wrapper?.status ??
      ""
  ).toLowerCase();
  const phone =
    pickPhoneFromRecord(nested) ||
    pickPhoneFromRecord(wrapper) ||
    deepFindWhatsappDigits(wrapper);
  return {
    instanceName,
    phone,
    open: status.includes("open"),
  };
}

async function readPhoneFromEvoCache(instanceName: string): Promise<string> {
  const needle = instanceName.trim().toLowerCase();
  if (!needle) return "";
  try {
    const file = resolveDataFile("evo-instances-cache.json");
    const raw = await fs.readFile(file, "utf-8");
    const parsed = JSON.parse(raw) as { items?: Array<Record<string, unknown>> };
    const row = (parsed?.items || []).find(
      (item) => String(item?.name || "").trim().toLowerCase() === needle
    );
    if (!row) return "";
    return normalizeEvoWhatsAppNumber(String(row?.number || row?.phone || "").trim());
  } catch {
    return "";
  }
}

async function fetchPhoneFromConnectionState(instanceName: string): Promise<string> {
  const enc = encodeURIComponent(instanceName);
  const urls = [
    `${EVO_API_BASE}/instance/connectionState/${enc}`,
    `${EVO_API_BASE}/instance/connection-state/${enc}`,
  ];
  for (const url of urls) {
    const result = await evoHttpRequest(url, "GET", {
      apiKey: EVO_API_KEY,
      timeoutMs: 10_000,
      retries: 1,
    });
    if (!result.ok || result.json == null) continue;
    const root = result.json as Record<string, unknown>;
    const inst = (root.instance as Record<string, unknown> | undefined) ?? root;
    const phone = pickPhoneFromRecord(inst) || pickPhoneFromRecord(root) || deepFindWhatsappDigits(root);
    if (phone) return phone;
  }
  return "";
}

async function fetchPhoneFromProfile(instanceName: string): Promise<string> {
  const enc = encodeURIComponent(instanceName);
  const urls = [
    `${EVO_API_BASE}/profile/fetchProfile/${enc}`,
    `${EVO_API_BASE}/instance/fetchProfile/${enc}`,
    `${EVO_API_BASE}/chat/fetchProfile/${enc}`,
  ];
  for (const url of urls) {
    const result = await evoHttpRequest(url, "GET", {
      apiKey: EVO_API_KEY,
      timeoutMs: 12_000,
      retries: 1,
    });
    if (!result.ok || result.json == null) continue;
    const phone = deepFindWhatsappDigits(result.json);
    if (phone) return phone;
  }
  return "";
}

async function fetchPhoneFromInstancesList(instanceName: string): Promise<string> {
  const needle = instanceName.trim().toLowerCase();
  if (!needle) return "";
  const result = await evoHttpRequest(EVO_INSTANCES_URL, "GET", {
    apiKey: EVO_API_KEY,
    timeoutMs: 12_000,
    retries: 1,
  });
  if (!result.ok) return "";
  for (const item of parseEvoInstancesList(result.json)) {
    const row = extractPhoneFromEvoListItem(item);
    if (row && row.instanceName.toLowerCase() === needle && row.phone) {
      return row.phone;
    }
  }
  return "";
}

export async function isEvoInstanceOpen(instanceName: string): Promise<boolean> {
  const needle = instanceName.trim().toLowerCase();
  if (!needle) return false;

  const liveState = await fetchEvoInstanceLiveState(instanceName, { fresh: true });
  if (liveState) {
    return isEvoLiveStateOpen(liveState);
  }

  const listResult = await evoHttpRequest(EVO_INSTANCES_URL, "GET", {
    apiKey: EVO_API_KEY,
    timeoutMs: 12_000,
    retries: 1,
  });
  if (listResult.ok) {
    for (const item of parseEvoInstancesList(listResult.json)) {
      const row = extractPhoneFromEvoListItem(item);
      if (row && row.instanceName.toLowerCase() === needle) {
        return row.open;
      }
    }
  }

  return false;
}

export async function resolveEvoInstancePhone(
  instanceName: string,
  options?: { hint?: string }
): Promise<string> {
  const name = String(instanceName || "").trim();
  if (!name) return "";

  const hint = normalizeEvoWhatsAppNumber(String(options?.hint || "").trim());

  const fromList = await fetchPhoneFromInstancesList(name);
  if (fromList) return fromList;

  const fromState = await fetchPhoneFromConnectionState(name);
  if (fromState) return fromState;

  const fromProfile = await fetchPhoneFromProfile(name);
  if (fromProfile) return fromProfile;

  const fromCache = await readPhoneFromEvoCache(name);
  if (fromCache) return fromCache;

  if (hint) return hint;

  const tail = name.match(/(\d{10,13})$/);
  if (tail?.[1]) {
    const derived = normalizeEvoWhatsAppNumber(tail[1]);
    if (derived.length >= 12) return derived;
  }

  return "";
}
