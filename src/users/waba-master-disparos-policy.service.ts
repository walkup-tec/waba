import { isWabaMasterEmail } from "../auth/waba-auth.service";
import { WabaSystemUserService } from "./waba-system-user.service";
import type { WabaSystemUser } from "./waba-system-user.repository";

export type MasterDisparosPolicy = {
  unlimitedCredits: boolean;
  splitSuppliers: boolean;
  splitProfits: boolean;
};

export const DEFAULT_MASTER_DISPAROS_POLICY: MasterDisparosPolicy = {
  unlimitedCredits: true,
  splitSuppliers: true,
  splitProfits: false,
};

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

export const resolveMasterDisparosPolicyFromUser = (
  user: WabaSystemUser,
): MasterDisparosPolicy => ({
  unlimitedCredits: user.masterUnlimitedCredits ?? DEFAULT_MASTER_DISPAROS_POLICY.unlimitedCredits,
  splitSuppliers: user.masterSplitSuppliers ?? DEFAULT_MASTER_DISPAROS_POLICY.splitSuppliers,
  splitProfits: user.masterSplitProfits ?? DEFAULT_MASTER_DISPAROS_POLICY.splitProfits,
});

export const parseMasterDisparosPolicyInput = (
  input: {
    masterUnlimitedCredits?: unknown;
    masterSplitSuppliers?: unknown;
    masterSplitProfits?: unknown;
  },
  options: { applyDefaults?: boolean } = {},
): MasterDisparosPolicy => {
  const applyDefaults = options.applyDefaults !== false;
  return {
    unlimitedCredits:
      input.masterUnlimitedCredits === undefined
        ? DEFAULT_MASTER_DISPAROS_POLICY.unlimitedCredits
        : input.masterUnlimitedCredits !== false,
    splitSuppliers:
      input.masterSplitSuppliers === undefined
        ? applyDefaults
          ? DEFAULT_MASTER_DISPAROS_POLICY.splitSuppliers
          : false
        : input.masterSplitSuppliers !== false,
    splitProfits: input.masterSplitProfits === true,
  };
};

export class WabaMasterDisparosPolicyService {
  constructor(private readonly systemUserService = new WabaSystemUserService()) {}

  resolveForEmail(email: string): MasterDisparosPolicy | null {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;

    const user = this.systemUserService.getByEmail(normalized);
    if (user?.role === "master") {
      return resolveMasterDisparosPolicyFromUser(user);
    }

    if (isWabaMasterEmail(normalized)) {
      return { ...DEFAULT_MASTER_DISPAROS_POLICY };
    }

    return null;
  }

  hasUnlimitedCredits(email: string): boolean {
    return this.resolveForEmail(email)?.unlimitedCredits === true;
  }
}
