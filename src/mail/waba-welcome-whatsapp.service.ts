import { defaultEvoSendTextTimeoutMs } from "../evo-http.client";
import { sendEvoTextAlert } from "../monitoring/evo-text-alert.client";
import { resolveConnectedEvoOutboundInstance } from "../push/waba-push-community.service";
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

export type WabaWhatsAppDeliveryStatus = "sent" | "skipped" | "failed";

export type WabaWhatsAppDeliveryResult = {
  status: WabaWhatsAppDeliveryStatus;
  message: string;
  instanceName?: string;
};

const DEFAULT_COMMUNITY_LINK = "https://chat.whatsapp.com/EoP6r6BIZt83GenpCgvUJ7";

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
  if (text.includes("not found") || text.includes("does not exist")) return true;
  if (text.includes("instance") && text.includes("exist")) return true;
  if (text.includes("disconnected") || text.includes("not connected")) return true;
  if (text.includes("integrationsession") || text.includes("internal server error")) return true;
  return false;
};

const buildWelcomeSendCandidates = async (): Promise<string[]> => {
  const preferred = resolveWelcomeWhatsAppPreferredInstance();
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

export const buildSubscriberWelcomeWhatsAppText = (input: SubscriberWelcomeWhatsAppInput): string => {
  const email = String(input.email || "").trim().toLowerCase();
  const password = String(input.password ?? "");
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
    `🔑 Senha: ${password}`,
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

export const deliverSubscriberWelcomeWhatsApp = async (
  input: SubscriberWelcomeWhatsAppInput,
): Promise<WabaWhatsAppDeliveryResult> => {
  const whatsapp = String(input.whatsapp || "").replace(/\D/g, "");
  const email = String(input.email || "").trim().toLowerCase();

  if (!whatsapp || whatsapp.length < 10) {
    return {
      status: "skipped",
      message: `boas-vindas WhatsApp ${email}: número do assinante inválido.`,
    };
  }

  const text = buildSubscriberWelcomeWhatsAppText(input);
  const candidates = await buildWelcomeSendCandidates();
  if (!candidates.length) {
    return {
      status: "skipped",
      message: `boas-vindas WhatsApp ${email}: nenhuma instância Evolution disponível.`,
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
        `[whatsapp] boas-vindas enviada para ${whatsapp} (${email}) via ${instanceName}.`,
      );
      return { status: "sent", message: "WhatsApp enviado.", instanceName };
    }

    const detail = String(result.detail || "Falha no envio via Evolution.").slice(0, 300);
    errors.push(`${instanceName}: ${detail}`);
    console.warn(
      `[whatsapp] boas-vindas tentativa falhou (${instanceName}) para ${whatsapp} (${email}):`,
      detail,
    );
    if (!isRecoverableSendFailure(detail, result.status)) break;
  }

  const message = errors.join(" | ") || `boas-vindas WhatsApp ${email}: falha desconhecida.`;
  console.error(`[whatsapp] boas-vindas falhou para ${whatsapp} (${email}):`, message);
  return { status: "failed", message };
};

export const notifySubscriberWelcomeWhatsApp = (input: SubscriberWelcomeWhatsAppInput): void => {
  void deliverSubscriberWelcomeWhatsApp(input).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[whatsapp] boas-vindas cadastro (async):", message);
  });
};
