import { defaultEvoSendTextTimeoutMs } from "../evo-http.client";
import {
  fetchEvoInstanceLiveState,
  isEvoLiveStateOpen,
} from "../instances/evo-connection-state.service";
import { sendEvoTextAlert } from "../monitoring/evo-text-alert.client";
import {
  resolveConnectedEvoInstanceByPhoneHint,
  resolveConnectedEvoOutboundInstance,
} from "../push/waba-push-community.service";
import { getAquecedorLifecycleStatusForInstance } from "../services/aquecedor-instance-lifecycle.service";
import { waitForEvoOutboundDeliveryAck } from "./waba-evolution-delivery-ack";
import type {
  WabaWhatsAppDeliveryResult,
  WabaWhatsAppDeliveryStatus,
} from "./waba-welcome-whatsapp.service";

export type { WabaWhatsAppDeliveryResult, WabaWhatsAppDeliveryStatus };

/** Sequência padrão Evolution para todos os envios WhatsApp do WABA. */
export const DEFAULT_WABA_WHATSAPP_PHONE_HINTS = ["51981077770", "51997462102", "51981082477"] as const;

const resolveWabaWhatsAppPhoneHints = (): string[] => {
  const hints = [
    String(
      process.env.WABA_WHATSAPP_PRIMARY_PHONE ||
        process.env.WABA_OPERACIONAL_NOTIFY_WHATSAPP_PRIMARY_PHONE ||
        process.env.WABA_WELCOME_WHATSAPP_PRIMARY_PHONE ||
        DEFAULT_WABA_WHATSAPP_PHONE_HINTS[0],
    ).trim(),
    String(
      process.env.WABA_WHATSAPP_SECONDARY_PHONE ||
        process.env.WABA_WHATSAPP_FALLBACK_PHONE ||
        process.env.WABA_OPERACIONAL_NOTIFY_WHATSAPP_FALLBACK_PHONE ||
        process.env.WABA_OPERACIONAL_NOTIFY_WHATSAPP_SECONDARY_PHONE ||
        process.env.WABA_WELCOME_WHATSAPP_FALLBACK_PHONE ||
        DEFAULT_WABA_WHATSAPP_PHONE_HINTS[1],
    ).trim(),
    String(
      process.env.WABA_WHATSAPP_TERTIARY_PHONE ||
        process.env.WABA_OPERACIONAL_NOTIFY_WHATSAPP_TERTIARY_PHONE ||
        DEFAULT_WABA_WHATSAPP_PHONE_HINTS[2],
    ).trim(),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const hint of hints) {
    const digits = hint.replace(/\D/g, "");
    if (!digits || seen.has(digits)) continue;
    seen.add(digits);
    out.push(digits);
  }
  return out;
};

const resolveWabaWhatsAppMaxRounds = (): number => {
  const raw =
    process.env.WABA_WHATSAPP_MAX_ROUNDS || process.env.WABA_OPERACIONAL_NOTIFY_WHATSAPP_MAX_ROUNDS;
  if (raw !== undefined && String(raw).trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1) return Math.min(30, Math.round(n));
  }
  return 15;
};

const resolveWabaWhatsAppRoundDelayMs = (): number => {
  const raw =
    process.env.WABA_WHATSAPP_ROUND_DELAY_MS ||
    process.env.WABA_OPERACIONAL_NOTIFY_WHATSAPP_ROUND_DELAY_MS;
  if (raw !== undefined && String(raw).trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 500) return Math.round(n);
  }
  return 2500;
};

const resolveWabaWhatsAppSendTimeoutMs = (): number => {
  const raw =
    process.env.WABA_WHATSAPP_SEND_TIMEOUT_MS ||
    process.env.WABA_OPERACIONAL_NOTIFY_WHATSAPP_SEND_TIMEOUT_MS ||
    process.env.WABA_WELCOME_WHATSAPP_SEND_TIMEOUT_MS;
  if (raw !== undefined && String(raw).trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 12_000) return Math.round(n);
  }
  return defaultEvoSendTextTimeoutMs();
};

/** Boas-vindas: após N ACK ERROR no número eleito, failover para secundário/terciário. */
export const resolveWelcomeAckFailoverThreshold = (): number => {
  const raw =
    process.env.WABA_WELCOME_ACK_FAILOVER_AFTER ||
    process.env.WABA_WHATSAPP_WELCOME_ACK_FAILOVER_AFTER;
  if (raw !== undefined && String(raw).trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1) return Math.min(10, Math.round(n));
  }
  return 3;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

const isRecoverableSendFailure = (detail: string, status: number): boolean => {
  const text = String(detail || "").toLowerCase();
  if (status === 404) return true;
  if (status === 0) return true;
  if (status >= 500) return true;
  if (text.includes("not found") || text.includes("does not exist")) return true;
  if (text.includes("instance") && text.includes("exist")) return true;
  if (text.includes("disconnected") || text.includes("not connected")) return true;
  if (text.includes("integrationsession") || text.includes("internal server error")) return true;
  if (text.includes("socket hang up") || text.includes("econnreset") || text.includes("timeout")) {
    return true;
  }
  if (text.includes("network") || text.includes("fetch failed")) return true;
  return false;
};

const shouldSkipInstanceForSend = (liveState: string): boolean => {
  const state = String(liveState || "").trim().toLowerCase();
  if (!state) return false;
  if (isEvoLiveStateOpen(state)) return false;
  return state === "close" || state === "closed" || state === "disconnected";
};

type EvoSendSlot = {
  phoneHint: string;
  instanceName: string;
};

/**
 * Resolve slots por telefone. Nunca filtra por lifecycle do aquecedor
 * (Preparando / pausa humana) — isso vale só para aquecedor/campanhas.
 * Com `allowAnyOpenFallback`, se nenhum hint estiver open, usa qualquer EVO conectada.
 */
const resolveEvoSendSlots = async (
  phoneHints: string[],
  opts?: {
    allowAnyOpenFallback?: boolean;
    logLabel?: string;
    verifyLiveIfCatalogClosed?: boolean;
  },
): Promise<EvoSendSlot[]> => {
  const slots: EvoSendSlot[] = [];
  const seen = new Set<string>();
  for (const phoneHint of phoneHints) {
    const instanceName = await resolveConnectedEvoInstanceByPhoneHint(phoneHint, {
      verifyLiveIfCatalogClosed: Boolean(opts?.verifyLiveIfCatalogClosed),
    });
    if (!instanceName) {
      console.warn(`[whatsapp] instância ${phoneHint} indisponível (desconectada ou não encontrada).`);
      continue;
    }
    const key = instanceName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    slots.push({ phoneHint, instanceName });
  }

  if (!slots.length && opts?.allowAnyOpenFallback) {
    try {
      const fallbackName = await resolveConnectedEvoOutboundInstance();
      const key = fallbackName.toLowerCase();
      if (!seen.has(key)) {
        console.warn(
          `[whatsapp] ${opts.logLabel || "whatsapp"}: hints sem open — fallback qualquer conectada → ${fallbackName}.`,
        );
        slots.push({ phoneHint: "fallback-any-open", instanceName: fallbackName });
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.warn(
        `[whatsapp] ${opts.logLabel || "whatsapp"}: fallback qualquer conectada indisponível:`,
        detail.slice(0, 220),
      );
    }
  }
  return slots;
};

/**
 * Boas-vindas: usa o número eleito (1º hint) mesmo em pausa humana/Preparando.
 * Failover imediato se o eleito estiver desconectado.
 * Após `primaryAckErrors` >= limiar (padrão 3 ACK ERROR), usa secundário/terciário.
 */
const resolveWelcomeEvoSendSlots = async (
  phoneHints: string[],
  logLabel: string,
  options?: { primaryAckErrors?: number; ackFailoverThreshold?: number },
): Promise<EvoSendSlot[]> => {
  if (!phoneHints.length) return [];

  const primaryAckErrors = Math.max(0, Math.round(Number(options?.primaryAckErrors ?? 0)));
  const ackFailoverThreshold = Math.max(
    1,
    Math.round(Number(options?.ackFailoverThreshold ?? resolveWelcomeAckFailoverThreshold())),
  );

  if (primaryAckErrors >= ackFailoverThreshold) {
    if (phoneHints.length <= 1) return [];
    console.warn(
      `[whatsapp] ${logLabel}: ${primaryAckErrors} ACK ERROR no eleito ${phoneHints[0]} — failover para ${phoneHints.slice(1).join(" → ")}.`,
    );
    return resolveEvoSendSlots(phoneHints.slice(1), {
      allowAnyOpenFallback: false,
      verifyLiveIfCatalogClosed: true,
      logLabel,
    });
  }

  const primaryHint = phoneHints[0];
  const primaryInstance = await resolveConnectedEvoInstanceByPhoneHint(primaryHint, {
    verifyLiveIfCatalogClosed: true,
  });

  if (primaryInstance) {
    const liveState = await fetchEvoInstanceLiveState(primaryInstance, { fresh: true });
    if (!shouldSkipInstanceForSend(liveState)) {
      return [{ phoneHint: primaryHint, instanceName: primaryInstance }];
    }
    console.warn(
      `[whatsapp] ${logLabel}: número eleito ${primaryHint} (${primaryInstance}) desconectado (connectionState=${liveState || "?"}). Próximo da fila: ${phoneHints.slice(1).join(" → ") || "—"}.`,
    );
  } else {
    console.warn(
      `[whatsapp] ${logLabel}: número eleito ${primaryHint} indisponível. Próximo da fila: ${phoneHints.slice(1).join(" → ") || "—"}.`,
    );
  }

  if (phoneHints.length <= 1) return [];

  return resolveEvoSendSlots(phoneHints.slice(1), {
    allowAnyOpenFallback: false,
    verifyLiveIfCatalogClosed: true,
    logLabel,
  });
};

const logCriticalLifecycleBypass = async (instanceName: string, logLabel: string): Promise<void> => {
  try {
    const life = await getAquecedorLifecycleStatusForInstance(instanceName);
    if (!life) return;
    if (life.phase === "preparing" || life.phase === "restricted_wait") {
      console.info(
        `[whatsapp] ${logLabel}: enviando via ${instanceName} apesar de aquecedor «${life.statusLabel || life.phase}» (boas-vindas/crítico ignora lifecycle).`,
      );
    }
  } catch {
    /* ignore — lifecycle não pode bloquear envio crítico */
  }
};

type TrySendViaSlotOutcome = {
  result: WabaWhatsAppDeliveryResult | null;
  /** ACK ERROR no número eleito (conta para failover de boas-vindas). */
  primaryAckError?: boolean;
};

const trySendViaSlot = async (input: {
  slot: EvoSendSlot;
  targetWhatsapp: string;
  text: string;
  recipientLabel: string;
  timeoutMs: number;
  logLabel?: string;
  ignoreAquecedorLifecycle?: boolean;
  /** Boas-vindas ainda no eleito: ACK ERROR repete no mesmo número até o limiar. */
  welcomeRetryPrimaryOnly?: boolean;
  primaryPhoneHint?: string;
}): Promise<TrySendViaSlotOutcome> => {
  const { slot, targetWhatsapp, text, recipientLabel, timeoutMs } = input;
  const liveState = await fetchEvoInstanceLiveState(slot.instanceName, { fresh: true });
  if (shouldSkipInstanceForSend(liveState)) {
    console.warn(
      `[whatsapp] ${slot.instanceName} (${slot.phoneHint}) ignorada — connectionState=${liveState || "?"}.`,
    );
    return { result: null };
  }

  if (input.ignoreAquecedorLifecycle) {
    await logCriticalLifecycleBypass(slot.instanceName, input.logLabel || "whatsapp");
  }

  const result = await sendEvoTextAlert({
    instanceName: slot.instanceName,
    targetNumber: targetWhatsapp,
    text,
    timeoutMs,
    retries: 2,
  });

  if (!result.ok) {
    const detail = String(result.detail || "Falha no envio via Evolution.").slice(0, 300);
    console.warn(
      `[whatsapp] tentativa falhou (${slot.instanceName} / ${slot.phoneHint}) para ${targetWhatsapp} (${recipientLabel}):`,
      detail,
    );

    if (!isRecoverableSendFailure(detail, result.status)) {
      return {
        result: {
          status: "failed",
          message: `${slot.instanceName}: ${detail}`,
          instanceName: slot.instanceName,
        },
      };
    }

    return { result: null };
  }

  const ack = await waitForEvoOutboundDeliveryAck({
    instanceName: slot.instanceName,
    targetNumber: targetWhatsapp,
    messageId: result.messageId,
    remoteJid: result.remoteJid,
  });

  if (ack.outcome === "delivered") {
    console.log(
      `[whatsapp] entregue no aparelho para ${targetWhatsapp} (${recipientLabel}) via ${slot.instanceName} (${slot.phoneHint}) ack=${ack.status}.`,
    );
    return {
      result: { status: "sent", message: "WhatsApp enviado.", instanceName: slot.instanceName },
    };
  }

  const ackDetail = `${slot.instanceName}: WhatsApp não entregue (ack=${ack.status})`;
  const isPrimarySlot =
    Boolean(input.primaryPhoneHint) &&
    slot.phoneHint.replace(/\D/g, "") === String(input.primaryPhoneHint).replace(/\D/g, "");

  if (input.ignoreAquecedorLifecycle && input.welcomeRetryPrimaryOnly && ack.outcome === "error") {
    console.warn(
      `[whatsapp] sendText OK mas ACK erro (${slot.instanceName} / ${slot.phoneHint}) para ${targetWhatsapp} (${recipientLabel}): ack=${ack.status}. Boas-vindas repete no eleito (failover após ${resolveWelcomeAckFailoverThreshold()} ACK ERROR).`,
    );
    return { result: null, primaryAckError: isPrimarySlot };
  }

  if (input.ignoreAquecedorLifecycle && input.welcomeRetryPrimaryOnly) {
    console.warn(
      `[whatsapp] sendText OK mas ACK pendente (${slot.instanceName} / ${slot.phoneHint}) para ${targetWhatsapp} (${recipientLabel}): ack=${ack.status}. Boas-vindas repete no eleito.`,
    );
    return { result: null };
  }

  console.warn(
    `[whatsapp] sendText OK mas não entregue (${slot.instanceName} / ${slot.phoneHint}) para ${targetWhatsapp} (${recipientLabel}): ack=${ack.status}. Tentando próxima instância.`,
  );
  return {
    result: {
      status: "failed",
      message: ackDetail,
      instanceName: slot.instanceName,
    },
  };
};

export type WabaEvolutionWhatsAppDeliveryInput = {
  targetWhatsapp: string;
  recipientEmail?: string;
  text: string;
  logLabel: string;
  backgroundRetryKey?: string;
  /**
   * Envios críticos (ex.: boas-vindas): ignora Preparando / pausa humana no número eleito.
   * Failover para secundário/terciário se eleito desconectado ou após N ACK ERROR (padrão 3).
   */
  ignoreAquecedorLifecycle?: boolean;
};

type BackgroundRetryState = {
  timer: ReturnType<typeof setTimeout>;
  attempts: number;
  primaryAckErrors: number;
  welcomeFailoverActive: boolean;
};

const backgroundRetries = new Map<string, BackgroundRetryState>();

const runWabaEvolutionWhatsAppDelivery = async (
  input: WabaEvolutionWhatsAppDeliveryInput,
  options: { maxRounds: number; initialPrimaryAckErrors?: number; welcomeFailoverActive?: boolean },
): Promise<WabaWhatsAppDeliveryResult & { primaryAckErrors?: number; welcomeFailoverActive?: boolean }> => {
  const whatsapp = String(input.targetWhatsapp || "").replace(/\D/g, "");
  const recipientLabel = String(input.recipientEmail || input.logLabel || "destinatário")
    .trim()
    .toLowerCase();
  const logLabel = String(input.logLabel || "whatsapp").trim();

  if (!whatsapp || whatsapp.length < 10) {
    return {
      status: "skipped",
      message: `${logLabel} WhatsApp ${recipientLabel}: número inválido.`,
    };
  }

  const text = String(input.text || "").trim();
  if (!text) {
    return { status: "skipped", message: `${logLabel}: mensagem vazia.` };
  }

  const phoneHintsAll = resolveWabaWhatsAppPhoneHints();
  const ignoreAquecedorLifecycle = Boolean(input.ignoreAquecedorLifecycle);
  const phoneHints = phoneHintsAll;
  const maxRounds = Math.max(1, options.maxRounds);
  const roundDelayMs = resolveWabaWhatsAppRoundDelayMs();
  const timeoutMs = resolveWabaWhatsAppSendTimeoutMs();
  const errors: string[] = [];
  const ackFailoverThreshold = resolveWelcomeAckFailoverThreshold();
  let primaryAckErrors = Math.max(0, Math.round(Number(options.initialPrimaryAckErrors ?? 0)));
  let welcomeFailoverActive = Boolean(options.welcomeFailoverActive);

  for (let round = 1; round <= maxRounds; round += 1) {
    if (
      ignoreAquecedorLifecycle &&
      !welcomeFailoverActive &&
      primaryAckErrors >= ackFailoverThreshold
    ) {
      welcomeFailoverActive = true;
    }

    const slots = ignoreAquecedorLifecycle
      ? await resolveWelcomeEvoSendSlots(phoneHintsAll, logLabel, {
          primaryAckErrors: welcomeFailoverActive ? ackFailoverThreshold : primaryAckErrors,
          ackFailoverThreshold,
        })
      : await resolveEvoSendSlots(phoneHints, {
          allowAnyOpenFallback: false,
          verifyLiveIfCatalogClosed: false,
          logLabel,
        });
    if (!slots.length) {
      const msg = `rodada ${round}/${maxRounds}: nenhuma instância conectada (${phoneHints.join(" → ")}).`;
      errors.push(msg);
      console.warn(`[whatsapp] ${logLabel}: ${msg}`);
      if (round < maxRounds) await sleep(roundDelayMs);
      continue;
    }

    if (round === 1) {
      const welcomeNote = ignoreAquecedorLifecycle
        ? welcomeFailoverActive || primaryAckErrors >= ackFailoverThreshold
          ? ` (failover ACK ERROR após ${ackFailoverThreshold} tentativa(s) no eleito)`
          : slots.length === 1 && slots[0]?.phoneHint === phoneHintsAll[0]
            ? " (número eleito conectado; ignora pausa humana/Preparando)"
            : " (failover: número eleito desconectado)"
        : "";
      console.info(
        `[whatsapp] ${logLabel}: sequência ${slots.map((s) => `${s.phoneHint}→${s.instanceName}`).join(", ")}${welcomeNote}.`,
      );
    } else {
      console.info(`[whatsapp] ${logLabel}: repetindo sequência (rodada ${round}/${maxRounds}).`);
    }

    const welcomeRetryPrimaryOnly =
      ignoreAquecedorLifecycle && !welcomeFailoverActive && primaryAckErrors < ackFailoverThreshold;
    const primaryPhoneHint = phoneHintsAll[0] || "";

    for (const slot of slots) {
      const sendOutcome = await trySendViaSlot({
        slot,
        targetWhatsapp: whatsapp,
        text,
        recipientLabel,
        timeoutMs,
        logLabel,
        ignoreAquecedorLifecycle,
        welcomeRetryPrimaryOnly,
        primaryPhoneHint,
      });
      if (sendOutcome.primaryAckError) {
        primaryAckErrors += 1;
        if (primaryAckErrors >= ackFailoverThreshold) {
          welcomeFailoverActive = true;
          break;
        }
      }
      const outcome = sendOutcome.result;
      if (outcome?.status === "sent") {
        return {
          ...outcome,
          primaryAckErrors,
          welcomeFailoverActive,
        };
      }
      if (outcome?.status === "failed") errors.push(outcome.message);
    }

    if (round < maxRounds) await sleep(roundDelayMs);
  }

  const message =
    errors.filter(Boolean).join(" | ") ||
    `${logLabel} WhatsApp ${recipientLabel}: falha após ${maxRounds} rodada(s) na sequência ${phoneHints.join(" → ")}.`;
  console.error(`[whatsapp] ${logLabel} falhou para ${whatsapp} (${recipientLabel}):`, message);
  return {
    status: "failed",
    message,
    primaryAckErrors,
    welcomeFailoverActive,
  };
};

const resolveBackgroundRetryMaxAttempts = (): number => {
  const raw = Number(process.env.WABA_WHATSAPP_BACKGROUND_RETRY_MAX ?? 12);
  if (Number.isFinite(raw) && raw >= 1) return Math.min(40, Math.round(raw));
  return 12;
};

const scheduleBackgroundRetry = (input: WabaEvolutionWhatsAppDeliveryInput): void => {
  const key = String(input.backgroundRetryKey || "").trim();
  if (!key || backgroundRetries.has(key)) return;

  const roundDelayMs = resolveWabaWhatsAppRoundDelayMs();
  const maxAttempts = resolveBackgroundRetryMaxAttempts();
  let attempts = 0;

  const tick = async (): Promise<void> => {
    const pending = backgroundRetries.get(key);
    if (!pending) return;

    attempts += 1;
    console.info(`[whatsapp] ${input.logLabel}: retry em background #${attempts} (${key}).`);

    const result = await runWabaEvolutionWhatsAppDelivery(input, {
      maxRounds: 1,
      initialPrimaryAckErrors: pending.primaryAckErrors,
      welcomeFailoverActive: pending.welcomeFailoverActive,
    });
    if (result.status === "sent") {
      clearTimeout(pending.timer);
      backgroundRetries.delete(key);
      console.log(`[whatsapp] ${input.logLabel}: retry em background OK (${key}).`);
      return;
    }

    pending.primaryAckErrors = Math.max(
      pending.primaryAckErrors,
      Math.round(Number(result.primaryAckErrors ?? pending.primaryAckErrors)),
    );
    pending.welcomeFailoverActive =
      pending.welcomeFailoverActive || Boolean(result.welcomeFailoverActive);

    if (attempts >= maxAttempts) {
      clearTimeout(pending.timer);
      backgroundRetries.delete(key);
      console.error(
        `[whatsapp] ${input.logLabel}: retry em background esgotado após ${attempts} tentativa(s) (${key}).`,
      );
      return;
    }

    const nextTimer = setTimeout(() => {
      void tick();
    }, roundDelayMs);
    backgroundRetries.set(key, {
      timer: nextTimer,
      attempts,
      primaryAckErrors: pending.primaryAckErrors,
      welcomeFailoverActive: pending.welcomeFailoverActive,
    });
  };

  const initialTimer = setTimeout(() => {
    void tick();
  }, roundDelayMs);
  backgroundRetries.set(key, {
    timer: initialTimer,
    attempts: 0,
    primaryAckErrors: 0,
    welcomeFailoverActive: false,
  });
  console.warn(`[whatsapp] ${input.logLabel}: retry em background até sucesso (${key}).`);
};

export const deliverWabaEvolutionWhatsApp = async (
  input: WabaEvolutionWhatsAppDeliveryInput,
): Promise<WabaWhatsAppDeliveryResult> => {
  const maxRounds = resolveWabaWhatsAppMaxRounds();
  const result = await runWabaEvolutionWhatsAppDelivery(input, { maxRounds });
  if (result.status !== "sent" && input.backgroundRetryKey) {
    scheduleBackgroundRetry(input);
  }
  return result;
};
