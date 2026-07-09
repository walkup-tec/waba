import { defaultEvoSendTextTimeoutMs } from "../evo-http.client";
import {
  fetchEvoInstanceLiveState,
  isEvoLiveStateOpen,
} from "../instances/evo-connection-state.service";
import { sendEvoTextAlert } from "../monitoring/evo-text-alert.client";
import { resolveConnectedEvoInstanceByPhoneHint } from "../push/waba-push-community.service";
import {
  buildOperacionalNewCampaignWhatsAppText,
  type OperacionalNewCampaignTemplateInput,
} from "./waba-mail.templates";
import type { WabaWhatsAppDeliveryResult } from "./waba-welcome-whatsapp.service";

/** Ordem fixa de instâncias por número (Evolution). */
const DEFAULT_OPERACIONAL_PHONE_HINTS = ["51981077770", "51997462102", "51981082477"] as const;

const DEFAULT_OPERACIONAL_PRIMARY_PHONE = DEFAULT_OPERACIONAL_PHONE_HINTS[0];
const DEFAULT_OPERACIONAL_SECONDARY_PHONE = DEFAULT_OPERACIONAL_PHONE_HINTS[1];
const DEFAULT_OPERACIONAL_TERTIARY_PHONE = DEFAULT_OPERACIONAL_PHONE_HINTS[2];

const resolveOperacionalPhoneHints = (): string[] => {
  const hints = [
    String(
      process.env.WABA_OPERACIONAL_NOTIFY_WHATSAPP_PRIMARY_PHONE ||
        DEFAULT_OPERACIONAL_PRIMARY_PHONE,
    ).trim(),
    String(
      process.env.WABA_OPERACIONAL_NOTIFY_WHATSAPP_FALLBACK_PHONE ||
        process.env.WABA_OPERACIONAL_NOTIFY_WHATSAPP_SECONDARY_PHONE ||
        DEFAULT_OPERACIONAL_SECONDARY_PHONE,
    ).trim(),
    String(
      process.env.WABA_OPERACIONAL_NOTIFY_WHATSAPP_TERTIARY_PHONE ||
        DEFAULT_OPERACIONAL_TERTIARY_PHONE,
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

const resolveOperacionalNotifyMaxRounds = (): number => {
  const raw = process.env.WABA_OPERACIONAL_NOTIFY_WHATSAPP_MAX_ROUNDS;
  if (raw !== undefined && String(raw).trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1) return Math.min(30, Math.round(n));
  }
  return 15;
};

const resolveOperacionalNotifyRoundDelayMs = (): number => {
  const raw = process.env.WABA_OPERACIONAL_NOTIFY_WHATSAPP_ROUND_DELAY_MS;
  if (raw !== undefined && String(raw).trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 500) return Math.round(n);
  }
  return 2500;
};

const resolveOperacionalSendTimeoutMs = (): number => {
  const raw = process.env.WABA_OPERACIONAL_NOTIFY_WHATSAPP_SEND_TIMEOUT_MS;
  if (raw !== undefined && String(raw).trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 12_000) return Math.round(n);
  }
  return defaultEvoSendTextTimeoutMs();
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

type OperacionalSendSlot = {
  phoneHint: string;
  instanceName: string;
};

const resolveOperacionalSendSlots = async (phoneHints: string[]): Promise<OperacionalSendSlot[]> => {
  const slots: OperacionalSendSlot[] = [];
  for (const phoneHint of phoneHints) {
    const instanceName = await resolveConnectedEvoInstanceByPhoneHint(phoneHint);
    if (!instanceName) {
      console.warn(
        `[whatsapp] operacional campanha: instância ${phoneHint} indisponível (desconectada ou não encontrada).`,
      );
      continue;
    }
    slots.push({ phoneHint, instanceName });
  }
  return slots;
};

const trySendViaSlot = async (input: {
  slot: OperacionalSendSlot;
  targetWhatsapp: string;
  text: string;
  operacionalEmail: string;
  timeoutMs: number;
}): Promise<WabaWhatsAppDeliveryResult | null> => {
  const { slot, targetWhatsapp, text, operacionalEmail, timeoutMs } = input;
  const liveState = await fetchEvoInstanceLiveState(slot.instanceName, { fresh: true });
  if (shouldSkipInstanceForSend(liveState)) {
    console.warn(
      `[whatsapp] operacional campanha: ${slot.instanceName} (${slot.phoneHint}) ignorada — connectionState=${liveState || "?"}.`,
    );
    return null;
  }

  const result = await sendEvoTextAlert({
    instanceName: slot.instanceName,
    targetNumber: targetWhatsapp,
    text,
    timeoutMs,
    retries: 2,
  });

  if (result.ok) {
    console.log(
      `[whatsapp] operacional campanha enviada para ${targetWhatsapp} (${operacionalEmail}) via ${slot.instanceName} (${slot.phoneHint}).`,
    );
    return { status: "sent", message: "WhatsApp enviado.", instanceName: slot.instanceName };
  }

  const detail = String(result.detail || "Falha no envio via Evolution.").slice(0, 300);
  console.warn(
    `[whatsapp] operacional campanha tentativa falhou (${slot.instanceName} / ${slot.phoneHint}) para ${targetWhatsapp} (${operacionalEmail}):`,
    detail,
  );

  if (!isRecoverableSendFailure(detail, result.status)) {
    return {
      status: "failed",
      message: `${slot.instanceName}: ${detail}`,
      instanceName: slot.instanceName,
    };
  }

  return null;
};

export type OperacionalCampaignWhatsAppInput = OperacionalNewCampaignTemplateInput & {
  whatsapp: string;
};

const buildOperacionalWhatsAppRetryKey = (input: OperacionalCampaignWhatsAppInput): string => {
  const campaignId = String(input.campaignId || "").trim();
  const email = String(input.recipientEmail || "").trim().toLowerCase();
  const whatsapp = String(input.whatsapp || "").replace(/\D/g, "");
  return `${campaignId}:${email}:${whatsapp}`;
};

const operacionalWhatsAppBackgroundRetries = new Map<
  string,
  { timer: ReturnType<typeof setTimeout>; attempts: number }
>();

const runOperacionalWhatsAppDelivery = async (
  input: OperacionalCampaignWhatsAppInput,
  options: { maxRounds: number },
): Promise<WabaWhatsAppDeliveryResult> => {
  const whatsapp = String(input.whatsapp || "").replace(/\D/g, "");
  const operacionalEmail = String(input.recipientEmail || "").trim().toLowerCase();

  if (!whatsapp || whatsapp.length < 10) {
    return {
      status: "skipped",
      message: `operacional campanha WhatsApp ${operacionalEmail}: número do operador inválido.`,
    };
  }

  const text = buildOperacionalNewCampaignWhatsAppText(input);
  const phoneHints = resolveOperacionalPhoneHints();
  const maxRounds = Math.max(1, options.maxRounds);
  const roundDelayMs = resolveOperacionalNotifyRoundDelayMs();
  const timeoutMs = resolveOperacionalSendTimeoutMs();
  const errors: string[] = [];

  for (let round = 1; round <= maxRounds; round += 1) {
    const slots = await resolveOperacionalSendSlots(phoneHints);
    if (!slots.length) {
      const msg = `rodada ${round}/${maxRounds}: nenhuma instância conectada (${phoneHints.join(" → ")}).`;
      errors.push(msg);
      console.warn(`[whatsapp] operacional campanha: ${msg}`);
      if (round < maxRounds) await sleep(roundDelayMs);
      continue;
    }

    if (round === 1) {
      console.info(
        `[whatsapp] operacional campanha: sequência ${slots.map((s) => `${s.phoneHint}→${s.instanceName}`).join(", ")}.`,
      );
    } else {
      console.info(
        `[whatsapp] operacional campanha: repetindo sequência (rodada ${round}/${maxRounds}).`,
      );
    }

    for (const slot of slots) {
      const outcome = await trySendViaSlot({
        slot,
        targetWhatsapp: whatsapp,
        text,
        operacionalEmail,
        timeoutMs,
      });
      if (outcome?.status === "sent") return outcome;
      if (outcome?.status === "failed") errors.push(outcome.message);
    }

    if (round < maxRounds) await sleep(roundDelayMs);
  }

  const message =
    errors.filter(Boolean).join(" | ") ||
    `operacional campanha WhatsApp ${operacionalEmail}: falha após ${maxRounds} rodada(s) na sequência ${phoneHints.join(" → ")}.`;
  console.error(
    `[whatsapp] operacional campanha falhou para ${whatsapp} (${operacionalEmail}):`,
    message,
  );
  return { status: "failed", message };
};

const scheduleOperacionalWhatsAppBackgroundRetry = (
  input: OperacionalCampaignWhatsAppInput,
): void => {
  const key = buildOperacionalWhatsAppRetryKey(input);
  if (operacionalWhatsAppBackgroundRetries.has(key)) return;

  const roundDelayMs = resolveOperacionalNotifyRoundDelayMs();
  let attempts = 0;

  const tick = async (): Promise<void> => {
    const pending = operacionalWhatsAppBackgroundRetries.get(key);
    if (!pending) return;

    attempts += 1;
    console.info(
      `[whatsapp] operacional campanha: retry em background #${attempts} (${input.campaignId} → ${input.recipientEmail}).`,
    );

    const result = await runOperacionalWhatsAppDelivery(input, { maxRounds: 1 });
    if (result.status === "sent") {
      clearTimeout(pending.timer);
      operacionalWhatsAppBackgroundRetries.delete(key);
      console.log(
        `[whatsapp] operacional campanha: retry em background concluído com sucesso (${input.campaignId}).`,
      );
      return;
    }

    const nextTimer = setTimeout(() => {
      void tick();
    }, roundDelayMs);
    operacionalWhatsAppBackgroundRetries.set(key, { timer: nextTimer, attempts });
  };

  const initialTimer = setTimeout(() => {
    void tick();
  }, roundDelayMs);
  operacionalWhatsAppBackgroundRetries.set(key, { timer: initialTimer, attempts: 0 });
  console.warn(
    `[whatsapp] operacional campanha: agendado retry em background até sucesso (${input.campaignId} → ${input.recipientEmail}).`,
  );
};

export const deliverOperacionalNewCampaignWhatsApp = async (
  input: OperacionalCampaignWhatsAppInput,
): Promise<WabaWhatsAppDeliveryResult> => {
  const maxRounds = resolveOperacionalNotifyMaxRounds();
  const result = await runOperacionalWhatsAppDelivery(input, { maxRounds });
  if (result.status !== "sent") {
    scheduleOperacionalWhatsAppBackgroundRetry(input);
  }
  return result;
};
