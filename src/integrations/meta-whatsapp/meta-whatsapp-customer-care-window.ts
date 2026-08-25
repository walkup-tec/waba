/**
 * Janela de atendimento (customer care window) da Cloud API.
 *
 * Mensagens livres (tipo text) dependem da janela aplicável na conta/WABA.
 * Fora da janela, a Meta normalmente exige template aprovado.
 *
 * Este módulo NÃO bloqueia envio. Sem last_inbound_at confiável, withinWindow = null.
 */
export type CustomerCareWindowState = {
  known: boolean;
  withinWindow: boolean | null;
  lastInboundAt: string | null;
  windowHours: 24;
};

const WINDOW_MS = 24 * 60 * 60 * 1000;

export function resolveCustomerCareWindow(input: {
  lastInboundAt?: string | null;
  now?: Date;
}): CustomerCareWindowState {
  const lastInboundAt = input.lastInboundAt ? String(input.lastInboundAt) : null;
  if (!lastInboundAt) {
    return { known: false, withinWindow: null, lastInboundAt: null, windowHours: 24 };
  }
  const last = Date.parse(lastInboundAt);
  if (!Number.isFinite(last)) {
    return { known: false, withinWindow: null, lastInboundAt, windowHours: 24 };
  }
  const now = (input.now || new Date()).getTime();
  return {
    known: true,
    withinWindow: now - last <= WINDOW_MS,
    lastInboundAt,
    windowHours: 24,
  };
}
