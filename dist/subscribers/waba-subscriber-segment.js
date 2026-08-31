"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBetsSubscriberEmail = exports.getSubscriberSegmentByEmail = exports.resolveSignupSegmentFromRequest = exports.parseWabaSubscriberSegment = exports.WABA_SUBSCRIBER_SEGMENT_LABELS = void 0;
const waba_subscriber_repository_1 = require("./waba-subscriber.repository");
exports.WABA_SUBSCRIBER_SEGMENT_LABELS = {
    bets: "Bets",
    outros: "Outros",
};
const normalizeRaw = (value) => String(value ?? "")
    .trim()
    .toLowerCase();
const parseWabaSubscriberSegment = (raw, options) => {
    const value = normalizeRaw(raw);
    if (!value) {
        if (options?.required) {
            throw new Error("Selecione o segmento do assinante (Bets ou Outros).");
        }
        return options?.defaultValue ?? "outros";
    }
    if (value === "bets" || value === "bet")
        return "bets";
    if (value === "outros" ||
        value === "outro" ||
        value === "todos" ||
        value === "wabadisparos" ||
        value === "waba-disparos" ||
        value === "drax" ||
        value === "default") {
        return "outros";
    }
    if (value === "bet-waba" ||
        value === "betwaba" ||
        value === "bet.waba.info" ||
        value === "bet_waba") {
        return "bets";
    }
    throw new Error("Segmento inválido. Use Bets ou Outros.");
};
exports.parseWabaSubscriberSegment = parseWabaSubscriberSegment;
const resolveSignupSegmentFromRequest = (body, headers) => {
    const explicit = normalizeRaw(body.segment ?? body.signupOrigin ?? body.signupSource);
    if (explicit) {
        try {
            return (0, exports.parseWabaSubscriberSegment)(explicit, { defaultValue: "outros" });
        }
        catch {
            /* tenta inferir pelo host */
        }
    }
    const hostHint = `${headers.origin ?? ""} ${headers.referer ?? ""}`.toLowerCase();
    if (hostHint.includes("bet.waba.info"))
        return "bets";
    if (hostHint.includes("wabadisparos.com.br"))
        return "outros";
    return "outros";
};
exports.resolveSignupSegmentFromRequest = resolveSignupSegmentFromRequest;
const subscriberRepository = new waba_subscriber_repository_1.WabaSubscriberRepository();
const getSubscriberSegmentByEmail = (email) => {
    const normalized = String(email ?? "").trim().toLowerCase();
    if (!normalized.includes("@"))
        return "outros";
    const subscriber = subscriberRepository.getByEmail(normalized);
    return subscriber?.segment ?? "outros";
};
exports.getSubscriberSegmentByEmail = getSubscriberSegmentByEmail;
const isBetsSubscriberEmail = (email) => (0, exports.getSubscriberSegmentByEmail)(email) === "bets";
exports.isBetsSubscriberEmail = isBetsSubscriberEmail;
