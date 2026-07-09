import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { resolveDataDir, resolveDataFile } from "../data-path";
import type { WabaDispatchesApiKind } from "./waba-dispatches-api-kind";

export type WabaCampaignIntakeStatus =
  | "generated"
  | "in_progress"
  | "completed"
  | "error_reported"
  | "cancelled";

export type WabaCampaignErrorReport = {
  justification: string;
  reportedAt: string;
  reportedByEmail: string;
};

export type WabaCampaignPerformanceReport = {
  totalLeads: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  filledAt: string;
  filledByEmail: string;
};

export type WabaCampaignOperacionalNotifyAudit = {
  attemptedAt: string;
  apiKind: WabaDispatchesApiKind;
  apiKindLabel: string;
  recipients: {
    email: string;
    fullName: string;
    status: "sent" | "skipped" | "failed";
    message: string;
    messageId?: string;
    emailStatus?: "sent" | "skipped" | "failed";
    emailMessage?: string;
    emailMessageId?: string;
    whatsapp?: string;
    whatsappStatus?: "sent" | "skipped" | "failed";
    whatsappMessage?: string;
    whatsappInstanceName?: string;
  }[];
};

export type WabaCampaignAssignmentHistoryEntry = {
  at: string;
  supplierId: string;
  operacionalEmail: string;
  reason: "initial" | "bm_inoperante" | "timeout_30h";
};

export type WabaCampaignIntake = {
  id: string;
  ownerEmail: string;
  campaignName: string;
  regionDdd: string;
  textOptions: [string, string, string];
  /** Link de resposta (CTA) informado pelo assinante no wizard. */
  responseLink?: string;
  imageFileName: string;
  imageStoredPath: string;
  spreadsheetFileName: string;
  spreadsheetStoredPath: string;
  /** Planilha já limitada a `plannedSendCount` linhas (para o time operacional). */
  spreadsheetTrimmedPath?: string;
  spreadsheetTrimmedFileName?: string;
  /** Linhas lidas na planilha de leads (primeira aba). */
  importedLineCount: number;
  /** Envios efetivos da campanha (nunca acima do saldo contratado). */
  plannedSendCount: number;
  /** Plano de disparos contratado (roteamento operacional). */
  apiKind?: WabaDispatchesApiKind;
  status: WabaCampaignIntakeStatus;
  startedAt?: string;
  startedByEmail?: string;
  performanceReport?: WabaCampaignPerformanceReport;
  errorReport?: WabaCampaignErrorReport;
  /** Última tentativa de e-mail ao operacional designado. */
  operacionalNotifyAudit?: WabaCampaignOperacionalNotifyAudit;
  /** Operacional atualmente responsável pela campanha. */
  assignedOperacionalEmail?: string;
  assignedSupplierId?: string;
  assignedAt?: string;
  assignmentHistory?: WabaCampaignAssignmentHistoryEntry[];
  /** Alerta master (sininho) enviado quando fila esgotada + 30h. */
  masterOverdueAlertSentAt?: string;
  /** Settlement PIX do fornecedor após finalizar campanha. */
  supplierPayoutSettlementId?: string;
  /** Chave idempotente do cliente (evita duplicar campanha em retry/timeout). */
  clientRequestId?: string;
  /** Hash leve do envio (nome, DDD, envios, API, tamanhos) — dedupe de duplo clique. */
  submissionFingerprint?: string;
  createdAt: string;
  updatedAt: string;
};

type Store = {
  version: 1;
  intakes: WabaCampaignIntake[];
};

const STORE_FILE = resolveDataFile("waba-campaign-intakes.json");

export const resolveCampaignIntakeStorageDir = (intakeId: string): string => {
  const base = resolveDataDir();
  const dir = `${base}/campaign-intakes/${intakeId}`;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
};

const emptyStore = (): Store => ({ version: 1, intakes: [] });

const ensureStore = () => {
  const folder = dirname(STORE_FILE);
  if (!existsSync(folder)) mkdirSync(folder, { recursive: true });
  if (!existsSync(STORE_FILE)) {
    writeFileSync(STORE_FILE, JSON.stringify(emptyStore(), null, 2), "utf-8");
  }
};

const readStore = (): Store => {
  ensureStore();
  try {
    const parsed = JSON.parse(readFileSync(STORE_FILE, "utf-8")) as Store;
    if (parsed?.version !== 1 || !Array.isArray(parsed.intakes)) return emptyStore();
    return parsed;
  } catch {
    return emptyStore();
  }
};

const writeStore = (store: Store) => {
  ensureStore();
  const payload = JSON.stringify(store, null, 2);
  const tmp = `${STORE_FILE}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, payload, "utf-8");
  renameSync(tmp, STORE_FILE);
};

export class WabaCampaignIntakeRepository {
  create(intake: WabaCampaignIntake): WabaCampaignIntake {
    const store = readStore();
    store.intakes.unshift(intake);
    writeStore(store);
    return intake;
  }

  listAll(): WabaCampaignIntake[] {
    return readStore().intakes;
  }

  listByEmail(email: string): WabaCampaignIntake[] {
    const normalized = email.trim().toLowerCase();
    return readStore()
      .intakes.filter((item) => item.ownerEmail === normalized)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getById(id: string): WabaCampaignIntake | null {
    const normalized = String(id ?? "").trim();
    if (!normalized) return null;
    return readStore().intakes.find((item) => item.id === normalized) ?? null;
  }

  findByOwnerAndClientRequestId(
    ownerEmail: string,
    clientRequestId: string,
  ): WabaCampaignIntake | null {
    const email = ownerEmail.trim().toLowerCase();
    const requestId = String(clientRequestId ?? "").trim();
    if (!email || !requestId) return null;
    return (
      readStore().intakes.find(
        (item) =>
          item.ownerEmail === email &&
          String(item.clientRequestId || "").trim() === requestId,
      ) ?? null
    );
  }

  findRecentByOwnerAndSubmissionFingerprint(
    ownerEmail: string,
    submissionFingerprint: string,
    withinMs: number,
  ): WabaCampaignIntake | null {
    const email = ownerEmail.trim().toLowerCase();
    const fingerprint = String(submissionFingerprint ?? "").trim();
    if (!email || !fingerprint) return null;
    const cutoff = Date.now() - Math.max(30_000, withinMs);
    const matches = readStore()
      .intakes.filter((item) => {
        if (item.ownerEmail !== email) return false;
        if (String(item.submissionFingerprint || "").trim() !== fingerprint) return false;
        const createdMs = new Date(item.createdAt).getTime();
        return Number.isFinite(createdMs) && createdMs >= cutoff;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return matches[0] ?? null;
  }

  updateById(id: string, patch: Partial<WabaCampaignIntake>): WabaCampaignIntake | null {
    const normalized = String(id ?? "").trim();
    if (!normalized) return null;
    const store = readStore();
    const index = store.intakes.findIndex((item) => item.id === normalized);
    if (index < 0) return null;
    store.intakes[index] = { ...store.intakes[index], ...patch };
    writeStore(store);
    return store.intakes[index];
  }
}
