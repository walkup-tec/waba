import { deliverWabaEvolutionWhatsApp } from "./waba-evolution-whatsapp-delivery.service";
import { WabaPushRepository } from "../push/waba-push.repository";
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

const resolveWelcomeCommunityLink = (): string => {
  const fromEnv = String(process.env.WABA_WELCOME_COMMUNITY_LINK || "").trim();
  if (fromEnv) return fromEnv;
  const fromPush = String(new WabaPushRepository().readConfig().communityInviteLink || "").trim();
  return fromPush || DEFAULT_COMMUNITY_LINK;
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
  return deliverWabaEvolutionWhatsApp({
    targetWhatsapp: input.whatsapp,
    recipientEmail: input.email,
    text: input.text,
    logLabel: input.logLabel || "boas-vindas",
  });
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
