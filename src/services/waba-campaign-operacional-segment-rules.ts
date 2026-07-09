import type { WabaSubscriberSegment } from "../subscribers/waba-subscriber-segment";
import type { WabaSystemUserOperacionalSegment } from "../users/waba-system-user.repository";

/** Segmento operacional equivalente ao segmento do assinante (fila primária). */
export const toOperacionalSegmentForSubscriber = (
  segment: WabaSubscriberSegment,
): WabaSystemUserOperacionalSegment => (segment === "bets" ? "bets" : "outros");

/**
 * Regra da fila de distribuição:
 * - Operador Bets atende campanhas de assinantes Bets e Outros.
 * - Operador Outros atende apenas assinantes Outros (nunca Bets).
 */
export const operacionalCanServeSubscriberCampaign = (
  subscriberSegment: WabaSubscriberSegment,
  operacionalSegment: WabaSystemUserOperacionalSegment | null | undefined,
): boolean => {
  const operador = operacionalSegment ?? "outros";
  if (subscriberSegment === "bets") {
    return operador === "bets";
  }
  return operador === "outros" || operador === "bets";
};
