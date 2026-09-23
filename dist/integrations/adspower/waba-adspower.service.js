"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wabaAdsPowerService = exports.WabaAdsPowerService = void 0;
exports.normalizeAdsPowerIngestItem = normalizeAdsPowerIngestItem;
exports.timingSafeEqualText = timingSafeEqualText;
exports.readBearerToken = readBearerToken;
exports.applyAdsPowerSnapshot = applyAdsPowerSnapshot;
exports.findWabaProfileClash = findWabaProfileClash;
exports.assertAdsPowerIngestAuthorized = assertAdsPowerIngestAuthorized;
const node_crypto_1 = require("node:crypto");
const waba_adspower_client_1 = require("./waba-adspower.client");
const waba_adspower_repository_1 = require("./waba-adspower.repository");
const repository = new waba_adspower_repository_1.WabaAdsPowerRepository();
function asText(value) {
    return String(value ?? "").trim();
}
function unixToIso(value) {
    if (value == null || value === "")
        return null;
    const n = Number(value);
    if (Number.isFinite(n) && n > 1000000000) {
        const ms = n > 10000000000 ? n : n * 1000;
        return new Date(ms).toISOString();
    }
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function normalizeAdsPowerIngestItem(raw) {
    const userId = asText(raw.userId || raw.user_id);
    if (!userId)
        return null;
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
function timingSafeEqualText(expected, received) {
    const a = Buffer.from(String(expected || ""), "utf8");
    const b = Buffer.from(String(received || ""), "utf8");
    if (!a.length || a.length !== b.length)
        return false;
    return (0, node_crypto_1.timingSafeEqual)(a, b);
}
function readBearerToken(header) {
    const raw = String(header || "").trim();
    const match = /^Bearer\s+(.+)$/i.exec(raw);
    return match ? String(match[1] || "").trim() : raw;
}
function applyAdsPowerSnapshot(current, incoming, prune) {
    const byId = new Map(current.map((row) => [row.userId, row]));
    const merged = incoming.map((row) => {
        const prev = byId.get(row.userId);
        if (!prev)
            return row;
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
        for (const row of merged)
            kept.set(row.userId, row);
        return { profiles: [...kept.values()], upserted: merged.length, pruned: 0 };
    }
    const keptIds = new Set(merged.map((row) => row.userId));
    const pruned = current.filter((row) => !keptIds.has(row.userId)).length;
    return { profiles: merged, upserted: merged.length, pruned };
}
function findWabaProfileClash(profiles, userId, wabaId) {
    const id = asText(userId);
    const waba = asText(wabaId);
    if (!waba)
        return null;
    return profiles.find((row) => row.userId !== id && row.wabaId === waba) ?? null;
}
function requireOperator(auth) {
    if (!auth.email || auth.role === "guest") {
        const err = new Error("Faça login para ver os perfis AdsPower.");
        err.status = 401;
        throw err;
    }
    if (auth.role === "subscriber" || auth.role === "indicador") {
        const err = new Error("Sem permissão para os perfis AdsPower.");
        err.status = 403;
        throw err;
    }
}
class WabaAdsPowerService {
    async status() {
        return (0, waba_adspower_client_1.probeAdsPowerBridge)();
    }
    list(auth) {
        requireOperator(auth);
        return repository.list();
    }
    ingest(items, opts) {
        const incoming = items.map(normalizeAdsPowerIngestItem).filter((row) => Boolean(row));
        const current = repository.list();
        if (!incoming.length)
            return { upserted: 0, pruned: 0, profiles: current };
        const prune = opts?.prune !== false;
        const snapshot = applyAdsPowerSnapshot(current, incoming, prune);
        if (prune)
            repository.replaceAll(snapshot.profiles);
        else
            repository.upsertMany(snapshot.profiles);
        return {
            upserted: snapshot.upserted,
            pruned: snapshot.pruned,
            profiles: repository.list(),
        };
    }
    async pullFromLocalApi(auth) {
        requireOperator(auth);
        try {
            const remote = await (0, waba_adspower_client_1.listAdsPowerRemoteProfiles)();
            return { source: "local-api", ...this.ingest(remote) };
        }
        catch {
            return {
                source: "ingest",
                upserted: 0,
                profiles: this.list(auth),
                detail: "A Local API não responde neste servidor. Rode o script no PC com AdsPower e clique em Atualizar.",
            };
        }
    }
    bind(auth, userId, input) {
        requireOperator(auth);
        const id = asText(userId);
        const current = repository.getByUserId(id);
        if (!current) {
            const err = new Error("Perfil AdsPower não encontrado. Sincronize a lista primeiro.");
            err.status = 404;
            throw err;
        }
        const wabaId = asText(input.wabaId) || null;
        if (wabaId) {
            const clash = findWabaProfileClash(repository.list(), id, wabaId);
            if (clash) {
                const err = new Error(`Este WABA já está no perfil “${clash.name}” (${clash.userId}). Um perfil AdsPower = uma conta WABA.`);
                err.status = 409;
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
    unbind(auth, userId) {
        return this.bind(auth, userId, {
            connectionId: "",
            wabaId: "",
            phoneNumberId: "",
            displayPhoneNumber: "",
            verifiedName: "",
        });
    }
    async open(auth, userId) {
        requireOperator(auth);
        const profile = repository.getByUserId(asText(userId));
        if (!profile) {
            const err = new Error("Perfil AdsPower não encontrado.");
            err.status = 404;
            throw err;
        }
        const started = await (0, waba_adspower_client_1.startAdsPowerProfile)(profile.userId);
        return { profile, ...started };
    }
}
exports.WabaAdsPowerService = WabaAdsPowerService;
function assertAdsPowerIngestAuthorized(authorizationHeader) {
    const expected = (0, waba_adspower_client_1.resolveAdsPowerIngestToken)();
    if (!expected) {
        const err = new Error("ADSPOWER_INGEST_TOKEN não configurado no servidor.");
        err.status = 503;
        throw err;
    }
    const received = readBearerToken(authorizationHeader);
    if (!timingSafeEqualText(expected, received)) {
        const err = new Error("Token de ingest AdsPower inválido.");
        err.status = 401;
        throw err;
    }
}
exports.wabaAdsPowerService = new WabaAdsPowerService();
