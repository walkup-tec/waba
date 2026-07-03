import { defaultEvoSendTextTimeoutMs } from "../evo-http.client";
import { sendEvoTextAlert } from "../monitoring/evo-text-alert.client";
import {
  resolveConnectedEvoInstanceByPhoneHint,
  resolveConnectedEvoOutboundInstance,
} from "../push/waba-push-community.service";
import { WabaPushRepository } from "../push/waba-push.repository";
import {
  resolveDefaultPushCommunityEvoInstance,
  resolvePushCommunityEvoInstanceFallbacks,
} from "../push/waba-push.types";
import {
  buildOperacionalNewCampaignWhatsAppText,
  type OperacionalNewCampaignTemplateInput,
} from "./waba-mail.templates";
import type { WabaWhatsAppDeliveryResult } from "./waba-welcome-whatsapp.service";

const DEFAULT_OPERACIONAL_PRIMARY_PHONE = "51981077770";
const DEFAULT_OPERACIONAL_FALLBACK_PHONE = "5197462102";

const resolveOperacionalPrimaryPhoneHint = (): string =>
  String(
    process.env.WABA_OPERACIONAL_NOTIFY_WHATSAPP_PRIMARY_PHONE || DEFAULT_OPERACIONAL_PRIMARY_PHONE,
  ).trim();

const resolveOperacionalFallbackPhoneHint = (): string =>
  String(
    process.env.WABA_OPERACIONAL_NOTIFY_WHATSAPP_FALLBACK_PHONE || DEFAULT_OPERACIONAL_FALLBACK_PHONE,
  ).trim();

const uniqueInstanceNames = (names: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const trimmed = String(name || "").trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
};

const resolveOperacionalWhatsAppPreferredInstance = (): string => {
  const fromEnv = String(process.env.WABA_OPERACIONAL_NOTIFY_WHATSAPP_EVO_INSTANCE || "").trim();
  if (fromEnv) return fromEnv;
  const pushConfig = new WabaPushRepository().readConfig();
  const fromPush = String(pushConfig.communityEvoInstance || "").trim();
  if (fromPush) return fromPush;
  return resolveDefaultPushCommunityEvoInstance();
};

const isRecoverableSendFailure = (detail: string, status: number): boolean => {
  const text = String(detail || "").toLowerCase();
  if (status === 404) return true;
  if (text.includes("not found") || text.includes("does not exist")) return true;
  if (text.includes("instance") && text.includes("exist")) return true;
  if (text.includes("disconnected") || text.includes("not connected")) return true;
  if (text.includes("integrationsession") || text.includes("internal server error")) return true;
  return false;
};

const buildOperacionalSendCandidates = async (): Promise<string[]> => {
  const primaryPhone = resolveOperacionalPrimaryPhoneHint();
  const fallbackPhone = resolveOperacionalFallbackPhoneHint();

  const primaryByPhone = await resolveConnectedEvoInstanceByPhoneHint(primaryPhone);
  if (primaryByPhone) {
    console.info(
      `[whatsapp] operacional campanha: instância primária ${primaryByPhone} (${primaryPhone}) conectada.`,
    );
    return [primaryByPhone];
  }

  const fallbackByPhone = await resolveConnectedEvoInstanceByPhoneHint(fallbackPhone);
  if (fallbackByPhone) {
    console.info(
      `[whatsapp] operacional campanha: primária ${primaryPhone} indisponível; usando ${fallbackByPhone} (${fallbackPhone}).`,
    );
    return [fallbackByPhone];
  }

  console.warn(
    `[whatsapp] operacional campanha: instâncias ${primaryPhone} e ${fallbackPhone} indisponíveis; tentando resolução legada.`,
  );

  const preferred = resolveOperacionalWhatsAppPreferredInstance();
  const candidates = uniqueInstanceNames([
    preferred,
    ...resolvePushCommunityEvoInstanceFallbacks(),
    resolveDefaultPushCommunityEvoInstance(),
  ]);

  const resolved: string[] = [];
  for (const candidate of candidates) {
    try {
      const connected = await resolveConnectedEvoOutboundInstance(candidate);
      if (connected) resolved.push(connected);
    } catch {
      resolved.push(candidate);
    }
  }

  return uniqueInstanceNames(resolved);
};

export type OperacionalCampaignWhatsAppInput = OperacionalNewCampaignTemplateInput & {
  whatsapp: string;
};

export const deliverOperacionalNewCampaignWhatsApp = async (
  input: OperacionalCampaignWhatsAppInput,
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
  const candidates = await buildOperacionalSendCandidates();
  if (!candidates.length) {
    return {
      status: "skipped",
      message: `operacional campanha WhatsApp ${operacionalEmail}: nenhuma instância Evolution disponível.`,
    };
  }

  const errors: string[] = [];
  const timeoutMs = defaultEvoSendTextTimeoutMs();

  for (const instanceName of candidates) {
    const result = await sendEvoTextAlert({
      instanceName,
      targetNumber: whatsapp,
      text,
      timeoutMs,
    });

    if (result.ok) {
      console.log(
        `[whatsapp] operacional campanha enviada para ${whatsapp} (${operacionalEmail}) via ${instanceName}.`,
      );
      return { status: "sent", message: "WhatsApp enviado.", instanceName };
    }

    const detail = String(result.detail || "Falha no envio via Evolution.").slice(0, 300);
    errors.push(`${instanceName}: ${detail}`);
    console.warn(
      `[whatsapp] operacional campanha tentativa falhou (${instanceName}) para ${whatsapp} (${operacionalEmail}):`,
      detail,
    );
    if (!isRecoverableSendFailure(detail, result.status)) break;
  }

  const message =
    errors.join(" | ") || `operacional campanha WhatsApp ${operacionalEmail}: falha desconhecida.`;
  console.error(
    `[whatsapp] operacional campanha falhou para ${whatsapp} (${operacionalEmail}):`,
    message,
  );
  return { status: "failed", message };
};
