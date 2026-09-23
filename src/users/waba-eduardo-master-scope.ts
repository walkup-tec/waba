/**
 * Visão e split do Master Eduardo: vale só a partir de 23/09/2026 (00:00 BRT).
 * Cadastros, campanhas e pagamentos anteriores não mudam.
 */

export const WALKUP_PROFIT_MASTER_EMAIL = "walkup@walkuptec.com.br";

/** 23/09/2026 00:00 no horário de Brasília. */
export const EDUARDO_MASTER_SCOPE_SINCE_ISO = "2026-09-23T03:00:00.000Z";
export const EDUARDO_MASTER_SCOPE_SINCE_MS = Date.parse(EDUARDO_MASTER_SCOPE_SINCE_ISO);

const normalizeEmail = (value: string): string => String(value || "").trim().toLowerCase();

export type EduardoScopeStaffUser = {
  email?: string | null;
  fullName?: string | null;
  role?: string | null;
};

export type EduardoScopeSubscriber = {
  email?: string | null;
  createdAt?: string | null;
  createdByEmail?: string | null;
};

export type EduardoScopeSplitParticipant = {
  email: string;
  label: string;
  sharePercent: number;
};

const parseTime = (value: string | null | undefined): number => {
  const ms = Date.parse(String(value || "").trim());
  return Number.isFinite(ms) ? ms : 0;
};

export const isOnOrAfterEduardoMasterScope = (iso: string | null | undefined): boolean => {
  const ms = parseTime(iso);
  return ms > 0 && ms >= EDUARDO_MASTER_SCOPE_SINCE_MS;
};

export const resolveEduardoMasterEmails = (users: EduardoScopeStaffUser[] = []): string[] => {
  const emails = new Set<string>();
  const fromEnv = normalizeEmail(String(process.env.WABA_EDUARDO_MASTER_EMAIL || ""));
  if (fromEnv.includes("@")) emails.add(fromEnv);

  for (const user of users) {
    if (String(user.role || "").trim().toLowerCase() !== "master") continue;
    const email = normalizeEmail(String(user.email || ""));
    if (!email.includes("@")) continue;
    if (/\beduardo\b/i.test(String(user.fullName || ""))) emails.add(email);
  }
  return [...emails];
};

export const isEduardoScopedMaster = (
  email: string,
  users: EduardoScopeStaffUser[] = [],
): boolean => {
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@")) return false;
  return resolveEduardoMasterEmails(users).includes(normalized);
};

export const subscriberCreatedByEmail = (subscriber: EduardoScopeSubscriber | null | undefined): string =>
  normalizeEmail(String(subscriber?.createdByEmail || ""));

export const subscriberBelongsToEduardo = (
  subscriber: EduardoScopeSubscriber | null | undefined,
  eduardoEmail: string,
): boolean => {
  const owner = normalizeEmail(eduardoEmail);
  if (!owner.includes("@") || !subscriber) return false;
  return subscriberCreatedByEmail(subscriber) === owner;
};

export const canViewerSeeSubscriber = (
  viewerEmail: string,
  subscriber: EduardoScopeSubscriber | null | undefined,
  users: EduardoScopeStaffUser[] = [],
): boolean => {
  if (!isEduardoScopedMaster(viewerEmail, users)) return true;
  if (!subscriber) return false;
  if (!isOnOrAfterEduardoMasterScope(subscriber.createdAt)) return true;
  return subscriberBelongsToEduardo(subscriber, viewerEmail);
};

export const canViewerSeeCampaign = (
  viewerEmail: string,
  campaignCreatedAt: string | null | undefined,
  subscriber: EduardoScopeSubscriber | null | undefined,
  users: EduardoScopeStaffUser[] = [],
): boolean => {
  if (!isEduardoScopedMaster(viewerEmail, users)) return true;
  if (!isOnOrAfterEduardoMasterScope(campaignCreatedAt)) return true;
  return canViewerSeeSubscriber(viewerEmail, subscriber, users);
};

export const canViewerSeeFinanceiroOrder = (
  viewerEmail: string,
  orderAt: string | null | undefined,
  subscriber: EduardoScopeSubscriber | null | undefined,
  users: EduardoScopeStaffUser[] = [],
): boolean => {
  if (!isEduardoScopedMaster(viewerEmail, users)) return true;
  if (!isOnOrAfterEduardoMasterScope(orderAt)) return true;
  return canViewerSeeSubscriber(viewerEmail, subscriber, users);
};

const isWalkupProfitParticipant = (participant: EduardoScopeSplitParticipant): boolean => {
  const email = normalizeEmail(participant.email);
  if (email === WALKUP_PROFIT_MASTER_EMAIL) return true;
  if (email.startsWith("walkup@")) return true;
  return /\bwalkup\b/i.test(String(participant.label || ""));
};

/**
 * Lucro de pedido novo: 50/50 só se o assinante foi cadastrado pelo Eduardo.
 * Assinante de outro canal (a partir de 23/09) → 100% Walkup.
 * Pedidos e assinantes anteriores à data de corte mantêm o percentual configurado.
 * A tela Financeiro > Split continua exibindo a config (50%/50%).
 */
export const resolveEduardoOriginProfitPercents = <T extends EduardoScopeSplitParticipant>(
  participants: T[],
  subscriber: EduardoScopeSubscriber | null | undefined,
  paidAt: string | null | undefined,
  users: EduardoScopeStaffUser[] = [],
): T[] => {
  if (!participants.length) return participants;
  if (!isOnOrAfterEduardoMasterScope(paidAt)) return participants;
  if (subscriber && !isOnOrAfterEduardoMasterScope(subscriber.createdAt)) return participants;

  const eduardoEmails = new Set(resolveEduardoMasterEmails(users));
  const createdBy = subscriberCreatedByEmail(subscriber);
  if (createdBy && eduardoEmails.has(createdBy)) return participants;

  const walkupIndex = participants.findIndex(isWalkupProfitParticipant);
  if (walkupIndex < 0) return participants;

  return participants.map((item, index) => ({
    ...item,
    sharePercent: index === walkupIndex ? 100 : 0,
  }));
};
