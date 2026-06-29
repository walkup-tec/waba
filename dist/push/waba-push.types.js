"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDefaultPushCommunityEvoInstance = resolveDefaultPushCommunityEvoInstance;
/** Instância Evolution admin da comunidade WhatsApp (override: WABA_PUSH_COMMUNITY_EVO_INSTANCE). */
function resolveDefaultPushCommunityEvoInstance() {
    const fromEnv = String(process.env.WABA_PUSH_COMMUNITY_EVO_INSTANCE || "").trim();
    return fromEnv || "Drax Sistemas 5181077770";
}
