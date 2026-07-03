import { sendEvoTextAlert } from "../monitoring/evo-text-alert.client";
import { WabaPushRepository } from "../push/waba-push.repository";
import { resolveDefaultPushCommunityEvoInstance } from "../push/waba-push.types";
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
};

const DEFAULT_COMMUNITY_LINK = "https://chat.whatsapp.com/EoP6r6BIZt83GenpCgvUJ7";

const resolveWelcomeWhatsAppEvoInstance = (): string => {
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

  const instanceName = resolveWelcomeWhatsAppEvoInstance();
  if (!instanceName) {
    return {
      status: "skipped",
      message: `boas-vindas WhatsApp ${email}: instância Evolution não configurada.`,
    };
  }

  const text = buildSubscriberWelcomeWhatsAppText(input);
  const result = await sendEvoTextAlert({
    instanceName,
    targetNumber: whatsapp,
    text,
  });

  if (result.ok) {
    console.log(`[whatsapp] boas-vindas enviada para ${whatsapp} (${email}) via ${instanceName}.`);
    return { status: "sent", message: "WhatsApp enviado." };
  }

  console.error(`[whatsapp] boas-vindas falhou para ${whatsapp} (${email}):`, result.detail);
  return { status: "failed", message: result.detail };
};

export const notifySubscriberWelcomeWhatsApp = (input: SubscriberWelcomeWhatsAppInput): void => {
  void deliverSubscriberWelcomeWhatsApp(input).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[whatsapp] boas-vindas cadastro (async):", message);
  });
};
