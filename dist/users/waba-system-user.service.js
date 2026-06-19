"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStaffRoleLabel = exports.isStaffRole = exports.WabaSystemUserService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_crypto_2 = require("node:crypto");
const waba_menu_permissions_service_1 = require("../menus/waba-menu-permissions.service");
const waba_menu_registry_1 = require("../menus/waba-menu-registry");
const waba_dispatches_api_kind_1 = require("../disparos/waba-dispatches-api-kind");
const waba_system_user_repository_1 = require("./waba-system-user.repository");
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
        if (user.menuPermissions != null)
            return user;
        const migrated = this.repository.updateById(user.id, {
            menuPermissions: (0, waba_menu_permissions_service_1.buildLegacyMigrationPermissions)(),
        });
        return migrated ?? user;
    }
    getUserWithMigration(email) {
        const user = this.repository.getByEmail(normalizeEmail(email));
        if (!user)
            return null;
        return this.ensureUserMigrated(user);
    }
    toPublicUser(user) {
        const effective = (0, waba_menu_permissions_service_1.resolveEffectiveMenuPermissions)(user);
        return {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
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
        const now = new Date().toISOString();
        const user = this.repository.create({
            id: (0, node_crypto_2.randomUUID)(),
            fullName,
            email,
            passwordHash: hashPassword(password),
            role,
            operacionalDispatchesApi,
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
        const patch = { fullName, email };
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
