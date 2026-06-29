"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaAdminInstancesService = void 0;
const node_fs_1 = require("node:fs");
const evo_http_client_1 = require("../evo-http.client");
const evo_instance_key_1 = require("../instances/evo-instance-key");
const waba_instance_ownership_service_1 = require("../instances/waba-instance-ownership.service");
const data_path_1 = require("../data-path");
const EVO_API_BASE = String(process.env.EVO_API_URL || "").replace(/\/+$/, "");
const EVO_API_KEY = String(process.env.EVO_API_KEY || "").trim();
const EVO_INSTANCES_URL = String(process.env.EVO_INSTANCES_URL || "").trim() ||
    `${EVO_API_BASE}/instance/fetchInstances`;
function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
}
function normalizeDigits(value) {
    return String(value || "").replace(/\D/g, "");
}
function buildPhoneVariants(rawDigits) {
    const digits = normalizeDigits(rawDigits);
    const out = new Set();
    if (!digits)
        return out;
    out.add(digits);
    if (digits.startsWith("55"))
        out.add(digits.slice(2));
    if (digits.length > 11)
        out.add(digits.slice(-11));
    if (digits.length > 10)
        out.add(digits.slice(-10));
    if (digits.length > 9)
        out.add(digits.slice(-9));
    if (digits.length > 8)
        out.add(digits.slice(-8));
    if (!digits.startsWith("55") && digits.length >= 10)
        out.add(`55${digits}`);
    return out;
}
function phonesLooselyMatch(queryDigits, instanceDigits) {
    const query = buildPhoneVariants(queryDigits);
    const instance = buildPhoneVariants(instanceDigits);
    for (const value of query) {
        if (instance.has(value))
            return true;
    }
    const querySuffixes = [...query].map((v) => v.slice(-8)).filter((v) => v.length >= 8);
    const instanceSuffixes = [...instance].map((v) => v.slice(-8)).filter((v) => v.length >= 8);
    return querySuffixes.some((suffix) => instanceSuffixes.includes(suffix));
}
function extractInstanceNumber(inst) {
    const raw = inst.ownerJid ??
        inst.owner ??
        inst.number ??
        inst.phone ??
        inst.ownerNumber ??
        inst.profile?.owner ??
        "";
    const text = String(raw).trim();
    if (!text)
        return "";
    if (text.includes("@"))
        return normalizeDigits(text.split("@")[0] || text);
    return normalizeDigits(text);
}
function parseEvoInstancesList(raw) {
    if (Array.isArray(raw))
        return raw;
    if (raw && typeof raw === "object") {
        const record = raw;
        if (Array.isArray(record.response))
            return record.response;
        if (Array.isArray(record.data))
            return record.data;
        if (Array.isArray(record.instances))
            return record.instances;
    }
    return raw ? [raw] : [];
}
function readOwnersSnapshot() {
    const filePath = (0, data_path_1.resolveDataFile)("instance-owners.json");
    if (!(0, node_fs_1.existsSync)(filePath))
        return {};
    try {
        const parsed = JSON.parse((0, node_fs_1.readFileSync)(filePath, "utf8"));
        return parsed?.instances && typeof parsed.instances === "object" ? parsed.instances : {};
    }
    catch {
        return {};
    }
}
function resolveOwnerForInstance(instanceName, owners) {
    const target = String(instanceName || "").trim().toLowerCase();
    if (!target)
        return null;
    for (const [name, meta] of Object.entries(owners)) {
        if (name.toLowerCase() !== target)
            continue;
        const email = normalizeEmail(String(meta?.ownerEmail || ""));
        return email.includes("@") ? email : null;
    }
    return null;
}
class WabaAdminInstancesService {
    async fetchEvoInstances() {
        if (!EVO_API_BASE || !EVO_API_KEY) {
            throw new Error("Evolution API não configurada (EVO_API_URL / EVO_API_KEY).");
        }
        const result = await (0, evo_http_client_1.evoHttpRequest)(EVO_INSTANCES_URL, "GET", {
            apiKey: EVO_API_KEY,
            retries: 2,
            timeoutMs: 25000,
        });
        if (!result.ok) {
            throw new Error(`Falha ao listar instâncias na Evolution (${result.status}): ${String(result.body || result.error || "").slice(0, 180)}`);
        }
        return parseEvoInstancesList(result.json);
    }
    async lookupByPhone(phone) {
        const query = normalizeDigits(phone);
        if (query.length < 8) {
            throw new Error("Informe um número WhatsApp válido (mínimo 8 dígitos).");
        }
        const owners = readOwnersSnapshot();
        const instances = await this.fetchEvoInstances();
        const rows = [];
        for (const inst of instances) {
            const instanceName = (0, evo_instance_key_1.resolveEvoInstanceKey)(inst);
            const number = extractInstanceNumber(inst);
            if (!instanceName || !number)
                continue;
            if (!phonesLooselyMatch(query, number))
                continue;
            rows.push({
                instanceName,
                number,
                connectionStatus: String(inst.connectionStatus || "unknown"),
                ownerEmail: resolveOwnerForInstance(instanceName, owners),
            });
        }
        return rows.sort((a, b) => a.instanceName.localeCompare(b.instanceName, "pt-BR"));
    }
    async transferOwner(input) {
        const targetEmail = normalizeEmail(input.targetEmail);
        if (!targetEmail.includes("@")) {
            throw new Error("Informe o e-mail de destino válido.");
        }
        let instanceNames = [];
        if (input.instanceName) {
            instanceNames = [String(input.instanceName).trim()].filter(Boolean);
        }
        else if (input.phone) {
            const matches = await this.lookupByPhone(String(input.phone));
            if (!matches.length) {
                throw new Error("Nenhuma instância Evolution encontrada para esse número.");
            }
            instanceNames = matches.map((row) => row.instanceName);
        }
        else {
            throw new Error("Informe instanceName ou phone.");
        }
        const owners = readOwnersSnapshot();
        const instances = await this.fetchEvoInstances();
        const byName = new Map();
        for (const inst of instances) {
            const name = (0, evo_instance_key_1.resolveEvoInstanceKey)(inst);
            if (name)
                byName.set(name.toLowerCase(), inst);
        }
        const transferred = [];
        for (const instanceName of instanceNames) {
            const inst = byName.get(instanceName.toLowerCase());
            const number = inst ? extractInstanceNumber(inst) : "";
            const previousOwner = resolveOwnerForInstance(instanceName, owners);
            await waba_instance_ownership_service_1.wabaInstanceOwnershipService.assignOwner(instanceName, targetEmail);
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
exports.WabaAdminInstancesService = WabaAdminInstancesService;
