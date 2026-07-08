import { defaultEvoSendTextTimeoutMs } from "../evo-http.client";
import {
  fetchEvoInstanceLiveState,
  filterInstanceNamesTrulyOpen,
  isEvoConnectionInProgress,
  isEvoLiveStateOpen,
} from "../instances/evo-connection-state.service";
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
import { resolveWabaAppLoginUrl } from "./waba-app-url";

export type SubscriberWelcomeWhatsAppInput = {
  email: string;
  password: string;
  whatsapp: string;
  loginUrl?: string;
  communityLink?: string;
};

export type StaffWelcomeWhatsAppInput = {
  email: string;
  password: string;
  whatsapp: string;
  fullName: string;
  roleLabel: string;
  loginUrl?: string;
  operacionalDispatchesApiLabel?: string;
  operacionalSegmentLabel?: string;
};

export type WabaWhatsAppDeliveryStatus = "sent" | "skipped" | "failed";

export type WabaWhatsAppDeliveryResult = {
  status: WabaWhatsAppDeliveryStatus;
  message: string;
  instanceName?: string;
};

const DEFAULT_COMMUNITY_LINK = "https://chat.whatsapp.com/EoP6r6BIZt83GenpCgvUJ7";
const DEFAULT_WELCOME_PRIMARY_PHONE = "51981077770";
const DEFAULT_WELCOME_FALLBACK_PHONE = "5197462102";

const resolveWelcomePrimaryPhoneHint = (): string =>
  String(process.env.WABA_WELCOME_WHATSAPP_PRIMARY_PHONE || DEFAULT_WELCOME_PRIMARY_PHONE).trim();

const resolveWelcomeFallbackPhoneHint = (): string =>
  String(process.env.WABA_WELCOME_WHATSAPP_FALLBACK_PHONE || DEFAULT_WELCOME_FALLBACK_PHONE).trim();

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

const resolveWelcomeWhatsAppPreferredInstance = (): string => {
  const fromEnv = String(process.env.WABA_WELCOME_WHATSAPP_EVO_INSTANCE || "").trim();
  if (fromEnv) return fromEnv;
  const pushConfig = new WabaPushRepository().readConfig();
  const fromPush = String(pushConfig.communityEvoInstance || "").trim();
  if (fromPush) return fromPush;
  return resolveDefaultPushCommunityEvoInstance();
};

const resolveWelcomeCommunityLink = (): string => {
  const fromEnv = String(process.env.WABA_WELCOME_COMMUNITY_LINK || "").trim();
  if (fromEnv) return fromEnv;
  const fromPush = String(new WabaPushRepository().readConfig().communityInviteLink || "").trim();
  return fromPush || DEFAULT_COMMUNITY_LINK;
};

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

const resolveWelcomeSendTimeoutMs = (): number => {
  const raw = process.env.WABA_WELCOME_WHATSAPP_SEND_TIMEOUT_MS;
  if (raw !== undefined && String(raw).trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 12_000) return Math.round(n);
  }
  return defaultEvoSendTextTimeoutMs();
};

const shouldSkipWelcomeInstanceForSend = (liveState: string): boolean => {
  const state = String(liveState || "").trim().toLowerCase();
  if (!state) return false;
  if (isEvoLiveStateOpen(state)) return false;
  if (state === "close" || state === "closed" || state === "disconnected") return true;
  return isEvoConnectionInProgress(state);
};

const buildWelcomeSendCandidates = async (): Promise<string[]> => {
  const primaryPhone = resolveWelcomePrimaryPhoneHint();
  const fallbackPhone = resolveWelcomeFallbackPhoneHint();
  const preferred = resolveWelcomeWhatsAppPreferredInstance();

  const primaryByPhone = await resolveConnectedEvoInstanceByPhoneHint(primaryPhone);
  const fallbackByPhone = await resolveConnectedEvoInstanceByPhoneHint(fallbackPhone);

  if (primaryByPhone) {
    console.info(
      `[whatsapp] boas-vindas: instância primária ${primaryByPhone} (${primaryPhone}) conectada.`,
    );
  } else if (fallbackByPhone) {
    console.info(
      `[whatsapp] boas-vindas: primária ${primaryPhone} indisponível; fallback ${fallbackByPhone} (${fallbackPhone}).`,
    );
  } else {
    console.warn(
      `[whatsapp] boas-vindas: instâncias ${primaryPhone} e ${fallbackPhone} indisponíveis; tentando resolução legada.`,
    );
  }

  const legacyCandidates = uniqueInstanceNames([
    preferred,
    ...resolvePushCommunityEvoInstanceFallbacks(),
    resolveDefaultPushCommunityEvoInstance(),
  ]);

  const resolved: string[] = [];
  for (const candidate of legacyCandidates) {
    try {
      const connected = await resolveConnectedEvoOutboundInstance(candidate);
      if (connected) resolved.push(connected);
    } catch {
      resolved.push(candidate);
    }
  }

  const ordered = uniqueInstanceNames([
    ...(primaryByPhone ? [primaryByPhone] : []),
    preferred,
    ...resolved,
    ...(fallbackByPhone ? [fallbackByPhone] : []),
  ]);

  const trulyOpen = await filterInstanceNamesTrulyOpen(ordered);
  if (trulyOpen.length < ordered.length) {
    const skipped = ordered.filter((name) => !trulyOpen.includes(name));
    for (const name of skipped) {
      const live = await fetchEvoInstanceLiveState(name, { fresh: true });
      console.warn(
        `[whatsapp] boas-vindas: instância ${name} ignorada (connectionState=${live || "?"}, não está open).`,
      );
    }
  }

  if (trulyOpen.length) return trulyOpen;

  if (ordered.length) {
    console.warn(
      `[whatsapp] boas-vindas: connectionState indisponível para todas as candidatas; tentando envio com status do fetchInstances.`,
    );
    return ordered;
  }

  return trulyOpen;
};

export const buildSubscriberWelcomeWhatsAppText = (input: SubscriberWelcomeWhatsAppInput): string => {
  const email = String(input.email || "").trim().toLowerCase();
  const passwordPlain = String(input.password ?? "").trim();
  const passwordLine = passwordPlain
    ? `🔑 Senha: ${passwordPlain}`
    : "🔑 Senha: a definida no seu cadastro (use Esqueci a senha se necessário)";
  const loginUrl = String(input.loginUrl || resolveWabaAppLoginUrl()).trim() || resolveWabaAppLoginUrl();
  const communityLink = String(input.communityLink || resolveWelcomeCommunityLink()).trim();

  return [
    "🎉 Seja muito bem-vindo(a) à família DRAX!",
    "",
    "É uma satisfação ter você conosco. A partir de agora, você terá acesso à nossa plataforma e a uma equipe comprometida em oferecer a melhor experiência possível.",
    "",
    "🔐 Seus dados de acesso:",
    "",
    "━━━━━━━━━━━━━━━━━━",
    `📧 E-mail: ${email}`,
    passwordLine,
    `🌐 Sistema: ${loginUrl}`,
    "━━━━━━━━━━━━━━━━━━",
    "",
    "📢 Entre na nossa Comunidade Oficial no WhatsApp",
    "",
    "É por lá que compartilhamos:",
    "✅ Atualizações e novas funcionalidades;",
    "✅ Avisos importantes;",
    "✅ Melhorias da plataforma;",
    "✅ Comunicados oficiais da DRAX.",
    "",
    `👉 ${communityLink}`,
    "",
    "💚 Recomendamos que você entre na comunidade agora para ficar sempre por dentro das novidades.",
    "",
    "Mais uma vez, seja muito bem-vindo(a)! Temos certeza de que a DRAX será uma grande parceira no crescimento do seu negócio.",
    "",
    "Equipe DRAX Sistemas 🚀",
  ].join("\n");
};

export const buildStaffWelcomeWhatsAppText = (input: StaffWelcomeWhatsAppInput): string => {
  const email = String(input.email || "").trim().toLowerCase();
  const passwordPlain = String(input.password ?? "").trim();
  const passwordLine = passwordPlain
    ? `🔑 Senha: ${passwordPlain}`
    : "🔑 Senha: a definida no seu cadastro (use Esqueci a senha se necessário)";
  const loginUrl = String(input.loginUrl || resolveWabaAppLoginUrl()).trim() || resolveWabaAppLoginUrl();
  const roleLabel = String(input.roleLabel || "").trim() || "Equipe";
  const recipientName = String(input.fullName || "").trim();
  const operacionalApiLabel = String(input.operacionalDispatchesApiLabel || "").trim();
  const operacionalSegmentLabel = String(input.operacionalSegmentLabel || "").trim();
  const operacionalBlock =
    operacionalApiLabel || operacionalSegmentLabel
      ? [
          "",
          "📋 Atendimento:",
          operacionalApiLabel ? `• Disparos: ${operacionalApiLabel}` : "",
          operacionalSegmentLabel ? `• Segmento: ${operacionalSegmentLabel}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "";

  return [
    recipientName ? `Olá, ${recipientName}!` : "Olá!",
    "",
    `🎉 Bem-vindo(a) à equipe DRAX como usuário ${roleLabel}.`,
    "",
    "Seu acesso ao painel WABA já está liberado com os menus configurados para sua função.",
    "",
    "🔐 Seus dados de acesso:",
    "",
    "━━━━━━━━━━━━━━━━━━",
    `📧 E-mail: ${email}`,
    passwordLine,
    `🌐 Sistema: ${loginUrl}`,
    "━━━━━━━━━━━━━━━━━━",
    operacionalBlock,
    "",
    "Qualquer dúvida, fale com o administrador master da sua conta.",
    "",
    "Equipe DRAX Sistemas 🚀",
  ]
    .filter((line, index, arr) => !(line === "" && arr[index - 1] === ""))
    .join("\n");
};

const deliverWelcomeWhatsAppMessage = async (input: {
  email: string;
  whatsapp: string;
  text: string;
  logLabel: string;
}): Promise<WabaWhatsAppDeliveryResult> => {
  const whatsapp = String(input.whatsapp || "").replace(/\D/g, "");
  const email = String(input.email || "").trim().toLowerCase();
  const logLabel = String(input.logLabel || "boas-vindas").trim();

  if (!whatsapp || whatsapp.length < 10) {
    return {
      status: "skipped",
      message: `${logLabel} WhatsApp ${email}: número inválido.`,
    };
  }

  const candidates = await buildWelcomeSendCandidates();
  if (!candidates.length) {
    return {
      status: "skipped",
      message:
        `${logLabel} WhatsApp ${email}: nenhuma instância Evolution com connectionState=open (verifique QR/reconexão no sistema WABA - Drax).`,
    };
  }

  const errors: string[] = [];
  const timeoutMs = resolveWelcomeSendTimeoutMs();

  for (const instanceName of candidates) {
    const liveState = await fetchEvoInstanceLiveState(instanceName, { fresh: true });
    if (shouldSkipWelcomeInstanceForSend(liveState)) {
      errors.push(`${instanceName}: connectionState=${liveState || "?"}`);
      continue;
    }

    const result = await sendEvoTextAlert({
      instanceName,
      targetNumber: whatsapp,
      text: input.text,
      timeoutMs,
      retries: 2,
    });

    if (result.ok) {
      console.log(`[whatsapp] ${logLabel} enviada para ${whatsapp} (${email}) via ${instanceName}.`);
      return { status: "sent", message: "WhatsApp enviado.", instanceName };
    }

    const detail = String(result.detail || "Falha no envio via Evolution.").slice(0, 300);
    errors.push(`${instanceName}: ${detail}`);
    console.warn(
      `[whatsapp] ${logLabel} tentativa falhou (${instanceName}) para ${whatsapp} (${email}):`,
      detail,
    );
    if (!isRecoverableSendFailure(detail, result.status)) break;
  }

  const message = errors.join(" | ") || `${logLabel} WhatsApp ${email}: falha desconhecida.`;
  console.error(`[whatsapp] ${logLabel} falhou para ${whatsapp} (${email}):`, message);
  return { status: "failed", message };
};

export const deliverSubscriberWelcomeWhatsApp = async (
  input: SubscriberWelcomeWhatsAppInput,
): Promise<WabaWhatsAppDeliveryResult> => {
  const email = String(input.email || "").trim().toLowerCase();
  const text = buildSubscriberWelcomeWhatsAppText(input);
  return deliverWelcomeWhatsAppMessage({
    email,
    whatsapp: input.whatsapp,
    text,
    logLabel: "boas-vindas",
  });
};

export const deliverStaffWelcomeWhatsApp = async (
  input: StaffWelcomeWhatsAppInput,
): Promise<WabaWhatsAppDeliveryResult> => {
  const email = String(input.email || "").trim().toLowerCase();
  const text = buildStaffWelcomeWhatsAppText(input);
  return deliverWelcomeWhatsAppMessage({
    email,
    whatsapp: input.whatsapp,
    text,
    logLabel: "boas-vindas equipe",
  });
};

export const notifySubscriberWelcomeWhatsApp = (input: SubscriberWelcomeWhatsAppInput): void => {
  void deliverSubscriberWelcomeWhatsApp(input).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[whatsapp] boas-vindas cadastro (async):", message);
  });
};

export const notifyStaffWelcomeWhatsApp = (input: StaffWelcomeWhatsAppInput): void => {
  void deliverStaffWelcomeWhatsApp(input).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[whatsapp] boas-vindas equipe (async):", message);
  });
};
