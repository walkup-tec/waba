import { WabaFinanceiroSplitRepository } from "../billing/waba-financeiro-split.repository";
import { WabaSystemUserRepository } from "./waba-system-user.repository";
import { WALKUP_MASTER_EMAIL } from "./waba-subscriber-master-visibility";

export const EDUARDO_QUANTUMIVST_EMAIL = "quantumivst@gmail.com";

const normalizeEmail = (value: string): string => String(value || "").trim().toLowerCase();

const isWalkupProfitParticipant = (email: string, label: string): boolean => {
  const normalized = normalizeEmail(email);
  if (normalized === WALKUP_MASTER_EMAIL) return true;
  if (normalized.startsWith("walkup@")) return true;
  return /\bwalkup\b/i.test(String(label || ""));
};

export type RemoveEduardoQuantumivstOneshotResult = {
  ok: boolean;
  skipped?: boolean;
  applied?: boolean;
  userRemoved: boolean;
  splitRemoved: boolean;
  message: string;
};

export type RemoveEduardoQuantumivstOneshotDeps = {
  userRepository?: WabaSystemUserRepository;
  splitRepository?: WabaFinanceiroSplitRepository;
};

export function runRemoveEduardoQuantumivstOneshot(
  deps: RemoveEduardoQuantumivstOneshotDeps = {},
): RemoveEduardoQuantumivstOneshotResult {
  const userRepository = deps.userRepository ?? new WabaSystemUserRepository();
  const splitRepository = deps.splitRepository ?? new WabaFinanceiroSplitRepository();
  const email = EDUARDO_QUANTUMIVST_EMAIL;

  const user = userRepository.getByEmail(email);
  let userRemoved = false;
  if (user) {
    userRemoved = userRepository.deleteById(user.id);
  }

  const config = splitRepository.get();
  const removedParticipants = config.participants.filter(
    (item) => normalizeEmail(item.email) === email,
  );
  let splitRemoved = false;
  if (removedParticipants.length) {
    const removedShare = removedParticipants.reduce(
      (sum, item) => sum + Math.max(0, Number(item.sharePercent || 0)),
      0,
    );
    const kept = config.participants.filter((item) => normalizeEmail(item.email) !== email);
    const walkup = kept.find((item) => isWalkupProfitParticipant(item.email, item.label));
    if (walkup && removedShare > 0) {
      walkup.sharePercent = Math.min(100, Number(walkup.sharePercent || 0) + removedShare);
    }
    splitRepository.save({ ...config, participants: kept });
    splitRemoved = true;
  }

  if (!userRemoved && !splitRemoved) {
    return {
      ok: true,
      skipped: true,
      userRemoved: false,
      splitRemoved: false,
      message: `${email} já não está no cadastro nem no split.`,
    };
  }

  const parts: string[] = [];
  if (userRemoved) parts.push("usuário master removido");
  if (splitRemoved) parts.push("participante do split removido");
  return {
    ok: true,
    applied: true,
    userRemoved,
    splitRemoved,
    message: `${email}: ${parts.join("; ")}.`,
  };
}
