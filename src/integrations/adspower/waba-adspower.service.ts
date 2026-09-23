import { timingSafeEqual } from "node:crypto";
import type { WabaRequestAuth } from "../../auth/waba-request-auth";
import {
  listAdsPowerRemoteProfiles,
  probeAdsPowerBridge,
  resolveAdsPowerIngestToken,
  startAdsPowerProfile,
} from "./waba-adspower.client";
import { WabaAdsPowerRepository } from "./waba-adspower.repository";
import type {
  AdsPowerBridgeStatus,
  AdsPowerIngestItem,
  AdsPowerProfileRecord,
} from "./waba-adspower.types";

const repository = new WabaAdsPowerRepository();

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function unixToIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (Number.isFinite(n) && n > 1_000_000_000) {
    const ms = n > 10_000_000_000 ? n : n * 1000;
    return new Date(ms).toISOString();
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function normalizeAdsPowerIngestItem(raw: AdsPowerIngestItem): AdsPowerProfileRecord | null {
  const userId = asText(raw.userId || raw.user_id);
  if (!userId) return null;
  return {
    userId,
    serialNumber: asText(raw.serialNumber || raw.serial_number),
    name: asText(raw.name) || userId,
    groupId: asText(raw.groupId || raw.group_id),
    groupName: asText(raw.groupName || raw.group_name),
    remark: asText(raw.remark),
    ipCountry: asText(raw.ipCountry || raw.ip_country).toLowerCase(),
    lastOpenTime: unixToIso(raw.lastOpenTime ?? raw.last_open_time),
    ingestedAt: new Date().toISOString(),
    connectionId: null,
    wabaId: null,
    phoneNumberId: null,
    displayPhoneNumber: null,
    verifiedName: null,
  };
}

export function timingSafeEqualText(expected: string, received: string): boolean {
  const a = Buffer.from(String(expected || ""), "utf8");
  const b = Buffer.from(String(received || ""), "utf8");
  if (!a.length || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function readBearerToken(header: string | undefined): string {
  const raw = String(header || "").trim();
  const match = /^Bearer\s+(.+)$/i.exec(raw);
  return match ? String(match[1] || "").trim() : raw;
}

export function applyAdsPowerSnapshot(
  current: AdsPowerProfileRecord[],
  incoming: AdsPowerProfileRecord[],
  prune: boolean,
): { profiles: AdsPowerProfileRecord[]; upserted: number; pruned: number } {
  const byId = new Map(current.map((row) => [row.userId, row]));
  const merged = incoming.map((row) => {
    const prev = byId.get(row.userId);
    if (!prev) return row;
    return {
      ...row,
      connectionId: prev.connectionId,
      wabaId: prev.wabaId,
      phoneNumberId: prev.phoneNumberId,
      displayPhoneNumber: prev.displayPhoneNumber,
      verifiedName: prev.verifiedName,
    };
  });
  if (!prune) {
    const kept = new Map(current.map((row) => [row.userId, row]));
    for (const row of merged) kept.set(row.userId, row);
    return { profiles: [...kept.values()], upserted: merged.length, pruned: 0 };
  }
  const keptIds = new Set(merged.map((row) => row.userId));
  const pruned = current.filter((row) => !keptIds.has(row.userId)).length;
  return { profiles: merged, upserted: merged.length, pruned };
}

export function findWabaProfileClash(
  profiles: AdsPowerProfileRecord[],
  userId: string,
  wabaId: string,
): AdsPowerProfileRecord | null {
  const id = asText(userId);
  const waba = asText(wabaId);
  if (!waba) return null;
  return profiles.find((row) => row.userId !== id && row.wabaId === waba) ?? null;
}

function requireOperator(auth: WabaRequestAuth): void {
  if (!auth.email || auth.role === "guest") {
    const err = new Error("Faça login para ver os perfis AdsPower.");
    (err as { status?: number }).status = 401;
    throw err;
  }
  if (auth.role === "subscriber" || auth.role === "indicador") {
    const err = new Error("Sem permissão para os perfis AdsPower.");
    (err as { status?: number }).status = 403;
    throw err;
  }
}

export class WabaAdsPowerService {
  async status(): Promise<AdsPowerBridgeStatus> {
    return probeAdsPowerBridge();
  }

  list(auth: WabaRequestAuth): AdsPowerProfileRecord[] {
    requireOperator(auth);
    return repository.list();
  }

  ingest(
    items: AdsPowerIngestItem[],
    opts?: { prune?: boolean },
  ): { upserted: number; pruned: number; profiles: AdsPowerProfileRecord[] } {
    const incoming = items.map(normalizeAdsPowerIngestItem).filter((row): row is AdsPowerProfileRecord => Boolean(row));
    const current = repository.list();
    if (!incoming.length) return { upserted: 0, pruned: 0, profiles: current };
    const prune = opts?.prune !== false;
    const snapshot = applyAdsPowerSnapshot(current, incoming, prune);
    if (prune) repository.replaceAll(snapshot.profiles);
    else repository.upsertMany(snapshot.profiles);
    return {
      upserted: snapshot.upserted,
      pruned: snapshot.pruned,
      profiles: repository.list(),
    };
  }

  async pullFromLocalApi(auth: WabaRequestAuth) {
    requireOperator(auth);
    try {
      const remote = await listAdsPowerRemoteProfiles();
      return { source: "local-api" as const, ...this.ingest(remote) };
    } catch {
      return {
        source: "ingest" as const,
        upserted: 0,
        profiles: this.list(auth),
        detail: "A Local API não responde neste servidor. Rode o script no PC com AdsPower e clique em Atualizar.",
      };
    }
  }

  bind(
    auth: WabaRequestAuth,
    userId: string,
    input: {
      connectionId?: string;
      wabaId?: string;
      phoneNumberId?: string;
      displayPhoneNumber?: string;
      verifiedName?: string;
    },
  ): AdsPowerProfileRecord {
    requireOperator(auth);
    const id = asText(userId);
    const current = repository.getByUserId(id);
    if (!current) {
      const err = new Error("Perfil AdsPower não encontrado. Sincronize a lista primeiro.");
      (err as { status?: number }).status = 404;
      throw err;
    }
    const wabaId = asText(input.wabaId) || null;
    if (wabaId) {
      const clash = findWabaProfileClash(repository.list(), id, wabaId);
      if (clash) {
        const err = new Error(
          `Este WABA já está no perfil “${clash.name}” (${clash.userId}). Um perfil AdsPower = uma conta WABA.`,
        );
        (err as { status?: number }).status = 409;
        throw err;
      }
    }
    return repository.save({
      ...current,
      connectionId: asText(input.connectionId) || null,
      wabaId,
      phoneNumberId: asText(input.phoneNumberId) || null,
      displayPhoneNumber: asText(input.displayPhoneNumber) || null,
      verifiedName: asText(input.verifiedName) || null,
    });
  }

  unbind(auth: WabaRequestAuth, userId: string): AdsPowerProfileRecord {
    return this.bind(auth, userId, {
      connectionId: "",
      wabaId: "",
      phoneNumberId: "",
      displayPhoneNumber: "",
      verifiedName: "",
    });
  }

  async open(auth: WabaRequestAuth, userId: string) {
    requireOperator(auth);
    const profile = repository.getByUserId(asText(userId));
    if (!profile) {
      const err = new Error("Perfil AdsPower não encontrado.");
      (err as { status?: number }).status = 404;
      throw err;
    }
    const started = await startAdsPowerProfile(profile.userId);
    return { profile, ...started };
  }
}

export function assertAdsPowerIngestAuthorized(authorizationHeader: string | undefined): void {
  const expected = resolveAdsPowerIngestToken();
  if (!expected) {
    const err = new Error("ADSPOWER_INGEST_TOKEN não configurado no servidor.");
    (err as { status?: number }).status = 503;
    throw err;
  }
  const received = readBearerToken(authorizationHeader);
  if (!timingSafeEqualText(expected, received)) {
    const err = new Error("Token de ingest AdsPower inválido.");
    (err as { status?: number }).status = 401;
    throw err;
  }
}

export const wabaAdsPowerService = new WabaAdsPowerService();
