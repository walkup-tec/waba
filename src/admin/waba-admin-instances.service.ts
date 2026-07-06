import { existsSync, readFileSync } from "node:fs";
import { evoHttpRequest } from "../evo-http.client";
import { resolveEvoInstanceKey } from "../instances/evo-instance-key";
import { wabaInstanceOwnershipService } from "../instances/waba-instance-ownership.service";
import { resolveDataFile } from "../data-path";

const EVO_API_BASE = String(process.env.EVO_API_URL || "").replace(/\/+$/, "");
const EVO_API_KEY = String(process.env.EVO_API_KEY || "").trim();
const EVO_INSTANCES_URL =
  String(process.env.EVO_INSTANCES_URL || "").trim() ||
  `${EVO_API_BASE}/instance/fetchInstances`;

function normalizeEmail(value: string): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeDigits(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

function buildPhoneVariants(rawDigits: string): Set<string> {
  const digits = normalizeDigits(rawDigits);
  const out = new Set<string>();
  if (!digits) return out;
  out.add(digits);
  if (digits.startsWith("55")) out.add(digits.slice(2));
  if (digits.length > 11) out.add(digits.slice(-11));
  if (digits.length > 10) out.add(digits.slice(-10));
  if (digits.length > 9) out.add(digits.slice(-9));
  if (digits.length > 8) out.add(digits.slice(-8));
  if (!digits.startsWith("55") && digits.length >= 10) out.add(`55${digits}`);
  return out;
}

function phonesLooselyMatch(queryDigits: string, instanceDigits: string): boolean {
  const query = buildPhoneVariants(queryDigits);
  const instance = buildPhoneVariants(instanceDigits);
  for (const value of query) {
    if (instance.has(value)) return true;
  }
  const querySuffixes = [...query].map((v) => v.slice(-8)).filter((v) => v.length >= 8);
  const instanceSuffixes = [...instance].map((v) => v.slice(-8)).filter((v) => v.length >= 8);
  return querySuffixes.some((suffix) => instanceSuffixes.includes(suffix));
}

function extractInstanceNumber(inst: Record<string, unknown>): string {
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
  if (text.includes("@")) return normalizeDigits(text.split("@")[0] || text);
  return normalizeDigits(text);
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

function readOwnersSnapshot(): Record<string, { ownerEmail?: string; createdAt?: string }> {
  const filePath = resolveDataFile("instance-owners.json");
  if (!existsSync(filePath)) return {};
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as {
      instances?: Record<string, { ownerEmail?: string; createdAt?: string }>;
    };
    return parsed?.instances && typeof parsed.instances === "object" ? parsed.instances : {};
  } catch {
    return {};
  }
}

function resolveOwnerForInstance(
  instanceName: string,
  owners: Record<string, { ownerEmail?: string; createdAt?: string }>,
): string | null {
  const target = String(instanceName || "").trim().toLowerCase();
  if (!target) return null;
  for (const [name, meta] of Object.entries(owners)) {
    if (name.toLowerCase() !== target) continue;
    const email = normalizeEmail(String(meta?.ownerEmail || ""));
    return email.includes("@") ? email : null;
  }
  return null;
}

export type AdminInstanceLookupRow = {
  instanceName: string;
  number: string;
  connectionStatus: string;
  ownerEmail: string | null;
};

export class WabaAdminInstancesService {
  private async fetchEvoInstances(): Promise<Array<Record<string, unknown>>> {
    if (!EVO_API_BASE || !EVO_API_KEY) {
      throw new Error("Sistema WABA - Drax não configurado (EVO_API_URL / EVO_API_KEY).");
    }
    const result = await evoHttpRequest(EVO_INSTANCES_URL, "GET", {
      apiKey: EVO_API_KEY,
      retries: 2,
      timeoutMs: 25000,
    });
    if (!result.ok) {
      throw new Error(
        `Falha ao listar instâncias no sistema WABA - Drax (${result.status}): ${String(result.body || result.error || "").slice(0, 180)}`,
      );
    }
    return parseEvoInstancesList(result.json);
  }

  async lookupByPhone(phone: string): Promise<AdminInstanceLookupRow[]> {
    const query = normalizeDigits(phone);
    if (query.length < 8) {
      throw new Error("Informe um número WhatsApp válido (mínimo 8 dígitos).");
    }
    const owners = readOwnersSnapshot();
    const instances = await this.fetchEvoInstances();
    const rows: AdminInstanceLookupRow[] = [];
    for (const inst of instances) {
      const instanceName = resolveEvoInstanceKey(inst);
      const number = extractInstanceNumber(inst);
      if (!instanceName || !number) continue;
      if (!phonesLooselyMatch(query, number)) continue;
      rows.push({
        instanceName,
        number,
        connectionStatus: String(inst.connectionStatus || "unknown"),
        ownerEmail: resolveOwnerForInstance(instanceName, owners),
      });
    }
    return rows.sort((a, b) => a.instanceName.localeCompare(b.instanceName, "pt-BR"));
  }

  async transferOwner(input: {
    instanceName?: string;
    phone?: string;
    targetEmail: string;
  }): Promise<{
    transferred: Array<{
      instanceName: string;
      number: string;
      previousOwner: string | null;
      newOwner: string;
    }>;
  }> {
    const targetEmail = normalizeEmail(input.targetEmail);
    if (!targetEmail.includes("@")) {
      throw new Error("Informe o e-mail de destino válido.");
    }

    let instanceNames: string[] = [];
    if (input.instanceName) {
      instanceNames = [String(input.instanceName).trim()].filter(Boolean);
    } else if (input.phone) {
      const matches = await this.lookupByPhone(String(input.phone));
      if (!matches.length) {
        throw new Error("Nenhuma instância encontrada no sistema WABA - Drax para esse número.");
      }
      instanceNames = matches.map((row) => row.instanceName);
    } else {
      throw new Error("Informe instanceName ou phone.");
    }

    const owners = readOwnersSnapshot();
    const instances = await this.fetchEvoInstances();
    const byName = new Map<string, Record<string, unknown>>();
    for (const inst of instances) {
      const name = resolveEvoInstanceKey(inst);
      if (name) byName.set(name.toLowerCase(), inst);
    }

    const transferred: Array<{
      instanceName: string;
      number: string;
      previousOwner: string | null;
      newOwner: string;
    }> = [];

    for (const instanceName of instanceNames) {
      const inst = byName.get(instanceName.toLowerCase());
      const number = inst ? extractInstanceNumber(inst) : "";
      const previousOwner = resolveOwnerForInstance(instanceName, owners);
      await wabaInstanceOwnershipService.assignOwner(instanceName, targetEmail);
      transferred.push({
        instanceName,
        number,
        previousOwner,
        newOwner: targetEmail,
      });
    }

    return { transferred };
  }
}
