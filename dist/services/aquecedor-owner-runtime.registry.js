"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AQUECEDOR_OWNER_WORKER_ID = void 0;
exports.createDefaultAquecedorRuntimeSnapshot = createDefaultAquecedorRuntimeSnapshot;
exports.normalizeAquecedorOwnerEmail = normalizeAquecedorOwnerEmail;
exports.getAquecedorOwnerMotor = getAquecedorOwnerMotor;
exports.listAquecedorOwnerEmails = listAquecedorOwnerEmails;
exports.listAquecedorOwnersWithDesiredRunning = listAquecedorOwnersWithDesiredRunning;
exports.applyPersistedSnapshotToMotor = applyPersistedSnapshotToMotor;
exports.buildPersistedSnapshotFromMotor = buildPersistedSnapshotFromMotor;
exports.shouldProcessLeadOwnerMotor = shouldProcessLeadOwnerMotor;
exports.reloadAquecedorOwnerMotorsFromDisk = reloadAquecedorOwnerMotorsFromDisk;
exports.persistAquecedorOwnerSnapshot = persistAquecedorOwnerSnapshot;
exports.persistAquecedorOwnerIntent = persistAquecedorOwnerIntent;
exports.updateAquecedorOwnerConnectedSummary = updateAquecedorOwnerConnectedSummary;
exports.buildAquecedorOwnerStatusPayload = buildAquecedorOwnerStatusPayload;
exports.buildLiveAquecedorOwnerStatusPayload = buildLiveAquecedorOwnerStatusPayload;
exports.stopAquecedorOwnerMotorLocal = stopAquecedorOwnerMotorLocal;
exports.loadAquecedorOwnerRuntimeIntents = loadAquecedorOwnerRuntimeIntents;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const os_1 = require("os");
const data_path_1 = require("../data-path");
const RUNTIME_INTENT_FILE = (0, data_path_1.resolveDataFile)("runtime-intent.json");
const AQUECEDOR_WORKER_LEASE_MS = 90000;
const AQUECEDOR_PERSISTED_RELOAD_MS = 2000;
const AQUECEDOR_PROCESSING_STALE_MS = 8 * 60 * 1000;
exports.AQUECEDOR_OWNER_WORKER_ID = `${(0, os_1.hostname)()}:${process.pid}`;
const emptyConnectedSummary = () => ({
    count: 0,
    names: [],
    preparingCount: 0,
    preparingNames: [],
    totalEnabled: 0,
    at: 0,
});
function createDefaultAquecedorRuntimeSnapshot() {
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
function createDefaultRuntime() {
    return {
        running: false,
        isProcessing: false,
        nextAllowedAt: null,
        lastRunAt: null,
        lastResult: null,
        lastEvoError: null,
    };
}
const ownerMotors = new Map();
let persistedSavedAtMs = 0;
let persistedReloadedAt = 0;
function normalizeAquecedorOwnerEmail(email) {
    const normalized = String(email || "").trim().toLowerCase();
    return normalized.includes("@") ? normalized : null;
}
function getAquecedorOwnerMotor(ownerEmail) {
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
function listAquecedorOwnerEmails() {
    return Array.from(ownerMotors.keys());
}
function listAquecedorOwnersWithDesiredRunning() {
    return listAquecedorOwnerEmails().filter((email) => {
        const motor = ownerMotors.get(email);
        return motor?.desired === true;
    });
}
function isWorkerLeaseValid(snapshot) {
    if (!snapshot.workerHeartbeatAt)
        return false;
    const heartbeatMs = new Date(snapshot.workerHeartbeatAt).getTime();
    if (!Number.isFinite(heartbeatMs))
        return false;
    return Date.now() - heartbeatMs <= AQUECEDOR_WORKER_LEASE_MS;
}
function isProcessingSnapshotStale(snapshot) {
    if (!snapshot.isProcessing)
        return false;
    const lastRunMs = snapshot.lastRunAt ? new Date(snapshot.lastRunAt).getTime() : Number.NaN;
    if (!Number.isFinite(lastRunMs))
        return true;
    return Date.now() - lastRunMs > AQUECEDOR_PROCESSING_STALE_MS;
}
function applyPersistedSnapshotToMotor(motor, snapshot) {
    motor.runtime.running = snapshot.running === true;
    motor.runtime.isProcessing =
        snapshot.isProcessing === true && !isProcessingSnapshotStale(snapshot);
    motor.runtime.nextAllowedAt = snapshot.nextAllowedAt;
    motor.runtime.lastRunAt = snapshot.lastRunAt;
    motor.runtime.lastResult = snapshot.lastResult;
    motor.runtime.lastEvoError = snapshot.lastEvoError;
    motor.snapshot = { ...snapshot };
}
function buildPersistedSnapshotFromMotor(motor, overrides = {}) {
    return {
        running: motor.runtime.running,
        isProcessing: motor.runtime.isProcessing,
        nextAllowedAt: motor.runtime.nextAllowedAt,
        lastRunAt: motor.runtime.lastRunAt,
        lastResult: motor.runtime.lastResult,
        lastEvoError: motor.runtime.lastEvoError,
        workerId: motor.snapshot.workerId,
        workerHeartbeatAt: motor.snapshot.workerHeartbeatAt,
        ...overrides,
    };
}
function shouldProcessLeadOwnerMotor(motor) {
    if (motor.desired !== true || !motor.snapshot.running)
        return false;
    if (motor.snapshot.workerId === exports.AQUECEDOR_OWNER_WORKER_ID)
        return true;
    if (!motor.snapshot.workerId || !isWorkerLeaseValid(motor.snapshot))
        return true;
    return false;
}
function parseOwnerSnapshot(raw) {
    const snapRaw = (raw || {});
    return {
        running: snapRaw.running === true,
        isProcessing: snapRaw.isProcessing === true,
        nextAllowedAt: typeof snapRaw.nextAllowedAt === "string" ? snapRaw.nextAllowedAt : null,
        lastRunAt: typeof snapRaw.lastRunAt === "string" ? snapRaw.lastRunAt : null,
        lastResult: typeof snapRaw.lastResult === "string" ? snapRaw.lastResult : null,
        lastEvoError: snapRaw.lastEvoError && typeof snapRaw.lastEvoError === "object"
            ? snapRaw.lastEvoError
            : null,
        workerId: typeof snapRaw.workerId === "string" ? snapRaw.workerId : null,
        workerHeartbeatAt: typeof snapRaw.workerHeartbeatAt === "string" ? snapRaw.workerHeartbeatAt : null,
    };
}
function loadOwnerFromPersisted(ownerEmail, desired, snapshot) {
    const motor = getAquecedorOwnerMotor(ownerEmail);
    motor.desired = desired;
    applyPersistedSnapshotToMotor(motor, snapshot);
}
function parsePersistedOwners(raw) {
    ownerMotors.clear();
    const version = Number(raw.version);
    if (version === 3 && raw.owners && typeof raw.owners === "object") {
        for (const [email, value] of Object.entries(raw.owners)) {
            const ownerEmail = normalizeAquecedorOwnerEmail(email);
            if (!ownerEmail)
                continue;
            const row = (value || {});
            const desired = typeof row.desired === "boolean" ? row.desired : row.desired === true ? true : null;
            const snapshot = parseOwnerSnapshot(row.snapshot);
            loadOwnerFromPersisted(ownerEmail, desired, snapshot);
        }
        return;
    }
    if (version === 1 || version === 2) {
        const desired = typeof raw.aquecedorRuntimeDesired === "boolean" ? raw.aquecedorRuntimeDesired : null;
        const ownerEmail = normalizeAquecedorOwnerEmail(typeof raw.aquecedorOwnerEmail === "string" ? raw.aquecedorOwnerEmail : null);
        const snapshot = parseOwnerSnapshot(raw.aquecedorRuntimeSnapshot);
        if (version === 1) {
            snapshot.running = desired === true;
        }
        if (ownerEmail) {
            loadOwnerFromPersisted(ownerEmail, desired, snapshot);
        }
    }
}
async function reloadAquecedorOwnerMotorsFromDisk(force = false) {
    const now = Date.now();
    if (!force && now - persistedReloadedAt < AQUECEDOR_PERSISTED_RELOAD_MS) {
        return;
    }
    persistedReloadedAt = now;
    try {
        const rawText = await fs_1.promises.readFile(RUNTIME_INTENT_FILE, "utf-8");
        const parsed = JSON.parse(rawText);
        const fileSavedAtMs = new Date(String(parsed.savedAt || "")).getTime();
        if (Number.isFinite(fileSavedAtMs) &&
            persistedSavedAtMs > 0 &&
            fileSavedAtMs < persistedSavedAtMs) {
            return;
        }
        parsePersistedOwners(parsed);
        if (Number.isFinite(fileSavedAtMs)) {
            persistedSavedAtMs = fileSavedAtMs;
        }
    }
    catch {
        /* mantém cache em memória */
    }
}
async function writeAllOwnerMotorsToDisk() {
    const owners = {};
    for (const [email, motor] of ownerMotors.entries()) {
        owners[email] = {
            desired: motor.desired,
            snapshot: buildPersistedSnapshotFromMotor(motor),
        };
    }
    const savedAtMs = Date.now();
    const payload = {
        version: 3,
        savedAt: new Date(savedAtMs).toISOString(),
        owners,
    };
    await fs_1.promises.mkdir(path_1.default.dirname(RUNTIME_INTENT_FILE), { recursive: true });
    const tmp = `${RUNTIME_INTENT_FILE}.tmp`;
    await fs_1.promises.writeFile(tmp, JSON.stringify(payload, null, 2), "utf-8");
    await fs_1.promises.rename(tmp, RUNTIME_INTENT_FILE);
    persistedSavedAtMs = savedAtMs;
}
async function persistAquecedorOwnerSnapshot(ownerEmail, overrides = {}) {
    const motor = getAquecedorOwnerMotor(ownerEmail);
    motor.snapshot = buildPersistedSnapshotFromMotor(motor, overrides);
    await writeAllOwnerMotorsToDisk();
}
async function persistAquecedorOwnerIntent(ownerEmail, desired) {
    const motor = getAquecedorOwnerMotor(ownerEmail);
    motor.desired = desired;
    motor.snapshot = buildPersistedSnapshotFromMotor(motor, {
        running: desired,
        workerId: desired ? exports.AQUECEDOR_OWNER_WORKER_ID : null,
        workerHeartbeatAt: desired ? new Date().toISOString() : null,
        isProcessing: desired ? motor.runtime.isProcessing : false,
    });
    await writeAllOwnerMotorsToDisk();
    console.log(`[Runtime] runtime-intent: aquecedor ${ownerEmail} desejado = ${desired ? "ligado" : "desligado"}.`);
}
function updateAquecedorOwnerConnectedSummary(ownerEmail, connected, connectedAll = connected) {
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
function buildAquecedorOwnerStatusPayload(ownerEmail) {
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
function buildLiveAquecedorOwnerStatusPayload(ownerEmail) {
    const motor = getAquecedorOwnerMotor(ownerEmail);
    const base = buildAquecedorOwnerStatusPayload(ownerEmail);
    if (!shouldProcessLeadOwnerMotor(motor))
        return base;
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
function stopAquecedorOwnerMotorLocal(ownerEmail) {
    const motor = getAquecedorOwnerMotor(ownerEmail);
    motor.runtime.running = false;
    if (motor.scheduleTimer) {
        clearTimeout(motor.scheduleTimer);
        motor.scheduleTimer = null;
    }
}
async function loadAquecedorOwnerRuntimeIntents() {
    await reloadAquecedorOwnerMotorsFromDisk(true);
    return listAquecedorOwnerEmails().map((ownerEmail) => ({
        ownerEmail,
        desired: getAquecedorOwnerMotor(ownerEmail).desired,
    }));
}
