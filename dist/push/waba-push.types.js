"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEGACY_WRONG_PUSH_COMMUNITY_INSTANCES = void 0;
exports.resolveDefaultPushCommunityEvoInstance = resolveDefaultPushCommunityEvoInstance;
exports.resolvePushCommunityEvoInstanceFallbacks = resolvePushCommunityEvoInstanceFallbacks;
/** Instância Evolution admin da comunidade WhatsApp (override: WABA_PUSH_COMMUNITY_EVO_INSTANCE). */
function resolveDefaultPushCommunityEvoInstance() {
    const fromEnv = String(process.env.WABA_PUSH_COMMUNITY_EVO_INSTANCE || "").trim();
    if (fromEnv)
        return fromEnv;
    return "Drax Sistemas 5181077770";
}
function resolvePushCommunityEvoInstanceFallbacks() {
    const fromEnv = String(process.env.WABA_PUSH_COMMUNITY_EVO_INSTANCE_FALLBACKS || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    if (fromEnv.length)
        return fromEnv;
    return ["Drax Sistemas 5181077770", "drax-oficial"];
}
exports.LEGACY_WRONG_PUSH_COMMUNITY_INSTANCES = new Set([
    "walkup",
    "drax sistemas 5181076973",
]);
