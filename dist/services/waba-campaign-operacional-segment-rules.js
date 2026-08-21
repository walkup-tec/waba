"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.operacionalCanServeSubscriberCampaign = exports.toOperacionalSegmentForSubscriber = void 0;
const waba_operacional_segments_1 = require("../users/waba-operacional-segments");
/** Segmento operacional equivalente ao segmento do assinante (fila primária). */
const toOperacionalSegmentForSubscriber = (segment) => (segment === "bets" ? "bets" : "outros");
exports.toOperacionalSegmentForSubscriber = toOperacionalSegmentForSubscriber;
const toSegmentList = (input) => {
    if (Array.isArray(input)) {
        return (0, waba_operacional_segments_1.resolveOperacionalSegments)({ operacionalSegments: input });
    }
    if (input && typeof input === "object") {
        return (0, waba_operacional_segments_1.resolveOperacionalSegments)(input);
    }
    return (0, waba_operacional_segments_1.resolveOperacionalSegments)({ operacionalSegment: input ?? null });
};
/**
 * Regra da fila / painel operacional:
 * o operacional atende campanhas cujo segmento do assinante está na lista marcada.
 * (Migração de legado `bets` inclui Outros via resolveOperacionalSegments.)
 */
const operacionalCanServeSubscriberCampaign = (subscriberSegment, operacionalSegment) => {
    const segments = toSegmentList(operacionalSegment);
    const needed = (0, exports.toOperacionalSegmentForSubscriber)(subscriberSegment);
    return segments.includes(needed);
};
exports.operacionalCanServeSubscriberCampaign = operacionalCanServeSubscriberCampaign;
