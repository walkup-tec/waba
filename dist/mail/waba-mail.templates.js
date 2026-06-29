"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPushAnnouncementTemplate = exports.buildCampaignErrorReportedTemplate = exports.buildOperacionalNewCampaignTemplate = exports.OPERACIONAL_CAMPAIGN_ATTENDANCE_SLA_HOURS = exports.buildCampaignCompletedTemplate = exports.buildSubscriberWelcomeTemplate = exports.buildSupportTicketClosedTemplate = void 0;
const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const formatMultilineHtml = (value) => escapeHtml(value).replace(/\r?\n/g, "<br />");
const resolveRecipientLabel = (name, email) => {
    const safeName = String(name || "").trim();
    if (safeName)
        return safeName;
    const local = String(email || "")
        .trim()
        .split("@")[0];
    return local || "assinante";
};
const baseEmailShell = (title, contentHtml) => `
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
const primaryButtonHtml = (href, label) => `
<p style="margin:24px 0 0;text-align:center;">
  <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"
     style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;">
    ${escapeHtml(label)}
  </a>
</p>
`;
const formatCpfCnpjLabel = (raw) => {
    const digits = String(raw ?? "").replace(/\D/g, "");
    if (digits.length === 11) {
        return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    if (digits.length === 14) {
        return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    return digits || "—";
};
const registrationFieldRow = (label, value) => {
    const safeValue = String(value || "").trim() || "—";
    return `
    <tr>
      <td style="padding:8px 0;color:#64748b;font-size:14px;width:38%;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:8px 0;color:#1e293b;font-size:14px;font-weight:600;vertical-align:top;">${escapeHtml(safeValue)}</td>
    </tr>
  `;
};
const buildSupportTicketClosedTemplate = (input) => {
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
    const html = baseEmailShell("Seu chamado foi resolvido", `
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
  `);
    return { subject, html };
};
exports.buildSupportTicketClosedTemplate = buildSupportTicketClosedTemplate;
const buildSubscriberWelcomeTemplate = (input) => {
    const recipient = resolveRecipientLabel(input.recipientName, input.recipientEmail);
    const cpfCnpjLabel = formatCpfCnpjLabel(input.cpfCnpj);
    const phoneLabel = String(input.phone || "").trim();
    const whatsappLabel = String(input.whatsapp || "").trim();
    const subject = "Bem-vindo à Drax — seu cadastro foi confirmado";
    const html = baseEmailShell("Seja bem-vindo à Drax", `
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
  `);
    return { subject, html };
};
exports.buildSubscriberWelcomeTemplate = buildSubscriberWelcomeTemplate;
const buildCampaignCompletedTemplate = (input) => {
    const recipient = resolveRecipientLabel(input.recipientName, input.recipientEmail);
    const campaignName = String(input.campaignName || "").trim() || "Sua campanha";
    const subject = `Campanha "${campaignName}" finalizada — relatório disponível`;
    const html = baseEmailShell("Sua campanha foi finalizada", `
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
  `);
    return { subject, html };
};
exports.buildCampaignCompletedTemplate = buildCampaignCompletedTemplate;
exports.OPERACIONAL_CAMPAIGN_ATTENDANCE_SLA_HOURS = 24;
const buildOperacionalNewCampaignTemplate = (input) => {
    const recipient = resolveRecipientLabel(input.recipientName, input.recipientEmail);
    const campaignName = String(input.campaignName || "").trim() || "Nova campanha";
    const subscriberId = String(input.subscriberId || "").trim() || "—";
    const createdAtLabel = String(input.createdAtLabel || "").trim() || "—";
    const apiKindLabel = String(input.apiKindLabel || "").trim() || "API";
    const plannedSendCount = Math.max(0, Math.round(Number(input.plannedSendCount) || 0));
    const slaHours = exports.OPERACIONAL_CAMPAIGN_ATTENDANCE_SLA_HOURS;
    const subject = `Nova campanha ${apiKindLabel} aguardando sua configuração`;
    const html = baseEmailShell("Nova campanha para atendimento", `
    <p style="margin:0 0 12px;color:#1e293b;">Olá, <strong>${escapeHtml(recipient)}</strong>!</p>
    <p style="margin:0 0 12px;color:#1e293b;">
      Tudo bem? Uma nova campanha foi gerada no plano <strong>${escapeHtml(apiKindLabel)}</strong>
      e está aguardando sua configuração no painel operacional.
    </p>
    <p style="margin:0 0 8px;color:#1e293b;"><strong>Resumo da campanha:</strong></p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 16px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
      ${registrationFieldRow("Data de criação", createdAtLabel)}
      ${registrationFieldRow("ID do assinante", subscriberId)}
      ${registrationFieldRow("Nome da campanha", campaignName)}
      ${registrationFieldRow("Envios registrados", String(plannedSendCount))}
      ${registrationFieldRow("Plano de atendimento", apiKindLabel)}
    </table>
    <p style="margin:0 0 12px;color:#1e293b;">
      Por gentileza, acesse o sistema e inicie a configuração desta campanha.
      O prazo para atendimento é de até <strong>${slaHours} horas</strong> a partir da criação.
    </p>
    ${primaryButtonHtml(input.campaignUrl, "Abrir campanha no painel")}
    <p style="margin:16px 0 0;color:#1e293b;">
      Este aviso foi enviado somente para operacionais designados ao plano
      <strong>${escapeHtml(apiKindLabel)}</strong>. Obrigado pelo cuidado com cada entrega!
    </p>
    <p style="margin:16px 0 0;color:#1e293b;">
      Um abraço,<br />
      <strong>Equipe Drax Sistemas</strong>
    </p>
  `);
    return { subject, html };
};
exports.buildOperacionalNewCampaignTemplate = buildOperacionalNewCampaignTemplate;
const buildCampaignErrorReportedTemplate = (input) => {
    const recipient = resolveRecipientLabel(input.recipientName, input.recipientEmail);
    const campaignName = String(input.campaignName || "").trim() || "Sua campanha";
    const subject = `Campanha "${campaignName}" — não foi possível configurar`;
    const html = baseEmailShell("Sua campanha não pôde ser configurada", `
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
  `);
    return { subject, html };
};
exports.buildCampaignErrorReportedTemplate = buildCampaignErrorReportedTemplate;
const buildPushAnnouncementTemplate = (input) => {
    const title = String(input.title || "Comunicado WABA").trim() || "Comunicado WABA";
    const message = String(input.message || "").trim();
    const subject = title;
    const html = baseEmailShell(title, `
    <p style="margin:0 0 12px;color:#1e293b;">Olá,</p>
    <p style="margin:0 0 12px;color:#1e293b;">Temos um comunicado importante sobre o sistema WABA:</p>
    <div style="margin:0 0 16px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;color:#1e293b;line-height:1.5;">
      ${formatMultilineHtml(message)}
    </div>
    <p style="margin:16px 0 0;color:#1e293b;">
      Atenciosamente,<br />
      <strong>Equipe Drax Sistemas</strong>
    </p>
  `);
    return { subject, html };
};
exports.buildPushAnnouncementTemplate = buildPushAnnouncementTemplate;
