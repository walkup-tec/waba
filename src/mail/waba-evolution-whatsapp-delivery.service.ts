import { defaultEvoSendTextTimeoutMs } from "../evo-http.client";
import { evoHttpRequestWithBaseFailover, resolvePrimaryEvoApiBase } from "../evo-api-config";
import {
  fetchEvoInstanceLiveState,
  isEvoLiveStateOpen,
} from "../instances/evo-connection-state.service";
import { expandBrazilWhatsAppNumberVariants } from "../instances/evo-instance-phone.service";
import { sendEvoTextAlert } from "../monitoring/evo-text-alert.client";
import {
  resolveConnectedEvoInstanceByPhoneHint,
  resolveConnectedEvoOutboundInstance,
} from "../push/waba-push-community.service";
import { getAquecedorLifecycleStatusForInstance } from "../services/aquecedor-instance-lifecycle.service";
import { waitForEvoOutboundDeliveryAck } from "./waba-evolution-delivery-ack";
import {
  pickCanonicalWhatsAppNumberFromExistsCheck,
  welcomeDestinationCandidates,
  type EvoWhatsAppExistsItem,
} from "./waba-whatsapp-exists-number";
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

const resolveWelcomeFirstPassRounds = (): number => {
  const raw = Number(process.env.WABA_WELCOME_FIRST_PASS_ROUNDS ?? 5);
  if (Number.isFinite(raw) && raw >= 1) return Math.min(15, Math.round(raw));
  return 5;
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

const resolveWelcomeBackgroundDelayMs = (): number => {
  const raw = Number(process.env.WABA_WELCOME_BACKGROUND_RETRY_MS ?? 8000);
  if (Number.isFinite(raw) && raw >= 2000) return Math.round(raw);
  return 8000;
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

const resolveEvoApiKey = (): string =>
  String(process.env.EVO_API_KEY || "429683C4C977415CAAFCCE10F7D57E11").trim();

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

const isRecoverableSendFailure = (detail: string, status: number): boolean => {
  const text = String(detail || "").toLowerCase();
  if (status === 404 || status === 400) return true;
  if (status === 0) return true;
  if (status >= 500) return true;
  if (text.includes("not found") || text.includes("does not exist")) return true;
  if (text.includes("exists") && text.includes("false")) return true;
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
 * Boas-vindas: fila completa na ordem, sem trancar no eleito.
 * Ausente/desconectado → próximo. Se a fila inteira falhar → qualquer EVO open.
 */
const resolveWelcomeEvoSendSlots = async (
  phoneHints: string[],
  logLabel: string,
): Promise<EvoSendSlot[]> => {
  return resolveEvoSendSlots(phoneHints, {
    allowAnyOpenFallback: true,
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

const resolveCanonicalDestinationNumber = async (
  instanceName: string,
  rawNumber: string,
): Promise<string> => {
  const variants = expandBrazilWhatsAppNumberVariants(rawNumber);
  if (!variants.length) return "";
  const url = `${resolvePrimaryEvoApiBase()}/chat/whatsappNumbers/${encodeURIComponent(instanceName)}`;
  try {
    const result = await evoHttpRequestWithBaseFailover(url, "POST", {
      apiKey: resolveEvoApiKey(),
      body: { numbers: variants },
      timeoutMs: 12_000,
      retries: 1,
    });
    const items = Array.isArray(result.json) ? (result.json as EvoWhatsAppExistsItem[]) : [];
    return pickCanonicalWhatsAppNumberFromExistsCheck(items);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[whatsapp] whatsappNumbers falhou em ${instanceName}:`,
      message.slice(0, 180),
    );
    return "";
  }
};

type TrySendViaSlotOutcome = {
  result: WabaWhatsAppDeliveryResult | null;
};

const trySendViaSlot = async (input: {
  slot: EvoSendSlot;
  targetWhatsapp: string;
  text: string;
  recipientLabel: string;
  timeoutMs: number;
  logLabel?: string;
  ignoreAquecedorLifecycle?: boolean;
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

  const canonical = input.ignoreAquecedorLifecycle
    ? await resolveCanonicalDestinationNumber(slot.instanceName, targetWhatsapp)
    : "";
  const destinations = input.ignoreAquecedorLifecycle
    ? welcomeDestinationCandidates(targetWhatsapp, canonical).slice(0, 2)
    : [targetWhatsapp];

  for (const destination of destinations) {
    const result = await sendEvoTextAlert({
      instanceName: slot.instanceName,
      targetNumber: destination,
      text,
      timeoutMs,
      retries: 2,
    });

    if (!result.ok) {
      const detail = String(result.detail || "Falha no envio via Evolution.").slice(0, 300);
      console.warn(
        `[whatsapp] tentativa falhou (${slot.instanceName} / ${slot.phoneHint}) para ${destination} (${recipientLabel}):`,
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
      continue;
    }

    const ack = await waitForEvoOutboundDeliveryAck({
      instanceName: slot.instanceName,
      targetNumber: destination,
      messageId: result.messageId,
      remoteJid: result.remoteJid,
    });

    if (ack.outcome === "delivered") {
      console.log(
        `[whatsapp] entregue no aparelho para ${destination} (${recipientLabel}) via ${slot.instanceName} (${slot.phoneHint}) ack=${ack.status}.`,
      );
      return {
        result: { status: "sent", message: "WhatsApp enviado.", instanceName: slot.instanceName },
      };
    }

    console.warn(
      `[whatsapp] sendText OK mas não entregue (${slot.instanceName} / ${slot.phoneHint}) para ${destination} (${recipientLabel}): ack=${ack.status}. Tentando próximo da fila.`,
    );
  }

  return { result: null };
};

export type WabaEvolutionWhatsAppDeliveryInput = {
  targetWhatsapp: string;
  recipientEmail?: string;
  text: string;
  logLabel: string;
  backgroundRetryKey?: string;
  /**
   * Envios críticos (ex.: boas-vindas): ignora Preparando / pausa humana.
   * Percorre a fila inteira e, se preciso, qualquer instância open.
   */
  ignoreAquecedorLifecycle?: boolean;
};

type BackgroundRetryState = {
  timer: ReturnType<typeof setTimeout>;
  attempts: number;
};

const backgroundRetries = new Map<string, BackgroundRetryState>();

const runWabaEvolutionWhatsAppDelivery = async (
  input: WabaEvolutionWhatsAppDeliveryInput,
  options: { maxRounds: number },
): Promise<WabaWhatsAppDeliveryResult> => {
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

  const phoneHints = resolveWabaWhatsAppPhoneHints();
  const ignoreAquecedorLifecycle = Boolean(input.ignoreAquecedorLifecycle);
  const maxRounds = Math.max(1, options.maxRounds);
  const roundDelayMs = ignoreAquecedorLifecycle
    ? resolveWelcomeBackgroundDelayMs()
    : resolveWabaWhatsAppRoundDelayMs();
  const timeoutMs = resolveWabaWhatsAppSendTimeoutMs();
  const errors: string[] = [];

  for (let round = 1; round <= maxRounds; round += 1) {
    const slots = ignoreAquecedorLifecycle
      ? await resolveWelcomeEvoSendSlots(phoneHints, logLabel)
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
      console.info(
        `[whatsapp] ${logLabel}: sequência ${slots.map((s) => `${s.phoneHint}→${s.instanceName}`).join(", ")}.`,
      );
    } else {
      console.info(`[whatsapp] ${logLabel}: repetindo sequência (rodada ${round}/${maxRounds}).`);
    }

    for (const slot of slots) {
      const sendOutcome = await trySendViaSlot({
        slot,
        targetWhatsapp: whatsapp,
        text,
        recipientLabel,
        timeoutMs,
        logLabel,
        ignoreAquecedorLifecycle,
      });
      const outcome = sendOutcome.result;
      if (outcome?.status === "sent") return outcome;
      if (outcome?.status === "failed") errors.push(outcome.message);
    }

    if (round < maxRounds) await sleep(roundDelayMs);
  }

  const message =
    errors.filter(Boolean).join(" | ") ||
    `${logLabel} WhatsApp ${recipientLabel}: falha após ${maxRounds} rodada(s) na sequência ${phoneHints.join(" → ")}.`;
  console.error(`[whatsapp] ${logLabel} falhou para ${whatsapp} (${recipientLabel}):`, message);
  return { status: "failed", message };
};

const resolveBackgroundRetryMaxAttempts = (critical: boolean): number => {
  if (critical) {
    const raw = Number(process.env.WABA_WELCOME_BACKGROUND_RETRY_MAX ?? 40);
    if (Number.isFinite(raw) && raw >= 1) return Math.min(80, Math.round(raw));
    return 40;
  }
  const raw = Number(process.env.WABA_WHATSAPP_BACKGROUND_RETRY_MAX ?? 12);
  if (Number.isFinite(raw) && raw >= 1) return Math.min(40, Math.round(raw));
  return 12;
};

const scheduleBackgroundRetry = (input: WabaEvolutionWhatsAppDeliveryInput): void => {
  const key = String(input.backgroundRetryKey || "").trim();
  if (!key || backgroundRetries.has(key)) return;

  const critical = Boolean(input.ignoreAquecedorLifecycle);
  const roundDelayMs = critical ? resolveWelcomeBackgroundDelayMs() : resolveWabaWhatsAppRoundDelayMs();
  const maxAttempts = resolveBackgroundRetryMaxAttempts(critical);
  let attempts = 0;

  const tick = async (): Promise<void> => {
    const pending = backgroundRetries.get(key);
    if (!pending) return;

    attempts += 1;
    console.info(`[whatsapp] ${input.logLabel}: retry em background #${attempts} (${key}).`);

    const result = await runWabaEvolutionWhatsAppDelivery(input, { maxRounds: 1 });
    if (result.status === "sent") {
      clearTimeout(pending.timer);
      backgroundRetries.delete(key);
      console.log(`[whatsapp] ${input.logLabel}: retry em background OK (${key}).`);
      return;
    }

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
    backgroundRetries.set(key, { timer: nextTimer, attempts });
  };

  const initialTimer = setTimeout(() => {
    void tick();
  }, roundDelayMs);
  backgroundRetries.set(key, { timer: initialTimer, attempts: 0 });
  console.warn(`[whatsapp] ${input.logLabel}: retry em background até sucesso (${key}).`);
};

export const deliverWabaEvolutionWhatsApp = async (
  input: WabaEvolutionWhatsAppDeliveryInput,
): Promise<WabaWhatsAppDeliveryResult> => {
  const maxRounds = input.ignoreAquecedorLifecycle
    ? resolveWelcomeFirstPassRounds()
    : resolveWabaWhatsAppMaxRounds();
  const result = await runWabaEvolutionWhatsAppDelivery(input, { maxRounds });
  if (result.status !== "sent" && input.backgroundRetryKey) {
    scheduleBackgroundRetry(input);
  }
  return result;
};
