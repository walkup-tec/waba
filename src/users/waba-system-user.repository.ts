import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataFile } from "../data-path";

import type { WabaDispatchesApiKind } from "../disparos/waba-dispatches-api-kind";

export type WabaSystemUserRole = "master" | "operacional" | "suporte";
export type WabaSystemUserOperacionalSegment = "bets" | "todos";

export type WabaSystemUser = {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  whatsapp?: string;
  role: WabaSystemUserRole;
  /** Operacional: fila de campanhas (API Oficial ou API Alternativa). */
  operacionalDispatchesApi?: WabaDispatchesApiKind | null;
  /** Operacional: segmento atendido no painel. */
  operacionalSegment?: WabaSystemUserOperacionalSegment | null;
  /** Master: créditos ilimitados para disparos (padrão true). */
  masterUnlimitedCredits?: boolean;
  /** Master: repasse PIX ao fornecedor no split (padrão true). */
  masterSplitSuppliers?: boolean;
  /** Master: repasse PIX de lucros no split (padrão false). */
  masterSplitProfits?: boolean;
  /** null = legado (migrar na primeira leitura); chave ausente = menu desabilitado */
  menuPermissions?: Record<string, boolean> | null;
  createdAt: string;
  updatedAt: string;
};

type Store = {
  version: 1;
  users: WabaSystemUser[];
};

const FILE_NAME = "waba-system-users.json";

const emptyStore = (): Store => ({ version: 1, users: [] });

export class WabaSystemUserRepository {
  private readStore(): Store {
    const filePath = resolveDataFile(FILE_NAME);
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (!existsSync(filePath)) return emptyStore();
    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Store;
      if (parsed?.version !== 1 || !Array.isArray(parsed.users)) return emptyStore();
      return parsed;
    } catch {
      return emptyStore();
    }
  }

  private writeStore(store: Store) {
    const filePath = resolveDataFile(FILE_NAME);
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const tmp = `${filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
    writeFileSync(filePath, readFileSync(tmp));
  }

  list(): WabaSystemUser[] {
    return this.readStore().users.slice().sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));
  }

  getById(id: string): WabaSystemUser | null {
    const normalized = String(id ?? "").trim();
    if (!normalized) return null;
    return this.readStore().users.find((item) => item.id === normalized) ?? null;
  }

  getByEmail(email: string): WabaSystemUser | null {
    const normalized = email.trim().toLowerCase();
    return this.list().find((item) => item.email === normalized) ?? null;
  }

  getRoleByEmail(email: string): WabaSystemUserRole | null {
    return this.getByEmail(email)?.role ?? null;
  }

  create(user: WabaSystemUser): WabaSystemUser {
    const store = this.readStore();
    if (store.users.some((item) => item.email === user.email)) {
      throw new Error("Já existe um usuário com este e-mail.");
    }
    store.users.push(user);
    this.writeStore(store);
    return user;
  }

  updateById(
    id: string,
    patch: Partial<
        Pick<
        WabaSystemUser,
        | "menuPermissions"
        | "whatsapp"
        | "operacionalDispatchesApi"
        | "operacionalSegment"
        | "masterUnlimitedCredits"
        | "masterSplitSuppliers"
        | "masterSplitProfits"
        | "updatedAt"
        | "fullName"
        | "email"
        | "passwordHash"
      >
    >,
  ): WabaSystemUser | null {
    const store = this.readStore();
    const index = store.users.findIndex((item) => item.id === id);
    if (index < 0) return null;
    const current = store.users[index];
    const next: WabaSystemUser = {
      ...current,
      ...patch,
      updatedAt: patch.updatedAt ?? new Date().toISOString(),
    };
    store.users[index] = next;
    this.writeStore(store);
    return next;
  }

  deleteById(id: string): boolean {
    const normalized = String(id ?? "").trim();
    if (!normalized) return false;
    const store = this.readStore();
    const index = store.users.findIndex((item) => item.id === normalized);
    if (index < 0) return false;
    store.users.splice(index, 1);
    this.writeStore(store);
    return true;
  }

  replaceAll(users: WabaSystemUser[]) {
    this.writeStore({ version: 1, users });
  }
}
