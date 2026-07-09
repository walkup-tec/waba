import { promises as fs } from "fs";
import path from "path";
import { hostname } from "os";
import { resolveDataFile } from "../data-path";

export type AquecedorRuntimeStatus = {
  running: boolean;
  isProcessing: boolean;
  nextAllowedAt: string | null;
  lastRunAt: string | null;
  lastResult: string | null;
  lastEvoError: { status: number; body: string; instance: string; numeroLen: number } | null;
};

export type AquecedorRuntimePersistedSnapshot = AquecedorRuntimeStatus & {
  workerId: string | null;
  workerHeartbeatAt: string | null;
  /** Índice de rotação de pares — isolado por proprietário (não usar controle_ciclo global). */
  cicloGlobal?: number;
};

export type AquecedorConnectedSummary = {
  count: number;
  names: string[];
  preparingCount: number;
  preparingNames: string[];
  totalEnabled: number;
  at: number;
};

export type AquecedorOwnerMotor = {
  ownerEmail: string;
  runtime: AquecedorRuntimeStatus;
  desired: boolean | null;
  snapshot: AquecedorRuntimePersistedSnapshot;
  scheduleTimer: NodeJS.Timeout | null;
  connectedSummary: AquecedorConnectedSummary;
};

const RUNTIME_INTENT_FILE = resolveDataFile("runtime-intent.json");
const AQUECEDOR_WORKER_LEASE_MS = 90_000;
const AQUECEDOR_PERSISTED_RELOAD_MS = 2_000;
const AQUECEDOR_PROCESSING_STALE_MS = 8 * 60 * 1000;
export const AQUECEDOR_OWNER_WORKER_ID = `${hostname()}:${process.pid}`;

const emptyConnectedSummary = (): AquecedorConnectedSummary => ({
  count: 0,
  names: [],
  preparingCount: 0,
  preparingNames: [],
  totalEnabled: 0,
  at: 0,
});

export function createDefaultAquecedorRuntimeSnapshot(): AquecedorRuntimePersistedSnapshot {
  return {
    running: false,
    isProcessing: false,
    nextAllowedAt: null,
    lastRunAt: null,
    lastResult: null,
    lastEvoError: null,
    workerId: null,
    workerHeartbeatAt: null,
  };
}

function createDefaultRuntime(): AquecedorRuntimeStatus {
  return {
    running: false,
    isProcessing: false,
    nextAllowedAt: null,
    lastRunAt: null,
    lastResult: null,
    lastEvoError: null,
  };
}

const ownerMotors = new Map<string, AquecedorOwnerMotor>();
let persistedSavedAtMs = 0;
let persistedReloadedAt = 0;

export function normalizeAquecedorOwnerEmail(email: string | null | undefined): string | null {
  const normalized = String(email || "").trim().toLowerCase();
  return normalized.includes("@") ? normalized : null;
}

export function getAquecedorOwnerMotor(ownerEmail: string): AquecedorOwnerMotor {
  const key = normalizeAquecedorOwnerEmail(ownerEmail);
  if (!key) {
    throw new Error("E-mail de proprietário do aquecedor inválido.");
  }
  let motor = ownerMotors.get(key);
  if (!motor) {
    motor = {
      ownerEmail: key,
      runtime: createDefaultRuntime(),
      desired: null,
      snapshot: createDefaultAquecedorRuntimeSnapshot(),
      scheduleTimer: null,
      connectedSummary: emptyConnectedSummary(),
    };
    ownerMotors.set(key, motor);
  }
  return motor;
}

export function listAquecedorOwnerEmails(): string[] {
  return Array.from(ownerMotors.keys());
}

export function listAquecedorOwnersWithDesiredRunning(): string[] {
  return listAquecedorOwnerEmails().filter((email) => {
    const motor = ownerMotors.get(email);
    return motor?.desired === true;
  });
}

function isWorkerLeaseValid(snapshot: AquecedorRuntimePersistedSnapshot): boolean {
  if (!snapshot.workerHeartbeatAt) return false;
  const heartbeatMs = new Date(snapshot.workerHeartbeatAt).getTime();
  if (!Number.isFinite(heartbeatMs)) return false;
  return Date.now() - heartbeatMs <= AQUECEDOR_WORKER_LEASE_MS;
}

function isProcessingSnapshotStale(
  snapshot: Pick<AquecedorRuntimePersistedSnapshot, "isProcessing" | "lastRunAt">,
): boolean {
  if (!snapshot.isProcessing) return false;
  const lastRunMs = snapshot.lastRunAt ? new Date(snapshot.lastRunAt).getTime() : Number.NaN;
  if (!Number.isFinite(lastRunMs)) return true;
  return Date.now() - lastRunMs > AQUECEDOR_PROCESSING_STALE_MS;
}

export function applyPersistedSnapshotToMotor(
  motor: AquecedorOwnerMotor,
  snapshot: AquecedorRuntimePersistedSnapshot,
): void {
  motor.runtime.running = snapshot.running === true;
  motor.runtime.isProcessing =
    snapshot.isProcessing === true && !isProcessingSnapshotStale(snapshot);
  motor.runtime.nextAllowedAt = snapshot.nextAllowedAt;
  motor.runtime.lastRunAt = snapshot.lastRunAt;
  motor.runtime.lastResult = snapshot.lastResult;
  motor.runtime.lastEvoError = snapshot.lastEvoError;
  motor.snapshot = { ...snapshot };
}

export function buildPersistedSnapshotFromMotor(
  motor: AquecedorOwnerMotor,
  overrides: Partial<AquecedorRuntimePersistedSnapshot> = {},
): AquecedorRuntimePersistedSnapshot {
  return {
    running: motor.runtime.running,
    isProcessing: motor.runtime.isProcessing,
    nextAllowedAt: motor.runtime.nextAllowedAt,
    lastRunAt: motor.runtime.lastRunAt,
    lastResult: motor.runtime.lastResult,
    lastEvoError: motor.runtime.lastEvoError,
    workerId: motor.snapshot.workerId,
    workerHeartbeatAt: motor.snapshot.workerHeartbeatAt,
    cicloGlobal: getAquecedorOwnerCicloGlobal(motor),
    ...overrides,
  };
}

export function shouldProcessLeadOwnerMotor(motor: AquecedorOwnerMotor): boolean {
  if (motor.desired !== true || !motor.snapshot.running) return false;
  if (motor.snapshot.workerId === AQUECEDOR_OWNER_WORKER_ID) return true;
  if (!motor.snapshot.workerId || !isWorkerLeaseValid(motor.snapshot)) return true;
  return false;
}

function parseOwnerSnapshot(raw: unknown): AquecedorRuntimePersistedSnapshot {
  const snapRaw = (raw || {}) as Record<string, unknown>;
  return {
    running: snapRaw.running === true,
    isProcessing: snapRaw.isProcessing === true,
    nextAllowedAt: typeof snapRaw.nextAllowedAt === "string" ? snapRaw.nextAllowedAt : null,
    lastRunAt: typeof snapRaw.lastRunAt === "string" ? snapRaw.lastRunAt : null,
    lastResult: typeof snapRaw.lastResult === "string" ? snapRaw.lastResult : null,
    lastEvoError:
      snapRaw.lastEvoError && typeof snapRaw.lastEvoError === "object"
        ? (snapRaw.lastEvoError as AquecedorRuntimeStatus["lastEvoError"])
        : null,
    workerId: typeof snapRaw.workerId === "string" ? snapRaw.workerId : null,
    workerHeartbeatAt:
      typeof snapRaw.workerHeartbeatAt === "string" ? snapRaw.workerHeartbeatAt : null,
    cicloGlobal:
      typeof snapRaw.cicloGlobal === "number" && Number.isFinite(snapRaw.cicloGlobal)
        ? Math.max(0, Math.floor(snapRaw.cicloGlobal))
        : 0,
  };
}

export function getAquecedorOwnerCicloGlobal(motor: AquecedorOwnerMotor): number {
  const value = motor.snapshot.cicloGlobal;
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function setAquecedorOwnerCicloGlobal(motor: AquecedorOwnerMotor, value: number): void {
  motor.snapshot.cicloGlobal = Math.max(0, Math.floor(value));
}

function loadOwnerFromPersisted(
  ownerEmail: string,
  desired: boolean | null,
  snapshot: AquecedorRuntimePersistedSnapshot,
): void {
  const motor = getAquecedorOwnerMotor(ownerEmail);
  motor.desired = desired;
  applyPersistedSnapshotToMotor(motor, snapshot);
}

function parsePersistedOwners(raw: Record<string, unknown>): void {
  ownerMotors.clear();
  const version = Number(raw.version);

  if (version === 3 && raw.owners && typeof raw.owners === "object") {
    for (const [email, value] of Object.entries(raw.owners as Record<string, unknown>)) {
      const ownerEmail = normalizeAquecedorOwnerEmail(email);
      if (!ownerEmail) continue;
      const row = (value || {}) as Record<string, unknown>;
      const desired =
        typeof row.desired === "boolean" ? row.desired : row.desired === true ? true : null;
      const snapshot = parseOwnerSnapshot(row.snapshot);
      loadOwnerFromPersisted(ownerEmail, desired, snapshot);
    }
    return;
  }

  if (version === 1 || version === 2) {
    const desired =
      typeof raw.aquecedorRuntimeDesired === "boolean" ? raw.aquecedorRuntimeDesired : null;
    const ownerEmail = normalizeAquecedorOwnerEmail(
      typeof raw.aquecedorOwnerEmail === "string" ? raw.aquecedorOwnerEmail : null,
    );
    const snapshot = parseOwnerSnapshot(raw.aquecedorRuntimeSnapshot);
    if (version === 1) {
      snapshot.running = desired === true;
    }
    if (ownerEmail) {
      loadOwnerFromPersisted(ownerEmail, desired, snapshot);
    }
  }
}

export async function reloadAquecedorOwnerMotorsFromDisk(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - persistedReloadedAt < AQUECEDOR_PERSISTED_RELOAD_MS) {
    return;
  }
  persistedReloadedAt = now;
  try {
    const rawText = await fs.readFile(RUNTIME_INTENT_FILE, "utf-8");
    const parsed = JSON.parse(rawText) as Record<string, unknown>;
    const fileSavedAtMs = new Date(String(parsed.savedAt || "")).getTime();
    if (
      Number.isFinite(fileSavedAtMs) &&
      persistedSavedAtMs > 0 &&
      fileSavedAtMs < persistedSavedAtMs
    ) {
      return;
    }
    parsePersistedOwners(parsed);
    if (Number.isFinite(fileSavedAtMs)) {
      persistedSavedAtMs = fileSavedAtMs;
    }
  } catch {
    /* mantém cache em memória */
  }
}

async function writeAllOwnerMotorsToDisk(): Promise<void> {
  const owners: Record<string, { desired: boolean | null; snapshot: AquecedorRuntimePersistedSnapshot }> =
    {};
  for (const [email, motor] of ownerMotors.entries()) {
    owners[email] = {
      desired: motor.desired,
      snapshot: buildPersistedSnapshotFromMotor(motor),
    };
  }
  const savedAtMs = Date.now();
  const payload = {
    version: 3 as const,
    savedAt: new Date(savedAtMs).toISOString(),
    owners,
  };
  await fs.mkdir(path.dirname(RUNTIME_INTENT_FILE), { recursive: true });
  const tmp = `${RUNTIME_INTENT_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(payload, null, 2), "utf-8");
  await fs.rename(tmp, RUNTIME_INTENT_FILE);
  persistedSavedAtMs = savedAtMs;
}

export async function persistAquecedorOwnerSnapshot(
  ownerEmail: string,
  overrides: Partial<AquecedorRuntimePersistedSnapshot> = {},
): Promise<void> {
  const motor = getAquecedorOwnerMotor(ownerEmail);
  motor.snapshot = buildPersistedSnapshotFromMotor(motor, overrides);
  await writeAllOwnerMotorsToDisk();
}

export async function persistAquecedorOwnerIntent(
  ownerEmail: string,
  desired: boolean,
): Promise<void> {
  const motor = getAquecedorOwnerMotor(ownerEmail);
  motor.desired = desired;
  motor.snapshot = buildPersistedSnapshotFromMotor(motor, {
    running: desired,
    workerId: desired ? AQUECEDOR_OWNER_WORKER_ID : null,
    workerHeartbeatAt: desired ? new Date().toISOString() : null,
    isProcessing: desired ? motor.runtime.isProcessing : false,
  });
  await writeAllOwnerMotorsToDisk();
  console.log(
    `[Runtime] runtime-intent: aquecedor ${ownerEmail} desejado = ${desired ? "ligado" : "desligado"}.`,
  );
}

export function updateAquecedorOwnerConnectedSummary(
  ownerEmail: string,
  connected: Array<{ instancia: string; numero: string }>,
  connectedAll: Array<{ instancia: string; numero: string }> = connected,
): void {
  const motor = getAquecedorOwnerMotor(ownerEmail);
  const activeKeys = new Set(connected.map((item) => item.instancia.toLowerCase()));
  const preparingNames = connectedAll
    .filter((item) => !activeKeys.has(item.instancia.toLowerCase()))
    .map((item) => item.instancia);
  motor.connectedSummary = {
    count: connected.length,
    names: connected.map((item) => item.instancia),
    preparingCount: preparingNames.length,
    preparingNames,
    totalEnabled: connectedAll.length,
    at: Date.now(),
  };
}

export function buildAquecedorOwnerStatusPayload(ownerEmail: string) {
  const motor = getAquecedorOwnerMotor(ownerEmail);
  const desiredRunning = motor.desired === true;
  const workerActive = isWorkerLeaseValid(motor.snapshot);
  const running = desiredRunning && (motor.snapshot.running === true || workerActive);
  const summary = motor.connectedSummary;
  return {
    ...motor.snapshot,
    running,
    desiredRunning,
    persistedOwnerEmail: ownerEmail,
    ownerEmailBound: true,
    motorOwnedByMe: true,
    workerId: motor.snapshot.workerId,
    workerHeartbeatAt: motor.snapshot.workerHeartbeatAt,
    workerLeaseValid: isWorkerLeaseValid(motor.snapshot),
    connectedInstanceCount: summary.count,
    connectedInstances: summary.names,
    preparingInstanceCount: summary.preparingCount,
    preparingInstances: summary.preparingNames,
    totalAquecedorEnabledCount: summary.totalEnabled,
    connectedSummaryAt: summary.at ? new Date(summary.at).toISOString() : null,
  };
}

export function buildLiveAquecedorOwnerStatusPayload(ownerEmail: string) {
  const motor = getAquecedorOwnerMotor(ownerEmail);
  const base = buildAquecedorOwnerStatusPayload(ownerEmail);
  if (!shouldProcessLeadOwnerMotor(motor)) return base;
  return {
    ...base,
    running: motor.runtime.running,
    isProcessing: motor.runtime.isProcessing,
    nextAllowedAt: motor.runtime.nextAllowedAt,
    lastRunAt: motor.runtime.lastRunAt,
    lastResult: motor.runtime.lastResult,
    lastEvoError: motor.runtime.lastEvoError,
  };
}

export function stopAquecedorOwnerMotorLocal(ownerEmail: string): void {
  const motor = getAquecedorOwnerMotor(ownerEmail);
  motor.runtime.running = false;
  if (motor.scheduleTimer) {
    clearTimeout(motor.scheduleTimer);
    motor.scheduleTimer = null;
  }
}

export async function loadAquecedorOwnerRuntimeIntents(): Promise<
  Array<{ ownerEmail: string; desired: boolean | null }>
> {
  await reloadAquecedorOwnerMotorsFromDisk(true);
  return listAquecedorOwnerEmails().map((ownerEmail) => ({
    ownerEmail,
    desired: getAquecedorOwnerMotor(ownerEmail).desired,
  }));
}
