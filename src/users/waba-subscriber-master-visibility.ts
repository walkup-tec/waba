/**
 * Origem do assinante na lista do master (Site vs usuário que cadastrou).
 */

export const WALKUP_MASTER_EMAIL = "walkup@walkuptec.com.br";

const normalizeEmail = (value: string): string => String(value || "").trim().toLowerCase();

export type MasterVisibilityStaffUser = {
  id?: string | null;
  email?: string | null;
  fullName?: string | null;
  role?: string | null;
};

export type MasterVisibilitySubscriber = {
  email?: string | null;
  createdByEmail?: string | null;
  indicatorUserId?: string | null;
};

export type ResolvedSubscriberOrigin = {
  kind: "site" | "user";
  label: string;
  userEmail: string;
};

export const isWalkupMasterEmail = (email: string): boolean =>
  normalizeEmail(email) === WALKUP_MASTER_EMAIL;

export const resolveSubscriberOrigin = (
  subscriber: MasterVisibilitySubscriber | null | undefined,
  users: MasterVisibilityStaffUser[] = [],
): ResolvedSubscriberOrigin => {
  const createdBy = normalizeEmail(String(subscriber?.createdByEmail || ""));
  if (createdBy.includes("@")) {
    const user = users.find((item) => normalizeEmail(String(item.email || "")) === createdBy);
    const name = String(user?.fullName || "").trim();
    return {
      kind: "user",
      label: name || createdBy,
      userEmail: createdBy,
    };
  }

  const indicatorId = String(subscriber?.indicatorUserId || "").trim();
  if (indicatorId) {
    const user = users.find((item) => String(item.id || "").trim() === indicatorId);
    const name = String(user?.fullName || "").trim();
    return {
      kind: "user",
      label: name || "Indicador",
      userEmail: normalizeEmail(String(user?.email || "")),
    };
  }

  return { kind: "site", label: "Site", userEmail: "" };
};
