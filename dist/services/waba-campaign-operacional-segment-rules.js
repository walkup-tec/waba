"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.operacionalCanServeSubscriberCampaign = exports.toOperacionalSegmentForSubscriber = void 0;
/** Segmento operacional equivalente ao segmento do assinante (fila primária). */
const toOperacionalSegmentForSubscriber = (segment) => (segment === "bets" ? "bets" : "outros");
exports.toOperacionalSegmentForSubscriber = toOperacionalSegmentForSubscriber;
/**
 * Regra da fila de distribuição:
 * - Operador Bets atende campanhas de assinantes Bets e Outros.
 * - Operador Outros atende apenas assinantes Outros (nunca Bets).
 */
const operacionalCanServeSubscriberCampaign = (subscriberSegment, operacionalSegment) => {
    const operador = operacionalSegment ?? "outros";
    if (subscriberSegment === "bets") {
        return operador === "bets";
    }
    return operador === "outros" || operador === "bets";
};
exports.operacionalCanServeSubscriberCampaign = operacionalCanServeSubscriberCampaign;
