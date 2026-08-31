"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaFinanceiroSplitRepository = void 0;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const data_path_1 = require("../data-path");
const FILE_NAME = "waba-financeiro-split-config.json";
const defaultConfig = () => ({
    version: 2,
    suppliers: [],
    participants: [],
    updatedAt: new Date().toISOString(),
});
const normalizeParticipant = (input) => ({
    id: String(input.id ?? (0, node_crypto_1.randomUUID)()).trim() || (0, node_crypto_1.randomUUID)(),
    label: String(input.label ?? "").trim(),
    email: String(input.email ?? "").trim().toLowerCase(),
    pixKey: String(input.pixKey ?? "").trim(),
    sharePercent: Math.max(0, Math.min(100, Number(input.sharePercent ?? 0))),
    active: input.active !== false,
});
const migrateLegacyConfig = (parsed) => {
    const costs = (parsed.costPerShipmentCents ?? {});
    const oficialCost = Math.max(0, Math.round(Number(costs.oficial ?? 19)));
    const alternativaCost = Math.max(0, Math.round(Number(costs.alternativa ?? 10)));
    const suppliers = [];
    if (oficialCost > 0) {
        suppliers.push({
            id: "supplier-oficial",
            name: "Fornecedor API Oficial",
            apiKind: "oficial",
            systemUserEmail: "",
            segment: "outros",
            priority: 1,
            costPerShipmentCents: oficialCost,
            pixKey: "",
            active: true,
        });
    }
    if (alternativaCost > 0) {
        suppliers.push({
            id: "supplier-alternativa",
            name: "Fornecedor API Alternativa",
            apiKind: "alternativa",
            systemUserEmail: "",
            segment: "outros",
            priority: 1,
            costPerShipmentCents: alternativaCost,
            pixKey: "",
            active: true,
        });
    }
    return {
        version: 2,
        suppliers,
        participants: Array.isArray(parsed.participants)
            ? parsed.participants.map((item) => normalizeParticipant(item))
            : [],
        updatedAt: String(parsed.updatedAt || new Date().toISOString()),
    };
};
const normalizeSupplier = (input) => {
    const apiKind = input.apiKind === "alternativa" ? "alternativa" : "oficial";
    const segment = input.segment === "bets" ? "bets" : "outros";
    const priorityRaw = Math.round(Number(input.priority ?? 1));
    const priority = Math.max(1, Math.min(5, Number.isFinite(priorityRaw) ? priorityRaw : 1));
    return {
        id: String(input.id ?? (0, node_crypto_1.randomUUID)()).trim() || (0, node_crypto_1.randomUUID)(),
        name: String(input.name ?? "").trim(),
        apiKind,
        systemUserEmail: String(input.systemUserEmail ?? "").trim().toLowerCase(),
        segment,
        priority,
        costPerShipmentCents: Math.max(0, Math.round(Number(input.costPerShipmentCents ?? 0))),
        pixKey: String(input.pixKey ?? "").trim(),
        active: input.active !== false,
    };
};
class WabaFinanceiroSplitRepository {
    readConfigFromDisk() {
        const filePath = (0, data_path_1.resolveDataFile)(FILE_NAME);
        const dir = node_path_1.default.dirname(filePath);
        if (!(0, node_fs_1.existsSync)(dir))
            (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        if (!(0, node_fs_1.existsSync)(filePath)) {
            return { config: defaultConfig(), legacyFormat: false };
        }
        try {
            const parsed = JSON.parse((0, node_fs_1.readFileSync)(filePath, "utf8"));
            if (parsed?.version === 2 && Array.isArray(parsed.suppliers)) {
                return {
                    config: {
                        version: 2,
                        suppliers: parsed.suppliers.map((item) => normalizeSupplier(item)),
                        participants: Array.isArray(parsed.participants)
                            ? parsed.participants.map((item) => normalizeParticipant(item))
                            : [],
                        updatedAt: String(parsed.updatedAt || new Date().toISOString()),
                    },
                    legacyFormat: false,
                };
            }
            return { config: migrateLegacyConfig(parsed ?? {}), legacyFormat: true };
        }
        catch {
            return { config: defaultConfig(), legacyFormat: false };
        }
    }
    get() {
        const { config, legacyFormat } = this.readConfigFromDisk();
        if (legacyFormat) {
            return this.save(config);
        }
        return config;
    }
    save(config) {
        const filePath = (0, data_path_1.resolveDataFile)(FILE_NAME);
        const dir = node_path_1.default.dirname(filePath);
        if (!(0, node_fs_1.existsSync)(dir))
            (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        const payload = {
            version: 2,
            suppliers: (Array.isArray(config.suppliers) ? config.suppliers : []).map(normalizeSupplier),
            participants: (Array.isArray(config.participants) ? config.participants : []).map(normalizeParticipant),
            updatedAt: new Date().toISOString(),
        };
        const tmp = `${filePath}.tmp`;
        (0, node_fs_1.writeFileSync)(tmp, JSON.stringify(payload, null, 2), "utf8");
        (0, node_fs_1.writeFileSync)(filePath, (0, node_fs_1.readFileSync)(tmp));
        try {
            if ((0, node_fs_1.existsSync)(tmp))
                (0, node_fs_1.unlinkSync)(tmp);
        }
        catch {
            // ignore tmp cleanup failure
        }
        return payload;
    }
}
exports.WabaFinanceiroSplitRepository = WabaFinanceiroSplitRepository;
