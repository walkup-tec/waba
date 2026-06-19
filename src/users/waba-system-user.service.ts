import crypto from "node:crypto";
import { randomUUID } from "node:crypto";
import {
  buildAllMenusEnabled,
  buildLegacyMigrationPermissions,
  countEnabledMenus,
  listAllowedMenuIds,
  parseMenuPermissionsForCreate,
  parseMenuPermissionsForUpdate,
  resolveEffectiveMenuPermissions,
  type MenuPermissionsMap,
} from "../menus/waba-menu-permissions.service";
import { listWabaMenuDefinitions } from "../menus/waba-menu-registry";
import {
  normalizeDispatchesApiKind,
  WABA_DISPATCHES_API_LABELS,
  type WabaDispatchesApiKind,
} from "../disparos/waba-dispatches-api-kind";
import {
  WabaSystemUserRepository,
  type WabaSystemUser,
  type WabaSystemUserRole,
} from "./waba-system-user.repository";

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const hashPassword = (password: string): string => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

const verifyPassword = (password: string, stored: string): boolean => {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  try {
    const expected = Buffer.from(hash, "hex");
    const derived = crypto.scryptSync(password, salt, 64);
    if (expected.length !== derived.length) return false;
    return crypto.timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
};

const ROLE_LABELS: Record<WabaSystemUserRole, string> = {
  master: "Master",
  operacional: "Operacional",
  suporte: "Suporte",
};

const parseRole = (value: string): WabaSystemUserRole | null => {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (raw === "master" || raw === "operacional" || raw === "suporte") return raw;
  return null;
};

const parseOperacionalDispatchesApiForRole = (
  role: WabaSystemUserRole,
  value: unknown,
  options: { required?: boolean } = {},
): WabaDispatchesApiKind | null => {
  if (role !== "operacional") return null;
  const parsed = normalizeDispatchesApiKind(value);
  if (!parsed && options.required) {
    throw new Error(
      "Selecione o tipo de disparos que este operacional atende (API Oficial ou API Alternativa).",
    );
  }
  return parsed;
};

export type CreateSystemUserInput = {
  fullName: string;
  email: string;
  password: string;
  role: string;
  menuPermissions?: unknown;
  operacionalDispatchesApi?: unknown;
};

export type UpdateSystemUserInput = {
  fullName?: string;
  email?: string;
  password?: string;
  menuPermissions?: unknown;
  operacionalDispatchesApi?: unknown;
};

export type PublicSystemUser = {
  id: string;
  fullName: string;
  email: string;
  role: WabaSystemUserRole;
  roleLabel: string;
  createdAt: string;
  createdAtLabel: string;
  menuPermissions: MenuPermissionsMap;
  enabledMenuCount: number;
  allowedMenuIds: string[];
  operacionalDispatchesApi: WabaDispatchesApiKind | null;
  operacionalDispatchesApiLabel: string;
};

const formatCreatedAtLabel = (iso: string): string => {
  const value = String(iso ?? "").trim();
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export class WabaSystemUserService {
  constructor(private readonly repository = new WabaSystemUserRepository()) {}

  private ensureUserMigrated(user: WabaSystemUser): WabaSystemUser {
    if (user.menuPermissions != null) return user;
    const migrated = this.repository.updateById(user.id, {
      menuPermissions: buildLegacyMigrationPermissions(),
    });
    return migrated ?? user;
  }

  private getUserWithMigration(email: string): WabaSystemUser | null {
    const user = this.repository.getByEmail(normalizeEmail(email));
    if (!user) return null;
    return this.ensureUserMigrated(user);
  }

  private toPublicUser(user: WabaSystemUser): PublicSystemUser {
    const effective = resolveEffectiveMenuPermissions(user);
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      roleLabel: ROLE_LABELS[user.role],
      createdAt: user.createdAt,
      createdAtLabel: formatCreatedAtLabel(user.createdAt),
      menuPermissions: effective,
      enabledMenuCount: countEnabledMenus(effective),
      allowedMenuIds: listAllowedMenuIds(user),
      operacionalDispatchesApi: user.operacionalDispatchesApi ?? null,
      operacionalDispatchesApiLabel: user.operacionalDispatchesApi
        ? WABA_DISPATCHES_API_LABELS[user.operacionalDispatchesApi]
        : "—",
    };
  }

  listPublicUsers(): PublicSystemUser[] {
    return this.repository
      .list()
      .map((user) => this.ensureUserMigrated(user))
      .map((user) => this.toPublicUser(user));
  }

  getByEmail(email: string): WabaSystemUser | null {
    return this.getUserWithMigration(email);
  }

  getRoleByEmail(email: string): WabaSystemUserRole | null {
    return this.getUserWithMigration(email)?.role ?? null;
  }

  getOperacionalDispatchesApiForEmail(email: string): WabaDispatchesApiKind | null {
    const user = this.getUserWithMigration(email);
    if (!user || user.role !== "operacional") return null;
    return user.operacionalDispatchesApi ?? null;
  }

  getSessionMenuAccess(email: string): { allowedMenuIds: string[]; menuPermissions: MenuPermissionsMap } {
    const user = this.getUserWithMigration(email);
    if (!user) {
      return { allowedMenuIds: [], menuPermissions: {} };
    }
    const menuPermissions = resolveEffectiveMenuPermissions(user);
    return {
      allowedMenuIds: listAllowedMenuIds(user),
      menuPermissions,
    };
  }

  validateCredentials(email: string, password: string): boolean {
    const user = this.repository.getByEmail(normalizeEmail(email));
    if (!user) return false;
    return verifyPassword(String(password ?? ""), user.passwordHash);
  }

  create(input: CreateSystemUserInput): PublicSystemUser {
    const email = normalizeEmail(input.email);
    const fullName = String(input.fullName ?? "").trim();
    const password = String(input.password ?? "");
    const role = parseRole(input.role);

    if (fullName.length < 2) throw new Error("Informe o nome do usuário.");
    if (!email.includes("@")) throw new Error("Informe um e-mail válido.");
    if (password.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");
    if (!role) throw new Error("Selecione o tipo de usuário (Master, Operacional ou Suporte).");

    const menuPermissions = parseMenuPermissionsForCreate(role, input.menuPermissions);
    if (role !== "master" && countEnabledMenus(menuPermissions) === 0) {
      throw new Error("Selecione pelo menos um menu para o usuário.");
    }
    const operacionalDispatchesApi = parseOperacionalDispatchesApiForRole(
      role,
      input.operacionalDispatchesApi,
      { required: true },
    );

    const now = new Date().toISOString();
    const user = this.repository.create({
      id: randomUUID(),
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

  update(userId: string, input: UpdateSystemUserInput): PublicSystemUser {
    const user = this.repository.getById(userId);
    if (!user) throw new Error("Usuário não encontrado.");

    const fullName =
      input.fullName !== undefined ? String(input.fullName).trim() : user.fullName;
    const email =
      input.email !== undefined ? normalizeEmail(input.email) : user.email;
    const password =
      input.password !== undefined ? String(input.password ?? "") : undefined;

    if (fullName.length < 2) throw new Error("Informe o nome do usuário.");
    if (!email.includes("@")) throw new Error("Informe um e-mail válido.");

    if (email !== user.email) {
      const existing = this.repository.getByEmail(email);
      if (existing && existing.id !== user.id) {
        throw new Error("Já existe um usuário com este e-mail.");
      }
    }

    const patch: Partial<
      Pick<
        WabaSystemUser,
        "fullName" | "email" | "passwordHash" | "menuPermissions" | "operacionalDispatchesApi"
      >
    > = { fullName, email };

    if (password !== undefined && password.length > 0) {
      if (password.length < 6) {
        throw new Error("A senha deve ter pelo menos 6 caracteres.");
      }
      patch.passwordHash = hashPassword(password);
    }

    if (input.menuPermissions !== undefined) {
      patch.menuPermissions = parseMenuPermissionsForUpdate(user.role, input.menuPermissions);
    }

    if (input.operacionalDispatchesApi !== undefined) {
      patch.operacionalDispatchesApi = parseOperacionalDispatchesApiForRole(
        user.role,
        input.operacionalDispatchesApi,
        { required: user.role === "operacional" },
      );
    }

    const updated = this.repository.updateById(user.id, patch);
    if (!updated) throw new Error("Usuário não encontrado.");
    return this.toPublicUser(updated);
  }

  updateMenuPermissions(userId: string, input: unknown): PublicSystemUser {
    return this.update(userId, { menuPermissions: input });
  }

  delete(userId: string, requesterEmail?: string): void {
    const user = this.repository.getById(userId);
    if (!user) throw new Error("Usuário não encontrado.");
    if (user.role === "master") {
      throw new Error("Usuários master não podem ser removidos por aqui.");
    }
    const requester = normalizeEmail(String(requesterEmail ?? ""));
    if (requester && requester === user.email) {
      throw new Error("Você não pode remover o próprio usuário enquanto estiver logado.");
    }
    const removed = this.repository.deleteById(user.id);
    if (!removed) throw new Error("Usuário não encontrado.");
  }

  listMenuDefinitionsForAdmin() {
    return listWabaMenuDefinitions();
  }

  ensureBootstrapFromEnvMaster() {
    const adminEmail = normalizeEmail(String(process.env.WABA_ADMIN_EMAIL ?? ""));
    const adminPassword = String(process.env.WABA_ADMIN_PASSWORD ?? "");
    if (!adminEmail.includes("@") || adminPassword.length < 6) return;

    const existing = this.repository.list();
    if (existing.length > 0) return;

    const now = new Date().toISOString();
    const displayName = adminEmail.split("@")[0] || "Master";
    this.repository.create({
      id: randomUUID(),
      fullName: displayName.charAt(0).toUpperCase() + displayName.slice(1),
      email: adminEmail,
      passwordHash: hashPassword(adminPassword),
      role: "master",
      menuPermissions: buildAllMenusEnabled(),
      createdAt: now,
      updatedAt: now,
    });
  }
}

export const isStaffRole = (role: string): role is WabaSystemUserRole =>
  role === "master" || role === "operacional" || role === "suporte";

export const getStaffRoleLabel = (role: WabaSystemUserRole): string => ROLE_LABELS[role];
