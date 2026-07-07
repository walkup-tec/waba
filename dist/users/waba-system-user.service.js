"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStaffRoleLabel = exports.isStaffRole = exports.WabaSystemUserService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_crypto_2 = require("node:crypto");
const phone_1 = require("../billing/phone");
const waba_menu_permissions_service_1 = require("../menus/waba-menu-permissions.service");
const waba_menu_registry_1 = require("../menus/waba-menu-registry");
const waba_dispatches_api_kind_1 = require("../disparos/waba-dispatches-api-kind");
const waba_system_user_repository_1 = require("./waba-system-user.repository");
const waba_master_disparos_policy_service_1 = require("./waba-master-disparos-policy.service");
const normalizeEmail = (value) => value.trim().toLowerCase();
const hashPassword = (password) => {
    const salt = node_crypto_1.default.randomBytes(16).toString("hex");
    const hash = node_crypto_1.default.scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
};
const verifyPassword = (password, stored) => {
    const [salt, hash] = String(stored || "").split(":");
    if (!salt || !hash)
        return false;
    try {
        const expected = Buffer.from(hash, "hex");
        const derived = node_crypto_1.default.scryptSync(password, salt, 64);
        if (expected.length !== derived.length)
            return false;
        return node_crypto_1.default.timingSafeEqual(expected, derived);
    }
    catch {
        return false;
    }
};
const ROLE_LABELS = {
    master: "Master",
    operacional: "Operacional",
    suporte: "Suporte",
};
const OPERACIONAL_SEGMENT_LABELS = {
    bets: "Bets",
    outros: "Outros",
};
const parseRole = (value) => {
    const raw = String(value ?? "")
        .trim()
        .toLowerCase();
    if (raw === "master" || raw === "operacional" || raw === "suporte")
        return raw;
    return null;
};
const parseOperacionalDispatchesApiForRole = (role, value, options = {}) => {
    if (role !== "operacional")
        return null;
    const parsed = (0, waba_dispatches_api_kind_1.normalizeDispatchesApiKind)(value);
    if (!parsed && options.required) {
        throw new Error("Selecione o tipo de disparos que este operacional atende (API Oficial ou API Alternativa).");
    }
    return parsed;
};
const parseOptionalWhatsapp = (value) => {
    const raw = String(value ?? "").trim();
    if (!raw)
        return "";
    return (0, phone_1.formatBrazilPhoneDigits)(raw);
};
const parseOperacionalSegmentForRole = (role, value, options = {}) => {
    if (role !== "operacional")
        return null;
    const raw = String(value ?? "")
        .trim()
        .toLowerCase();
    if (!raw)
        return options.defaultValue ?? "outros";
    if (raw === "todos")
        return "outros";
    if (raw === "bets" || raw === "outros")
        return raw;
    throw new Error("Selecione um segmento válido para o operacional (Bets ou Outros).");
};
const formatMasterDisparosPolicyLabel = (policy) => {
    const creditsLabel = policy.unlimitedCredits ? "Ilimitado" : "Créditos";
    const splitParts = [];
    if (policy.splitSuppliers)
        splitParts.push("Fornec.");
    if (policy.splitProfits)
        splitParts.push("Lucros");
    const splitLabel = splitParts.length ? splitParts.join(" + ") : "Sem split";
    return `${creditsLabel} · ${splitLabel}`;
};
const formatCreatedAtLabel = (iso) => {
    const value = String(iso ?? "").trim();
    if (!value)
        return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return "—";
    return date.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};
class WabaSystemUserService {
    constructor(repository = new waba_system_user_repository_1.WabaSystemUserRepository()) {
        this.repository = repository;
    }
    ensureUserMigrated(user) {
        const patch = {};
        if (user.menuPermissions == null) {
            patch.menuPermissions = (0, waba_menu_permissions_service_1.buildLegacyMigrationPermissions)();
        }
        if (user.role === "operacional") {
            if (user.operacionalSegment == null) {
                patch.operacionalSegment = "outros";
            }
            else if (String(user.operacionalSegment) === "todos") {
                patch.operacionalSegment = "outros";
            }
        }
        if (!Object.keys(patch).length)
            return user;
        const migrated = this.repository.updateById(user.id, patch);
        return migrated ?? { ...user, ...patch };
    }
    getUserWithMigration(email) {
        const user = this.repository.getByEmail(normalizeEmail(email));
        if (!user)
            return null;
        return this.ensureUserMigrated(user);
    }
    toPublicUser(user) {
        const effective = (0, waba_menu_permissions_service_1.resolveEffectiveMenuPermissions)(user);
        const masterPolicy = user.role === "master" ? (0, waba_master_disparos_policy_service_1.resolveMasterDisparosPolicyFromUser)(user) : null;
        return {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            whatsapp: String(user.whatsapp ?? "").trim(),
            role: user.role,
            roleLabel: ROLE_LABELS[user.role],
            createdAt: user.createdAt,
            createdAtLabel: formatCreatedAtLabel(user.createdAt),
            menuPermissions: effective,
            enabledMenuCount: (0, waba_menu_permissions_service_1.countEnabledMenus)(effective),
            allowedMenuIds: (0, waba_menu_permissions_service_1.listAllowedMenuIds)(user),
            operacionalDispatchesApi: user.operacionalDispatchesApi ?? null,
            operacionalDispatchesApiLabel: user.operacionalDispatchesApi
                ? waba_dispatches_api_kind_1.WABA_DISPATCHES_API_LABELS[user.operacionalDispatchesApi]
                : "—",
            operacionalSegment: String(user.operacionalSegment) === "todos"
                ? "outros"
                : (user.operacionalSegment ?? null),
            operacionalSegmentLabel: (() => {
                const seg = String(user.operacionalSegment) === "todos" ? "outros" : user.operacionalSegment;
                return seg ? OPERACIONAL_SEGMENT_LABELS[seg] : "—";
            })(),
            masterUnlimitedCredits: masterPolicy?.unlimitedCredits ?? false,
            masterSplitSuppliers: masterPolicy?.splitSuppliers ?? false,
            masterSplitProfits: masterPolicy?.splitProfits ?? false,
            masterDisparosPolicyLabel: masterPolicy ? formatMasterDisparosPolicyLabel(masterPolicy) : "—",
        };
    }
    listPublicUsers() {
        return this.repository
            .list()
            .map((user) => this.ensureUserMigrated(user))
            .map((user) => this.toPublicUser(user));
    }
    getByEmail(email) {
        return this.getUserWithMigration(email);
    }
    getRoleByEmail(email) {
        return this.getUserWithMigration(email)?.role ?? null;
    }
    getOperacionalDispatchesApiForEmail(email) {
        const user = this.getUserWithMigration(email);
        if (!user || user.role !== "operacional")
            return null;
        return user.operacionalDispatchesApi ?? null;
    }
    getOperacionalSegmentForEmail(email) {
        const user = this.getUserWithMigration(email);
        if (!user || user.role !== "operacional")
            return null;
        return user.operacionalSegment ?? "outros";
    }
    /** Operacionais designados para atender campanhas de um plano e segmento de assinante. */
    listOperacionalUsersForCampaign(apiKind, subscriberSegment) {
        return this.repository
            .list()
            .map((user) => this.ensureUserMigrated(user))
            .filter((user) => user.role === "operacional" &&
            user.operacionalDispatchesApi === apiKind &&
            (user.operacionalSegment ?? "outros") === subscriberSegment)
            .map((user) => ({
            ...user,
            email: user.email.trim().toLowerCase(),
        }));
    }
    /** @deprecated Use listOperacionalUsersForCampaign — mantido para compatibilidade interna. */
    listOperacionalUsersForDispatchesApi(apiKind) {
        return this.listOperacionalUsersForCampaign(apiKind, "outros");
    }
    getSessionMenuAccess(email) {
        const user = this.getUserWithMigration(email);
        if (!user) {
            return { allowedMenuIds: [], menuPermissions: {} };
        }
        const menuPermissions = (0, waba_menu_permissions_service_1.resolveEffectiveMenuPermissions)(user);
        return {
            allowedMenuIds: (0, waba_menu_permissions_service_1.listAllowedMenuIds)(user),
            menuPermissions,
        };
    }
    validateCredentials(email, password) {
        const user = this.repository.getByEmail(normalizeEmail(email));
        if (!user)
            return false;
        return verifyPassword(String(password ?? ""), user.passwordHash);
    }
    create(input) {
        const email = normalizeEmail(input.email);
        const fullName = String(input.fullName ?? "").trim();
        const password = String(input.password ?? "");
        const whatsapp = parseOptionalWhatsapp(input.whatsapp);
        const role = parseRole(input.role);
        if (fullName.length < 2)
            throw new Error("Informe o nome do usuário.");
        if (!email.includes("@"))
            throw new Error("Informe um e-mail válido.");
        if (password.length < 6)
            throw new Error("A senha deve ter pelo menos 6 caracteres.");
        if (!role)
            throw new Error("Selecione o tipo de usuário (Master, Operacional ou Suporte).");
        const menuPermissions = (0, waba_menu_permissions_service_1.parseMenuPermissionsForCreate)(role, input.menuPermissions);
        if (role !== "master" && (0, waba_menu_permissions_service_1.countEnabledMenus)(menuPermissions) === 0) {
            throw new Error("Selecione pelo menos um menu para o usuário.");
        }
        const operacionalDispatchesApi = parseOperacionalDispatchesApiForRole(role, input.operacionalDispatchesApi, { required: true });
        const operacionalSegment = parseOperacionalSegmentForRole(role, input.operacionalSegment, {
            defaultValue: "outros",
        });
        const masterPolicy = role === "master"
            ? (0, waba_master_disparos_policy_service_1.parseMasterDisparosPolicyInput)(input, { applyDefaults: true })
            : null;
        const now = new Date().toISOString();
        const user = this.repository.create({
            id: (0, node_crypto_2.randomUUID)(),
            fullName,
            email,
            passwordHash: hashPassword(password),
            whatsapp,
            role,
            operacionalDispatchesApi,
            operacionalSegment,
            masterUnlimitedCredits: masterPolicy?.unlimitedCredits,
            masterSplitSuppliers: masterPolicy?.splitSuppliers,
            masterSplitProfits: masterPolicy?.splitProfits,
            menuPermissions,
            createdAt: now,
            updatedAt: now,
        });
        return this.toPublicUser(user);
    }
    update(userId, input) {
        const user = this.repository.getById(userId);
        if (!user)
            throw new Error("Usuário não encontrado.");
        const fullName = input.fullName !== undefined ? String(input.fullName).trim() : user.fullName;
        const email = input.email !== undefined ? normalizeEmail(input.email) : user.email;
        const password = input.password !== undefined ? String(input.password ?? "") : undefined;
        const whatsapp = input.whatsapp !== undefined ? parseOptionalWhatsapp(input.whatsapp) : String(user.whatsapp ?? "").trim();
        if (fullName.length < 2)
            throw new Error("Informe o nome do usuário.");
        if (!email.includes("@"))
            throw new Error("Informe um e-mail válido.");
        if (email !== user.email) {
            const existing = this.repository.getByEmail(email);
            if (existing && existing.id !== user.id) {
                throw new Error("Já existe um usuário com este e-mail.");
            }
        }
        const patch = { fullName, email, whatsapp };
        if (password !== undefined && password.length > 0) {
            if (password.length < 6) {
                throw new Error("A senha deve ter pelo menos 6 caracteres.");
            }
            patch.passwordHash = hashPassword(password);
        }
        if (input.menuPermissions !== undefined) {
            patch.menuPermissions = (0, waba_menu_permissions_service_1.parseMenuPermissionsForUpdate)(user.role, input.menuPermissions);
        }
        if (input.operacionalDispatchesApi !== undefined) {
            patch.operacionalDispatchesApi = parseOperacionalDispatchesApiForRole(user.role, input.operacionalDispatchesApi, { required: user.role === "operacional" });
        }
        if (input.operacionalSegment !== undefined) {
            patch.operacionalSegment = parseOperacionalSegmentForRole(user.role, input.operacionalSegment, { defaultValue: user.operacionalSegment ?? "outros" });
        }
        if (user.role === "master") {
            const hasMasterPolicyInput = input.masterUnlimitedCredits !== undefined ||
                input.masterSplitSuppliers !== undefined ||
                input.masterSplitProfits !== undefined;
            if (hasMasterPolicyInput) {
                const currentPolicy = (0, waba_master_disparos_policy_service_1.resolveMasterDisparosPolicyFromUser)(user);
                const nextPolicy = (0, waba_master_disparos_policy_service_1.parseMasterDisparosPolicyInput)({
                    masterUnlimitedCredits: input.masterUnlimitedCredits !== undefined
                        ? input.masterUnlimitedCredits
                        : currentPolicy.unlimitedCredits,
                    masterSplitSuppliers: input.masterSplitSuppliers !== undefined
                        ? input.masterSplitSuppliers
                        : currentPolicy.splitSuppliers,
                    masterSplitProfits: input.masterSplitProfits !== undefined
                        ? input.masterSplitProfits
                        : currentPolicy.splitProfits,
                }, { applyDefaults: false });
                patch.masterUnlimitedCredits = nextPolicy.unlimitedCredits;
                patch.masterSplitSuppliers = nextPolicy.splitSuppliers;
                patch.masterSplitProfits = nextPolicy.splitProfits;
            }
        }
        const updated = this.repository.updateById(user.id, patch);
        if (!updated)
            throw new Error("Usuário não encontrado.");
        return this.toPublicUser(updated);
    }
    updateMenuPermissions(userId, input) {
        return this.update(userId, { menuPermissions: input });
    }
    delete(userId, requesterEmail) {
        const user = this.repository.getById(userId);
        if (!user)
            throw new Error("Usuário não encontrado.");
        if (user.role === "master") {
            throw new Error("Usuários master não podem ser removidos por aqui.");
        }
        const requester = normalizeEmail(String(requesterEmail ?? ""));
        if (requester && requester === user.email) {
            throw new Error("Você não pode remover o próprio usuário enquanto estiver logado.");
        }
        const removed = this.repository.deleteById(user.id);
        if (!removed)
            throw new Error("Usuário não encontrado.");
    }
    listMenuDefinitionsForAdmin() {
        return (0, waba_menu_registry_1.listWabaMenuDefinitions)();
    }
    ensureBootstrapFromEnvMaster() {
        const adminEmail = normalizeEmail(String(process.env.WABA_ADMIN_EMAIL ?? ""));
        const adminPassword = String(process.env.WABA_ADMIN_PASSWORD ?? "");
        if (!adminEmail.includes("@") || adminPassword.length < 6)
            return;
        const existing = this.repository.list();
        if (existing.length > 0)
            return;
        const now = new Date().toISOString();
        const displayName = adminEmail.split("@")[0] || "Master";
        this.repository.create({
            id: (0, node_crypto_2.randomUUID)(),
            fullName: displayName.charAt(0).toUpperCase() + displayName.slice(1),
            email: adminEmail,
            passwordHash: hashPassword(adminPassword),
            role: "master",
            masterUnlimitedCredits: true,
            masterSplitSuppliers: true,
            masterSplitProfits: false,
            menuPermissions: (0, waba_menu_permissions_service_1.buildAllMenusEnabled)(),
            createdAt: now,
            updatedAt: now,
        });
    }
}
exports.WabaSystemUserService = WabaSystemUserService;
const isStaffRole = (role) => role === "master" || role === "operacional" || role === "suporte";
exports.isStaffRole = isStaffRole;
const getStaffRoleLabel = (role) => ROLE_LABELS[role];
exports.getStaffRoleLabel = getStaffRoleLabel;
