const escapeHtml = (value: string): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const formatMultilineHtml = (value: string): string =>
  escapeHtml(value).replace(/\r?\n/g, "<br />");

const resolveRecipientLabel = (name: string, email: string): string => {
  const safeName = String(name || "").trim();
  if (safeName) return safeName;
  const local = String(email || "")
    .trim()
    .split("@")[0];
  return local || "assinante";
};

const baseEmailShell = (title: string, contentHtml: string): string => `
<div style="font-family:Arial,Helvetica,sans-serif;background:#f5f7fb;padding:24px;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;">
    <h2 style="margin:0 0 16px;color:#0f172a;">${escapeHtml(title)}</h2>
    ${contentHtml}
    <p style="margin-top:24px;color:#64748b;font-size:12px;">
      Este e-mail foi enviado automaticamente pelo sistema Drax.
    </p>
  </div>
</div>
`;

const primaryButtonHtml = (href: string, label: string): string => `
<p style="margin:24px 0 0;text-align:center;">
  <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"
     style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;">
    ${escapeHtml(label)}
  </a>
</p>
`;

const formatCpfCnpjLabel = (raw: string): string => {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return digits || "—";
};

const registrationFieldRow = (label: string, value: string): string => {
  const safeValue = String(value || "").trim() || "—";
  return `
    <tr>
      <td style="padding:8px 0;color:#64748b;font-size:14px;width:38%;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:8px 0;color:#1e293b;font-size:14px;font-weight:600;vertical-align:top;">${escapeHtml(safeValue)}</td>
    </tr>
  `;
};

export type SupportTicketClosedTemplateInput = {
  recipientName: string;
  recipientEmail: string;
  displayId: string;
  ticketTitle: string;
  masterResponse: string;
};

export const buildSupportTicketClosedTemplate = (input: SupportTicketClosedTemplateInput) => {
  const recipient = resolveRecipientLabel(input.recipientName, input.recipientEmail);
  const displayId = String(input.displayId || "").trim() || "—";
  const ticketTitle = String(input.ticketTitle || "").trim() || "Chamado de suporte";
  const masterResponse = String(input.masterResponse || "").trim();
  const responseBlock = masterResponse
    ? `<div style="margin:16px 0 0;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;color:#1e293b;line-height:1.6;">
        ${formatMultilineHtml(masterResponse)}
      </div>`
    : `<p style="margin:16px 0 0;color:#64748b;">Nenhuma observação adicional foi registrada pela equipe.</p>`;

  const subject = `Chamado ${displayId} finalizado`;
  const html = baseEmailShell(
    "Seu chamado foi resolvido",
    `
    <p style="margin:0 0 12px;color:#1e293b;">Olá, <strong>${escapeHtml(recipient)}</strong>.</p>
    <p style="margin:0 0 12px;color:#1e293b;">
      Temos uma boa notícia: seu chamado de suporte <strong>${escapeHtml(displayId)}</strong>
      — <em>${escapeHtml(ticketTitle)}</em> — foi finalizado pela nossa equipe.
    </p>
    <p style="margin:0 0 8px;color:#1e293b;"><strong>Resposta da equipe:</strong></p>
    ${responseBlock}
    <p style="margin:16px 0 0;color:#1e293b;">
      Se precisar de algo mais, estamos à disposição. Você pode abrir um novo chamado pelo painel quando quiser.
    </p>
    <p style="margin:16px 0 0;color:#1e293b;">
      Atenciosamente,<br />
      <strong>Equipe Drax Sistemas</strong>
    </p>
  `,
  );

  return { subject, html };
};

export type SubscriberWelcomeTemplateInput = {
  recipientName: string;
  recipientEmail: string;
  password: string;
  whatsapp: string;
  phone: string;
  cpfCnpj: string;
  loginUrl: string;
};

export const buildSubscriberWelcomeTemplate = (input: SubscriberWelcomeTemplateInput) => {
  const recipient = resolveRecipientLabel(input.recipientName, input.recipientEmail);
  const cpfCnpjLabel = formatCpfCnpjLabel(input.cpfCnpj);
  const phoneLabel = String(input.phone || "").trim();
  const whatsappLabel = String(input.whatsapp || "").trim();
  const passwordPlain = String(input.password ?? "").trim();
  const passwordLabel = passwordPlain || "a senha definida no seu cadastro (use \"Esqueci a senha\" se necessário)";

  const subject = "Bem-vindo à Drax — seu cadastro foi confirmado";
  const html = baseEmailShell(
    "Seja bem-vindo à Drax",
    `
    <p style="margin:0 0 12px;color:#1e293b;">Olá, <strong>${escapeHtml(recipient)}</strong>.</p>
    <p style="margin:0 0 12px;color:#1e293b;">
      Obrigado por se cadastrar na Drax. É um prazer ter você conosco!
    </p>
    <p style="margin:0 0 12px;color:#1e293b;">
      Desejamos que você tenha uma jornada de muito sucesso usando nossa plataforma para
      escalar seus disparos, organizar campanhas e acelerar resultados com segurança e performance.
    </p>
    <p style="margin:0 0 8px;color:#1e293b;"><strong>Resumo do seu cadastro:</strong></p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 16px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
      ${registrationFieldRow("Nome completo", input.recipientName)}
      ${registrationFieldRow("E-mail de acesso", input.recipientEmail)}
      ${registrationFieldRow("Senha de acesso", passwordLabel)}
      ${registrationFieldRow("WhatsApp", whatsappLabel)}
      ${phoneLabel && phoneLabel !== whatsappLabel ? registrationFieldRow("Telefone", phoneLabel) : ""}
      ${registrationFieldRow("CPF/CNPJ", cpfCnpjLabel)}
    </table>
    <p style="margin:0 0 12px;color:#1e293b;">
      Seu acesso já está liberado. Clique no botão abaixo para entrar no painel e dar o próximo passo
      na sua operação.
    </p>
    ${primaryButtonHtml(input.loginUrl, "Acessar o sistema")}
    <p style="margin:16px 0 0;color:#1e293b;">
      Conte conosco em cada etapa. Estamos prontos para apoiar o crescimento do seu negócio.
    </p>
    <p style="margin:16px 0 0;color:#1e293b;">
      Um abraço,<br />
      <strong>Equipe Drax Sistemas</strong>
    </p>
  `,
  );

  return { subject, html };
};

export type StaffWelcomeTemplateInput = {
  recipientName: string;
  recipientEmail: string;
  password: string;
  whatsapp: string;
  roleLabel: string;
  loginUrl: string;
  operacionalDispatchesApiLabel?: string;
  operacionalSegmentLabel?: string;
};

export const buildStaffWelcomeTemplate = (input: StaffWelcomeTemplateInput) => {
  const recipient = resolveRecipientLabel(input.recipientName, input.recipientEmail);
  const whatsappLabel = String(input.whatsapp || "").trim() || "—";
  const passwordPlain = String(input.password ?? "").trim();
  const passwordLabel =
    passwordPlain || 'a senha definida no cadastro (use "Esqueci a senha" se necessário)';
  const roleLabel = String(input.roleLabel || "").trim() || "Equipe";
  const operacionalApiLabel = String(input.operacionalDispatchesApiLabel || "").trim();
  const operacionalSegmentLabel = String(input.operacionalSegmentLabel || "").trim();
  const operacionalRows =
    operacionalApiLabel || operacionalSegmentLabel
      ? `
      ${operacionalApiLabel ? registrationFieldRow("Tipo de disparos", operacionalApiLabel) : ""}
      ${operacionalSegmentLabel ? registrationFieldRow("Segmento", operacionalSegmentLabel) : ""}
    `
      : "";

  const subject = `Bem-vindo à equipe Drax — acesso ${roleLabel}`;
  const html = baseEmailShell(
    `Acesso de usuário ${roleLabel}`,
    `
    <p style="margin:0 0 12px;color:#1e293b;">Olá, <strong>${escapeHtml(recipient)}</strong>.</p>
    <p style="margin:0 0 12px;color:#1e293b;">
      Seu usuário <strong>${escapeHtml(roleLabel)}</strong> foi criado no sistema WABA — Drax.
      Utilize os dados abaixo para o primeiro acesso.
    </p>
    <p style="margin:0 0 8px;color:#1e293b;"><strong>Dados de acesso:</strong></p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 16px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
      ${registrationFieldRow("Nome", input.recipientName)}
      ${registrationFieldRow("Perfil", roleLabel)}
      ${registrationFieldRow("E-mail de acesso", input.recipientEmail)}
      ${registrationFieldRow("Senha de acesso", passwordLabel)}
      ${registrationFieldRow("WhatsApp", whatsappLabel)}
      ${operacionalRows}
    </table>
    <p style="margin:0 0 12px;color:#1e293b;">
      Os menus liberados para sua função já estão configurados. Clique no botão abaixo para entrar no painel.
    </p>
    ${primaryButtonHtml(input.loginUrl, "Acessar o sistema")}
    <p style="margin:16px 0 0;color:#1e293b;">
      Atenciosamente,<br />
      <strong>Equipe Drax Sistemas</strong>
    </p>
  `,
  );

  return { subject, html };
};

export type CampaignCompletedTemplateInput = {
  recipientName: string;
  recipientEmail: string;
  campaignName: string;
  reportUrl: string;
};

export const buildCampaignCompletedTemplate = (input: CampaignCompletedTemplateInput) => {
  const recipient = resolveRecipientLabel(input.recipientName, input.recipientEmail);
  const campaignName = String(input.campaignName || "").trim() || "Sua campanha";

  const subject = `Campanha "${campaignName}" finalizada — relatório disponível`;
  const html = baseEmailShell(
    "Sua campanha foi finalizada",
    `
    <p style="margin:0 0 12px;color:#1e293b;">Olá, <strong>${escapeHtml(recipient)}</strong>.</p>
    <p style="margin:0 0 12px;color:#1e293b;">
      Informamos que sua campanha <strong>${escapeHtml(campaignName)}</strong> foi concluída
      e o relatório de desempenho já está disponível para consulta.
    </p>
    <p style="margin:0 0 12px;color:#1e293b;">
      Agradecemos pela confiança em nossos serviços. Clique no botão abaixo para acessar
      os resultados da campanha diretamente no seu painel.
    </p>
    ${primaryButtonHtml(input.reportUrl, "Acesse o relatório")}
    <p style="margin:16px 0 0;color:#1e293b;">
      Se tiver dúvidas sobre os números ou quiser iniciar um novo disparo, nossa equipe está pronta para ajudar.
    </p>
    <p style="margin:16px 0 0;color:#1e293b;">
      Atenciosamente,<br />
      <strong>Equipe Drax Sistemas</strong>
    </p>
  `,
  );

  return { subject, html };
};

export type CampaignErrorReportedTemplateInput = {
  recipientName: string;
  recipientEmail: string;
  campaignName: string;
  campaignsUrl: string;
};

export const OPERACIONAL_CAMPAIGN_ATTENDANCE_SLA_HOURS = 24;

export type OperacionalNewCampaignTemplateInput = {
  recipientName: string;
  recipientEmail: string;
  /** operacional: saudação "Operador {nome}"; master: saudação com nome apenas. */
  recipientRole?: "operacional" | "master";
  campaignId: string;
  campaignName: string;
  subscriberId: string;
  plannedSendCount: number;
  createdAtLabel: string;
  createdAtIso?: string;
  assignedOperacionalName?: string;
  apiKindLabel: string;
  segmentLabel?: string;
  campaignUrl: string;
};

const resolveOperacionalNewCampaignGreeting = (input: OperacionalNewCampaignTemplateInput): string => {
  const name = resolveRecipientLabel(input.recipientName, input.recipientEmail);
  if (input.recipientRole === "operacional") {
    const firstName = name.split(/\s+/).filter(Boolean)[0] || name;
    return `Olá, Operador ${firstName}!`;
  }
  return `Olá, ${name}!`;
};

export const buildOperacionalNewCampaignTemplate = (input: OperacionalNewCampaignTemplateInput) => {
  const recipient = resolveRecipientLabel(input.recipientName, input.recipientEmail);
  const campaignName = String(input.campaignName || "").trim() || "Nova campanha";
  const subscriberId = String(input.subscriberId || "").trim() || "—";
  const createdAtLabel = String(input.createdAtLabel || "").trim() || "—";
  const apiKindLabel = String(input.apiKindLabel || "").trim() || "API";
  const segmentLabel = String(input.segmentLabel || "").trim() || "—";
  const plannedSendCount = Math.max(0, Math.round(Number(input.plannedSendCount) || 0));
  const slaHours = OPERACIONAL_CAMPAIGN_ATTENDANCE_SLA_HOURS;
  const greeting = resolveOperacionalNewCampaignGreeting(input);

  const subject = `Nova campanha ${apiKindLabel} aguardando sua configuração`;
  const html = baseEmailShell(
    "Nova campanha para atendimento",
    `
    <p style="margin:0 0 12px;color:#1e293b;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 12px;color:#1e293b;">
      Uma nova campanha foi gerada no plano <strong>${escapeHtml(apiKindLabel)}</strong>
      e está aguardando sua configuração no painel operacional.
    </p>
    <p style="margin:0 0 8px;color:#1e293b;"><strong>Resumo da campanha:</strong></p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 16px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
      ${registrationFieldRow("Data de criação", createdAtLabel)}
      ${registrationFieldRow("ID do assinante", subscriberId)}
      ${registrationFieldRow("Nome da campanha", campaignName)}
      ${registrationFieldRow("Envios registrados", String(plannedSendCount))}
      ${registrationFieldRow("Plano de atendimento", apiKindLabel)}
      ${registrationFieldRow("Segmento", segmentLabel)}
    </table>
    <p style="margin:0 0 12px;color:#1e293b;">
      Por gentileza, acesse seu painel operador e inicie a configuração desta campanha.
      O prazo para atendimento é de até <strong>${slaHours} horas</strong> a partir da criação.
    </p>
    ${primaryButtonHtml(input.campaignUrl, "Acesse seu painel operador")}
    <p style="margin:16px 0 0;color:#1e293b;">
      Este aviso foi enviado somente para operacionais designados ao plano
      <strong>${escapeHtml(apiKindLabel)}</strong>. Obrigado pelo cuidado com cada entrega!
    </p>
    <p style="margin:16px 0 0;color:#1e293b;">
      <strong>Equipe Drax Sistemas</strong>
    </p>
  `,
  );

  return { subject, html };
};

export const buildOperacionalNewCampaignWhatsAppText = (
  input: OperacionalNewCampaignTemplateInput,
): string => {
  const campaignName = String(input.campaignName || "").trim() || "Nova campanha";
  const subscriberId = String(input.subscriberId || "").trim() || "—";
  const createdAtLabel = String(input.createdAtLabel || "").trim() || "—";
  const apiKindLabel = String(input.apiKindLabel || "").trim() || "API";
  const segmentLabel = String(input.segmentLabel || "").trim() || "—";
  const plannedSendCount = Math.max(0, Math.round(Number(input.plannedSendCount) || 0));
  const slaHours = OPERACIONAL_CAMPAIGN_ATTENDANCE_SLA_HOURS;
  const greeting = resolveOperacionalNewCampaignGreeting({
    ...input,
    recipientRole: "operacional",
  });
  const campaignUrl = String(input.campaignUrl || "").trim();
  const panelAccessLine = campaignUrl
    ? `Acesse seu painel operador:\n${campaignUrl}`
    : "Acesse seu painel operador.";

  return [
    greeting,
    "",
    `Uma nova campanha foi gerada no plano ${apiKindLabel} e está aguardando sua configuração no painel operacional.`,
    "",
    "Resumo da campanha:",
    `- Data de criação: ${createdAtLabel}`,
    `- ID do assinante: ${subscriberId}`,
    `- Nome da campanha: ${campaignName}`,
    `- Envios registrados: ${plannedSendCount}`,
    `- Plano de atendimento: ${apiKindLabel}`,
    `- Segmento: ${segmentLabel}`,
    "",
    `Por gentileza, acesse seu painel operador e inicie a configuração desta campanha. O prazo para atendimento é de até ${slaHours} horas a partir da criação.`,
    "",
    panelAccessLine,
    "",
    `Este aviso foi enviado somente para operacionais designados ao plano ${apiKindLabel}. Obrigado pelo cuidado com cada entrega!`,
    "",
    "Equipe Drax Sistemas",
  ].join("\n");
};

const resolveMasterGreeting = (input: { recipientName: string; recipientEmail: string }): string => {
  const name = resolveRecipientLabel(input.recipientName, input.recipientEmail);
  return `Olá, ${name}!`;
};

/** WhatsApp para masters — nova campanha (visão supervisão). */
export const buildMasterNewCampaignWhatsAppText = (
  input: OperacionalNewCampaignTemplateInput,
): string => {
  const campaignName = String(input.campaignName || "").trim() || "Nova campanha";
  const subscriberId = String(input.subscriberId || "").trim() || "—";
  const createdAtLabel = String(input.createdAtLabel || "").trim() || "—";
  const apiKindLabel = String(input.apiKindLabel || "").trim() || "API";
  const plannedSendCount = Math.max(0, Math.round(Number(input.plannedSendCount) || 0));
  const operadorName =
    String(input.assignedOperacionalName || "").trim() || "—";

  return [
    resolveMasterGreeting(input),
    "",
    `Uma nova campanha foi gerada no plano ${apiKindLabel} e está aguardando sua configuração no painel operacional.`,
    "",
    "Resumo da campanha:",
    `- Operador: ${operadorName}`,
    `- Data de criação: ${createdAtLabel}`,
    `- ID do assinante: ${subscriberId}`,
    `- Nome da campanha: ${campaignName}`,
    `- Envios registrados: ${plannedSendCount}`,
    `- Plano de atendimento: ${apiKindLabel}`,
  ].join("\n");
};

export type MasterBmInoperanteCampaignTemplateInput = {
  recipientName: string;
  recipientEmail: string;
  campaignId: string;
  campaignName: string;
  subscriberId: string;
  plannedSendCount: number;
  updatedAtLabel: string;
  apiKindLabel: string;
};

/** WhatsApp para masters — BM inoperante registrada pelo operacional. */
export const buildMasterBmInoperanteCampaignWhatsAppText = (
  input: MasterBmInoperanteCampaignTemplateInput,
): string => {
  const campaignName = String(input.campaignName || "").trim() || "Nova campanha";
  const subscriberId = String(input.subscriberId || "").trim() || "—";
  const updatedAtLabel = String(input.updatedAtLabel || "").trim() || "—";
  const apiKindLabel = String(input.apiKindLabel || "").trim() || "API";
  const plannedSendCount = Math.max(0, Math.round(Number(input.plannedSendCount) || 0));

  return [
    "# BM INOPERANTE ATRIBUÍDA",
    "",
    "Resumo da campanha:",
    `- Data da Atualização: ${updatedAtLabel}`,
    `- ID do assinante: ${subscriberId}`,
    `- Nome da campanha: ${campaignName}`,
    `- Envios registrados: ${plannedSendCount}`,
    `- Plano de atendimento: ${apiKindLabel}`,
  ].join("\n");
};

export const buildCampaignErrorReportedTemplate = (input: CampaignErrorReportedTemplateInput) => {
  const recipient = resolveRecipientLabel(input.recipientName, input.recipientEmail);
  const campaignName = String(input.campaignName || "").trim() || "Sua campanha";

  const subject = `Campanha "${campaignName}" — não foi possível configurar`;
  const html = baseEmailShell(
    "Sua campanha não pôde ser configurada",
    `
    <p style="margin:0 0 12px;color:#1e293b;">Olá, <strong>${escapeHtml(recipient)}</strong>.</p>
    <p style="margin:0 0 12px;color:#1e293b;">
      Informamos que, infelizmente, não foi possível concluir a configuração da campanha
      <strong>${escapeHtml(campaignName)}</strong>.
    </p>
    <p style="margin:0 0 12px;color:#1e293b;">
      Os envios reservados para esta campanha já foram <strong>restituídos ao seu saldo disponível</strong>.
      Você pode utilizá-los em um novo disparo quando desejar.
    </p>
    ${primaryButtonHtml(input.campaignsUrl, "Ver minhas campanhas")}
    <p style="margin:16px 0 0;color:#1e293b;">
      Se precisar de ajuda para ajustar os materiais e tentar novamente, nossa equipe está à disposição.
    </p>
    <p style="margin:16px 0 0;color:#1e293b;">
      Atenciosamente,<br />
      <strong>Equipe Drax Sistemas</strong>
    </p>
  `,
  );

  return { subject, html };
};

export const buildPushAnnouncementTemplate = (input: {
  title: string;
  message: string;
  imageUrl?: string | null;
}) => {
  const title = String(input.title || "Comunicado WABA").trim() || "Comunicado WABA";
  const message = String(input.message || "").trim();
  const imageUrl = String(input.imageUrl || "").trim();
  const subject = title;
  const imageBlock = imageUrl
    ? `<div style="margin:0 0 16px;"><img src="${imageUrl}" alt="Comunicado WABA" style="max-width:100%;height:auto;border-radius:8px;border:1px solid #e2e8f0;" /></div>`
    : "";
  const messageBlock = message
    ? `<div style="margin:0 0 16px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;color:#1e293b;line-height:1.5;">
      ${formatMultilineHtml(message)}
    </div>`
    : "";
  const html = baseEmailShell(
    title,
    `
    <p style="margin:0 0 12px;color:#1e293b;">Olá,</p>
    <p style="margin:0 0 12px;color:#1e293b;">Temos um comunicado importante sobre o sistema WABA:</p>
    ${imageBlock}
    ${messageBlock}
    <p style="margin:16px 0 0;color:#1e293b;">
      Atenciosamente,<br />
      <strong>Equipe Drax Sistemas</strong>
    </p>
  `,
  );
  return { subject, html };
};
