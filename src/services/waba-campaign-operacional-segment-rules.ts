import type { WabaSubscriberSegment } from "../subscribers/waba-subscriber-segment";
import type { WabaSystemUserOperacionalSegment } from "../users/waba-system-user.repository";
import { resolveOperacionalSegments } from "../users/waba-operacional-segments";

/** Segmento operacional equivalente ao segmento do assinante (fila primária). */
export const toOperacionalSegmentForSubscriber = (
  segment: WabaSubscriberSegment,
): WabaSystemUserOperacionalSegment => (segment === "bets" ? "bets" : "outros");

type OperacionalSegmentInput =
  | WabaSystemUserOperacionalSegment
  | WabaSystemUserOperacionalSegment[]
  | null
  | undefined
  | {
      operacionalSegment?: WabaSystemUserOperacionalSegment | null;
      operacionalSegments?: WabaSystemUserOperacionalSegment[] | null;
    };

const toSegmentList = (
  input: OperacionalSegmentInput,
): WabaSystemUserOperacionalSegment[] => {
  if (Array.isArray(input)) {
    return resolveOperacionalSegments({ operacionalSegments: input });
  }
  if (input && typeof input === "object") {
    return resolveOperacionalSegments(input);
  }
  return resolveOperacionalSegments({ operacionalSegment: input ?? null });
};

/**
 * Regra da fila / painel operacional:
 * o operacional atende campanhas cujo segmento do assinante está na lista marcada.
 * (Migração de legado `bets` inclui Outros via resolveOperacionalSegments.)
 */
export const operacionalCanServeSubscriberCampaign = (
  subscriberSegment: WabaSubscriberSegment,
  operacionalSegment: OperacionalSegmentInput,
): boolean => {
  const segments = toSegmentList(operacionalSegment);
  const needed = toOperacionalSegmentForSubscriber(subscriberSegment);
  return segments.includes(needed);
};
