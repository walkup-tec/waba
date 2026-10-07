"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EDUARDO_QUANTUMIVST_EMAIL = void 0;
exports.runRemoveEduardoQuantumivstOneshot = runRemoveEduardoQuantumivstOneshot;
const waba_financeiro_split_repository_1 = require("../billing/waba-financeiro-split.repository");
const waba_system_user_repository_1 = require("./waba-system-user.repository");
const waba_subscriber_master_visibility_1 = require("./waba-subscriber-master-visibility");
exports.EDUARDO_QUANTUMIVST_EMAIL = "quantumivst@gmail.com";
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const isWalkupProfitParticipant = (email, label) => {
    const normalized = normalizeEmail(email);
    if (normalized === waba_subscriber_master_visibility_1.WALKUP_MASTER_EMAIL)
        return true;
    if (normalized.startsWith("walkup@"))
        return true;
    return /\bwalkup\b/i.test(String(label || ""));
};
function runRemoveEduardoQuantumivstOneshot(deps = {}) {
    const userRepository = deps.userRepository ?? new waba_system_user_repository_1.WabaSystemUserRepository();
    const splitRepository = deps.splitRepository ?? new waba_financeiro_split_repository_1.WabaFinanceiroSplitRepository();
    const email = exports.EDUARDO_QUANTUMIVST_EMAIL;
    const user = userRepository.getByEmail(email);
    let userRemoved = false;
    if (user) {
        userRemoved = userRepository.deleteById(user.id);
    }
    const config = splitRepository.get();
    const removedParticipants = config.participants.filter((item) => normalizeEmail(item.email) === email);
    let splitRemoved = false;
    if (removedParticipants.length) {
        const removedShare = removedParticipants.reduce((sum, item) => sum + Math.max(0, Number(item.sharePercent || 0)), 0);
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
    const parts = [];
    if (userRemoved)
        parts.push("usuário master removido");
    if (splitRemoved)
        parts.push("participante do split removido");
    return {
        ok: true,
        applied: true,
        userRemoved,
        splitRemoved,
        message: `${email}: ${parts.join("; ")}.`,
    };
}
