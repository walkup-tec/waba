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
exports.getAquecedorOwnerCicloGlobal = getAquecedorOwnerCicloGlobal;
exports.setAquecedorOwnerCicloGlobal = setAquecedorOwnerCicloGlobal;
exports.reloadAquecedorOwnerMotorsFromDisk = reloadAquecedorOwnerMotorsFromDisk;
exports.loadAndApplyDurableDesiredOwners = loadAndApplyDurableDesiredOwners;
exports.flushAquecedorOwnerMotorsToDisk = flushAquecedorOwnerMotorsToDisk;
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
/** Intenção ligada/desligada — arquivo dedicado (não sobrescrito a cada ciclo). Sobrevive a redeploy. */
const DESIRED_OWNERS_FILE = (0, data_path_1.resolveDataFile)("aquecedor-desired-owners.json");
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
    // Intenção do usuário (desired) manda: com aquecedor ligado, nunca persistir running=false
    // por glitch de timer/reload — senão o motor morre até alguém logar e dar auto-resume.
    const runningWhileDesired = motor.desired === true ? true : motor.runtime.running;
    return {
        running: runningWhileDesired,
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
/**
 * Quem deve processar ciclos deste proprietário.
 * Critério: desired=true + lease (não exige snapshot.running — isso travava o motor
 * após logout quando a UI deixava de chamar /aquecedor/start).
 */
function shouldProcessLeadOwnerMotor(motor) {
    if (motor.desired !== true)
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
        cicloGlobal: typeof snapRaw.cicloGlobal === "number" && Number.isFinite(snapRaw.cicloGlobal)
            ? Math.max(0, Math.floor(snapRaw.cicloGlobal))
            : 0,
    };
}
function getAquecedorOwnerCicloGlobal(motor) {
    const value = motor.snapshot.cicloGlobal;
    return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}
function setAquecedorOwnerCicloGlobal(motor, value) {
    motor.snapshot.cicloGlobal = Math.max(0, Math.floor(value));
}
function loadOwnerFromPersisted(ownerEmail, desired, snapshot) {
    const motor = getAquecedorOwnerMotor(ownerEmail);
    motor.desired = desired;
    applyPersistedSnapshotToMotor(motor, snapshot);
}
function mergeOwnerFromPersisted(ownerEmail, desired, snapshot) {
    const existing = ownerMotors.get(ownerEmail);
    if (!existing) {
        loadOwnerFromPersisted(ownerEmail, desired, snapshot);
        return;
    }
    const keepLocalTimer = desired === true && existing.runtime.running === true && existing.scheduleTimer != null;
    existing.desired = desired;
    if (desired === true) {
        snapshot.running = true;
    }
    applyPersistedSnapshotToMotor(existing, snapshot);
    if (keepLocalTimer) {
        // Reload do disco não pode matar o timer do processo líder.
        existing.runtime.running = true;
    }
}
function parsePersistedOwners(raw) {
    const version = Number(raw.version);
    const seen = new Set();
    if (version === 3 && raw.owners && typeof raw.owners === "object") {
        for (const [email, value] of Object.entries(raw.owners)) {
            const ownerEmail = normalizeAquecedorOwnerEmail(email);
            if (!ownerEmail)
                continue;
            seen.add(ownerEmail);
            const row = (value || {});
            const desired = typeof row.desired === "boolean" ? row.desired : row.desired === true ? true : null;
            const snapshot = parseOwnerSnapshot(row.snapshot);
            if (desired === true)
                snapshot.running = true;
            mergeOwnerFromPersisted(ownerEmail, desired, snapshot);
        }
    }
    else if (version === 1 || version === 2) {
        const desired = typeof raw.aquecedorRuntimeDesired === "boolean" ? raw.aquecedorRuntimeDesired : null;
        const ownerEmail = normalizeAquecedorOwnerEmail(typeof raw.aquecedorOwnerEmail === "string" ? raw.aquecedorOwnerEmail : null);
        const snapshot = parseOwnerSnapshot(raw.aquecedorRuntimeSnapshot);
        if (version === 1 || desired === true) {
            snapshot.running = desired === true;
        }
        if (ownerEmail) {
            seen.add(ownerEmail);
            mergeOwnerFromPersisted(ownerEmail, desired, snapshot);
        }
    }
    // Proprietários só em memória e ausentes do disco: se desired!=true, libera timer.
    for (const [email, motor] of ownerMotors.entries()) {
        if (seen.has(email))
            continue;
        if (motor.desired === true)
            continue;
        stopAquecedorOwnerMotorLocal(email);
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
async function writeDesiredOwnersFile() {
    const desired = {};
    for (const [email, motor] of ownerMotors.entries()) {
        if (motor.desired === true)
            desired[email] = true;
    }
    const payload = {
        version: 1,
        savedAt: new Date().toISOString(),
        desired,
    };
    await fs_1.promises.mkdir(path_1.default.dirname(DESIRED_OWNERS_FILE), { recursive: true });
    const tmp = `${DESIRED_OWNERS_FILE}.tmp`;
    await fs_1.promises.writeFile(tmp, JSON.stringify(payload, null, 2), "utf-8");
    await fs_1.promises.rename(tmp, DESIRED_OWNERS_FILE);
}
/**
 * Restaura desired=true a partir do arquivo dedicado (após restart/redeploy).
 * Garante que um snapshot de ciclo corrompido/incompleto não apague a intenção do usuário.
 */
async function loadAndApplyDurableDesiredOwners() {
    const restored = [];
    try {
        const rawText = await fs_1.promises.readFile(DESIRED_OWNERS_FILE, "utf-8");
        const parsed = JSON.parse(rawText);
        const map = parsed?.desired && typeof parsed.desired === "object" ? parsed.desired : {};
        for (const [email, value] of Object.entries(map)) {
            if (value !== true)
                continue;
            const ownerEmail = normalizeAquecedorOwnerEmail(email);
            if (!ownerEmail)
                continue;
            const motor = getAquecedorOwnerMotor(ownerEmail);
            if (motor.desired === true) {
                restored.push(ownerEmail);
                continue;
            }
            motor.desired = true;
            motor.snapshot.running = true;
            motor.runtime.running = true;
            if (!motor.runtime.lastResult || /parado/i.test(motor.runtime.lastResult)) {
                motor.runtime.lastResult = "Aquecedor retomado após restart do servidor.";
            }
            restored.push(ownerEmail);
            console.log(`[Runtime] desired durável: restaurado ${ownerEmail} = ligado.`);
        }
    }
    catch {
        /* arquivo ausente na primeira execução */
    }
    return restored;
}
async function flushAquecedorOwnerMotorsToDisk() {
    await writeAllOwnerMotorsToDisk();
    await writeDesiredOwnersFile();
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
    if (!desired) {
        motor.runtime.nextAllowedAt = null;
    }
    await writeAllOwnerMotorsToDisk();
    await writeDesiredOwnersFile();
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
    const running = desiredRunning &&
        (motor.runtime.running === true || motor.snapshot.running === true || workerActive);
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
