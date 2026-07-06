import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { WabaSystemUser } from "../users/waba-system-user.repository";
import { resolveDataFile } from "../data-path";

export type MasterPromoteFromV02Bundle = {
  version: number;
  kind: "master";
  email: string;
  systemUser: WabaSystemUser;
  financeiroSplitConfig?: Record<string, unknown>;
  financeiroSettlements?: Array<Record<string, unknown>>;
  masterMenuSeen?: Partial<Record<string, string>>;
  aquecedorConfig?: Record<string, unknown>;
  billingOrders?: Array<Record<string, unknown>>;
  creditUsage?: Record<string, unknown> | null;
  bonusBalance?: Record<string, unknown> | null;
  instanceOwners?: Record<string, { ownerEmail: string; createdAt?: string; syncedFromWalkupProdAt?: string }>;
  /** Quando true, sobrescreve dono existente em instance-owners.json (transferência admin). */
  forceInstanceOwnerTransfer?: boolean;
  alternativaActivations?: Record<string, unknown> | null;
  campaigns?: Array<Record<string, unknown>>;
  campaignIntakes?: Array<Record<string, unknown>>;
  supportTickets?: never;
  aquecedorEnviosLog?: Array<Record<string, unknown>>;
  aquecedorLifecycleInstances?: Record<string, unknown> | null;
};

const normalizeEmail = (value: string): string => String(value || "").trim().toLowerCase();

const readJson = <T>(filePath: string, fallback: T): T => {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
};

const writeJsonAtomic = (filePath: string, data: unknown) => {
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  renameSync(tmp, filePath);
};

const mergeById = <T extends Record<string, unknown>>(
  list: T[],
  incoming: T[],
  idKey = "id",
): T[] => {
  const out = Array.isArray(list) ? [...list] : [];
  const index = new Map<string, number>();
  out.forEach((row, i) => {
    const id = String(row?.[idKey] || "").trim();
    if (id) index.set(id, i);
  });
  for (const row of incoming || []) {
    const id = String(row?.[idKey] || "").trim();
    if (!id) continue;
    const existingIdx = index.get(id);
    if (existingIdx !== undefined) out[existingIdx] = { ...out[existingIdx], ...row };
    else {
      index.set(id, out.length);
      out.push(row);
    }
  }
  return out;
};

const rewriteIntakePathsForDataDir = (intake: Record<string, unknown>, dataDir: string) => {
  const id = String(intake?.id || "").trim();
  if (!id) return intake;
  const storageDir = path.join(dataDir, "campaign-intakes", id);
  const next = { ...intake };
  for (const field of ["imageStoredPath", "spreadsheetStoredPath", "spreadsheetTrimmedPath"]) {
    const baseName = path.basename(String(next[field] || ""));
    if (!baseName) continue;
    next[field] = path.join(storageDir, baseName);
  }
  return next;
};

export class WabaAdminMasterPromoteService {
  promoteFromV02Bundle(bundle: MasterPromoteFromV02Bundle) {
    const email = normalizeEmail(bundle.email);
    if (!email.includes("@")) throw new Error("E-mail inválido no bundle.");
    const systemUser = bundle.systemUser;
    if (!systemUser?.passwordHash || normalizeEmail(systemUser.email) !== email) {
      throw new Error("Bundle de master inválido.");
    }
    if (String(systemUser.role || "").toLowerCase() !== "master") {
      throw new Error("O bundle não corresponde a um usuário master.");
    }

    const summary: Record<string, unknown> = {
      ok: true,
      email,
      kind: "master",
      systemUser: "updated",
      financeiroSplitConfig: false,
      financeiroSettlementsMerged: 0,
      masterMenuSeen: false,
      aquecedorConfig: false,
      billingOrdersAdded: 0,
      creditUsage: false,
      bonusBalance: false,
      instanceOwners: 0,
      alternativaActivations: false,
      campaignsMerged: 0,
      campaignIntakesMerged: 0,
      aquecedorEnviosLogMerged: 0,
      aquecedorLifecycleInstances: 0,
      skippedSubscriberRecords: true,
    };

    const usersPath = resolveDataFile("waba-system-users.json");
    const usersStore = readJson<{ version: number; users: WabaSystemUser[] }>(usersPath, {
      version: 1,
      users: [],
    });
    if (!Array.isArray(usersStore.users)) usersStore.users = [];
    const userIdx = usersStore.users.findIndex((row) => normalizeEmail(row.email) === email);
    const userPayload: WabaSystemUser = {
      ...systemUser,
      email,
      role: "master",
      updatedAt: new Date().toISOString(),
    };
    if (userIdx >= 0) {
      usersStore.users[userIdx] = {
        ...usersStore.users[userIdx],
        ...userPayload,
        id: usersStore.users[userIdx].id,
      };
      summary.systemUser = "updated";
    } else {
      usersStore.users.push(userPayload);
      summary.systemUser = "created";
    }
    writeJsonAtomic(usersPath, usersStore);

    if (bundle.financeiroSplitConfig && typeof bundle.financeiroSplitConfig === "object") {
      writeJsonAtomic(
        resolveDataFile("waba-financeiro-split-config.json"),
        bundle.financeiroSplitConfig,
      );
      summary.financeiroSplitConfig = true;
    }

    if (Array.isArray(bundle.financeiroSettlements) && bundle.financeiroSettlements.length > 0) {
      const settlementsPath = resolveDataFile("waba-financeiro-split-settlements.json");
      const settlementsStore = readJson<{ version: number; settlements: Array<Record<string, unknown>> }>(
        settlementsPath,
        { version: 1, settlements: [] },
      );
      if (!Array.isArray(settlementsStore.settlements)) settlementsStore.settlements = [];
      settlementsStore.settlements = mergeById(
        settlementsStore.settlements,
        bundle.financeiroSettlements,
      );
      writeJsonAtomic(settlementsPath, settlementsStore);
      summary.financeiroSettlementsMerged = bundle.financeiroSettlements.length;
    }

    if (bundle.masterMenuSeen && typeof bundle.masterMenuSeen === "object") {
      const seenPath = resolveDataFile("waba-master-menu-seen.json");
      const seenStore = readJson<{ version: number; masters: Record<string, Record<string, string>> }>(
        seenPath,
        { version: 1, masters: {} },
      );
      if (!seenStore.masters || typeof seenStore.masters !== "object") seenStore.masters = {};
      const mergedSeen: Record<string, string> = { ...(seenStore.masters[email] ?? {}) };
      for (const [key, value] of Object.entries(bundle.masterMenuSeen)) {
        if (typeof value === "string" && value.trim()) mergedSeen[key] = value.trim();
      }
      seenStore.masters[email] = mergedSeen;
      writeJsonAtomic(seenPath, seenStore);
      summary.masterMenuSeen = true;
    }

    if (bundle.aquecedorConfig && typeof bundle.aquecedorConfig === "object") {
      writeJsonAtomic(resolveDataFile("aquecedor-config.json"), bundle.aquecedorConfig);
      summary.aquecedorConfig = true;
    }

    const ordersPath = resolveDataFile("waba-billing-orders.json");
    const orders = readJson<Array<Record<string, unknown>>>(ordersPath, []);
    const orderList = Array.isArray(orders) ? orders : [];
    const knownOrderIds = new Set(orderList.map((row) => String(row?.id || "").trim()).filter(Boolean));
    for (const order of bundle.billingOrders || []) {
      if (normalizeEmail(String(order?.ownerEmail || "")) !== email) continue;
      const id = String(order?.id || "").trim();
      if (!id || knownOrderIds.has(id)) continue;
      orderList.unshift(order);
      knownOrderIds.add(id);
      summary.billingOrdersAdded = Number(summary.billingOrdersAdded) + 1;
    }
    writeJsonAtomic(ordersPath, orderList);

    if (bundle.creditUsage) {
      const usagePath = resolveDataFile("waba-disparos-credit-usage.json");
      const usageStore = readJson<{ version: number; entries: Array<Record<string, unknown>> }>(
        usagePath,
        { version: 2, entries: [] },
      );
      if (!Array.isArray(usageStore.entries)) usageStore.entries = [];
      const entry = { ...bundle.creditUsage, email };
      const usageIdx = usageStore.entries.findIndex((row) => normalizeEmail(String(row?.email || "")) === email);
      if (usageIdx >= 0) usageStore.entries[usageIdx] = entry;
      else usageStore.entries.push(entry);
      writeJsonAtomic(usagePath, usageStore);
      summary.creditUsage = true;
    }

    if (bundle.bonusBalance) {
      const bonusPath = resolveDataFile("waba-disparos-bonus-balances.json");
      const bonusStore = readJson<{ version: number; entries: Array<Record<string, unknown>> }>(
        bonusPath,
        { version: 2, entries: [] },
      );
      if (!Array.isArray(bonusStore.entries)) bonusStore.entries = [];
      const entry = { ...bundle.bonusBalance, email };
      const bonusIdx = bonusStore.entries.findIndex((row) => normalizeEmail(String(row?.email || "")) === email);
      if (bonusIdx >= 0) bonusStore.entries[bonusIdx] = entry;
      else bonusStore.entries.push(entry);
      writeJsonAtomic(bonusPath, bonusStore);
      summary.bonusBalance = true;
    }

    const ownersPath = resolveDataFile("instance-owners.json");
    const ownersStore = readJson<{ instances: Record<string, Record<string, unknown>> }>(ownersPath, {
      instances: {},
    });
    if (!ownersStore.instances || typeof ownersStore.instances !== "object") ownersStore.instances = {};
    const now = new Date().toISOString();
    const forceTransfer = bundle.forceInstanceOwnerTransfer === true;
    for (const [name, meta] of Object.entries(bundle.instanceOwners || {})) {
      const key = String(name || "").trim();
      if (!key || normalizeEmail(String(meta?.ownerEmail || "")) !== email) continue;
      const existingOwner = normalizeEmail(String(ownersStore.instances[key]?.ownerEmail || ""));
      if (existingOwner && existingOwner !== email && !forceTransfer) continue;
      ownersStore.instances[key] = {
        ownerEmail: email,
        createdAt: String(meta?.createdAt || now),
        ...(meta?.syncedFromWalkupProdAt
          ? { syncedFromWalkupProdAt: String(meta.syncedFromWalkupProdAt) }
          : { promotedFromV02At: now }),
        ...(forceTransfer && existingOwner && existingOwner !== email
          ? { transferredAt: now, transferredFrom: existingOwner }
          : {}),
      };
      summary.instanceOwners = Number(summary.instanceOwners) + 1;
    }
    writeJsonAtomic(ownersPath, ownersStore);

    if (bundle.alternativaActivations) {
      const actPath = resolveDataFile("alternativa-number-activations.json");
      const actStore = readJson<{ byEmail: Record<string, unknown> }>(actPath, { byEmail: {} });
      if (!actStore.byEmail || typeof actStore.byEmail !== "object") actStore.byEmail = {};
      actStore.byEmail[email] = bundle.alternativaActivations;
      writeJsonAtomic(actPath, actStore);
      summary.alternativaActivations = true;
    }

    const dispatchPath = resolveDataFile("disparos-local-state.json");
    const dispatchStore = readJson<{ version: number; campaigns: Array<Record<string, unknown>>; savedAt?: string }>(
      dispatchPath,
      { version: 1, campaigns: [] },
    );
    if (!Array.isArray(dispatchStore.campaigns)) dispatchStore.campaigns = [];
    const masterCampaigns = (bundle.campaigns || []).filter(
      (row) => normalizeEmail(String(row?.ownerEmail || "")) === email,
    );
    dispatchStore.campaigns = mergeById(dispatchStore.campaigns, masterCampaigns);
    dispatchStore.savedAt = new Date().toISOString();
    summary.campaignsMerged = masterCampaigns.length;
    writeJsonAtomic(dispatchPath, dispatchStore);

    const intakesPath = resolveDataFile("waba-campaign-intakes.json");
    const intakesStore = readJson<{ version: number; intakes: Array<Record<string, unknown>> }>(
      intakesPath,
      { version: 1, intakes: [] },
    );
    if (!Array.isArray(intakesStore.intakes)) intakesStore.intakes = [];
    const dataDir = path.dirname(intakesPath);
    const masterIntakes = (bundle.campaignIntakes || [])
      .filter((row) => normalizeEmail(String(row?.ownerEmail || "")) === email)
      .map((row) => rewriteIntakePathsForDataDir(row, dataDir));
    intakesStore.intakes = mergeById(intakesStore.intakes, masterIntakes);
    summary.campaignIntakesMerged = masterIntakes.length;
    writeJsonAtomic(intakesPath, intakesStore);

    if ((bundle.aquecedorEnviosLog || []).length > 0) {
      const logPath = resolveDataFile("aquecedor-envios-log.json");
      const logStore = readJson<{ items?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(
        logPath,
        { items: [] },
      );
      const logList = Array.isArray(logStore)
        ? logStore
        : Array.isArray(logStore.items)
          ? logStore.items
          : [];
      const masterLog = (bundle.aquecedorEnviosLog || []).filter(
        (row) => normalizeEmail(String(row?.ownerEmail || "")) === email,
      );
      const merged = mergeById(logList, masterLog);
      writeJsonAtomic(logPath, { items: merged });
      summary.aquecedorEnviosLogMerged = masterLog.length;
    }

    if (bundle.aquecedorLifecycleInstances && Object.keys(bundle.aquecedorLifecycleInstances).length > 0) {
      const lifePath = resolveDataFile("aquecedor-instance-lifecycle.json");
      const lifeStore = readJson<{ version: number; instances: Record<string, unknown> }>(lifePath, {
        version: 1,
        instances: {},
      });
      if (!lifeStore.instances || typeof lifeStore.instances !== "object") lifeStore.instances = {};
      for (const [name, row] of Object.entries(bundle.aquecedorLifecycleInstances)) {
        const ownerInBundle = normalizeEmail(String((bundle.instanceOwners || {})[name]?.ownerEmail || email));
        if (ownerInBundle !== email) continue;
        lifeStore.instances[name] = row;
        summary.aquecedorLifecycleInstances = Number(summary.aquecedorLifecycleInstances) + 1;
      }
      writeJsonAtomic(lifePath, lifeStore);
    }

    return summary;
  }
}
