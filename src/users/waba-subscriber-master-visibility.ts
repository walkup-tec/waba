/**
 * Visibilidade e origem do assinante para usuários master.
 * walkup@walkuptec.com.br sempre vê todos e controla o liga/desliga.
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
  visibleToMasters?: boolean | null;
};

export type MasterVisibilitySplitParticipant = {
  email: string;
  label: string;
  sharePercent: number;
};

export type ResolvedSubscriberOrigin = {
  kind: "site" | "user";
  label: string;
  userEmail: string;
};

export const isWalkupMasterEmail = (email: string): boolean =>
  normalizeEmail(email) === WALKUP_MASTER_EMAIL;

export const isSubscriberVisibleToMasters = (
  subscriber: MasterVisibilitySubscriber | null | undefined,
): boolean => {
  if (!subscriber) return false;
  return subscriber.visibleToMasters !== false;
};

export const defaultVisibleToMastersOnRegister = (input: {
  createdByEmail?: string | null;
  indicatorUserId?: string | null;
}): boolean => {
  if (normalizeEmail(String(input.createdByEmail || "")).includes("@")) return true;
  if (String(input.indicatorUserId || "").trim()) return true;
  return false;
};

export const canViewerSeeSubscriber = (
  viewerEmail: string,
  subscriber: MasterVisibilitySubscriber | null | undefined,
): boolean => {
  if (isWalkupMasterEmail(viewerEmail)) return true;
  return isSubscriberVisibleToMasters(subscriber);
};

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

const isWalkupProfitParticipant = (participant: MasterVisibilitySplitParticipant): boolean => {
  const email = normalizeEmail(participant.email);
  if (email === WALKUP_MASTER_EMAIL) return true;
  if (email.startsWith("walkup@")) return true;
  return /\bwalkup\b/i.test(String(participant.label || ""));
};

/**
 * Assinante visível aos masters → percentuais da tela Financeiro > Split.
 * Assinante oculto → 100% Walkup e 0% Eduardo (e demais parceiros).
 */
export const resolveVisibleMasterProfitPercents = <T extends MasterVisibilitySplitParticipant>(
  participants: T[],
  subscriber: MasterVisibilitySubscriber | null | undefined,
): T[] => {
  if (!participants.length) return participants;
  if (isSubscriberVisibleToMasters(subscriber)) return participants;

  const walkupIndex = participants.findIndex(isWalkupProfitParticipant);
  if (walkupIndex < 0) return participants;

  return participants.map((item, index) => ({
    ...item,
    sharePercent: index === walkupIndex ? 100 : 0,
  }));
};
