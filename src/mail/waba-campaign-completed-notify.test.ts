import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCampaignCompletedTemplate,
  buildCampaignCompletedWhatsAppText,
  CAMPAIGN_COMPLETED_WHATSAPP_REPORT_HINT,
} from "./waba-mail.templates";
import { buildCampaignReportSnapshotHtml } from "../disparos/waba-campaign-report-snapshot";
import { buildVitoriaCompletedNotifySnapshot } from "./waba-campaign-completed-notify.service";

describe("aviso de campanha finalizada", () => {
  it("reusa o texto atual do e-mail e inclui o print quando há cid", () => {
    const mail = buildCampaignCompletedTemplate({
      recipientName: "Walkup",
      recipientEmail: "walkup@walkuptec.com.br",
      campaignName: "VITORIA DA CONQUISTA",
      reportUrl: "https://waba.draxsistemas.com.br/?campanhaRelatorio=abc",
      reportImageCid: "campaign-report.png",
    });
    assert.match(mail.subject, /VITORIA DA CONQUISTA/);
    assert.match(mail.html, /Sua campanha foi finalizada/);
    assert.match(mail.html, /relatório de desempenho já está disponível/);
    assert.match(mail.html, /Acesse o relatório/);
    assert.match(mail.html, /cid:campaign-report.png/);
    assert.match(mail.html, /campanhaRelatorio=abc/);
    assert.doesNotMatch(mail.html, /dúvidas sobre os números/);
  });

  it("monta o WhatsApp com o mesmo recado e o rótulo Relatório", () => {
    const text = buildCampaignCompletedWhatsAppText({
      recipientName: "Walkup",
      recipientEmail: "walkup@walkuptec.com.br",
      campaignName: "VITORIA DA CONQUISTA",
    });
    assert.match(text, /Olá, Walkup/);
    assert.match(text, /VITORIA DA CONQUISTA/);
    assert.match(text, /Toque em Relatório/);
    assert.match(text, /Equipe Drax Sistemas/);
    assert.doesNotMatch(text, /dúvidas sobre os números/);
    assert.equal(
      CAMPAIGN_COMPLETED_WHATSAPP_REPORT_HINT,
      "Toque para abrir o relatório da campanha no seu painel.",
    );
    assert.doesNotMatch(CAMPAIGN_COMPLETED_WHATSAPP_REPORT_HINT, /\*/);
  });

  it("o print de VITORIA DA CONQUISTA usa o modal que o assinante vê", () => {
    const html = buildCampaignReportSnapshotHtml(buildVitoriaCompletedNotifySnapshot());
    assert.match(html, /Relatório — VITORIA DA CONQUISTA/);
    assert.match(html, /camp-report-modal/);
    assert.match(html, /camp-report-timeline/);
    assert.match(html, /camp-report-metric--sent/);
    assert.match(html, /Total de Leads/);
    assert.match(html, /Progresso/);
    assert.match(html, />Fechar</);
    assert.match(html, /907/);
    assert.match(html, /782/);
    assert.match(html, /484/);
    assert.match(html, /86/);
    assert.match(html, /18:01:00/);
    assert.match(html, /15:34:00/);
    assert.match(html, /12:17:00/);
    assert.doesNotMatch(html, /Campanha finalizada · relatório de desempenho/);
  });
});
