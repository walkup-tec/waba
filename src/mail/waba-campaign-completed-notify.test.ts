import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCampaignCompletedTemplate,
  buildCampaignCompletedWhatsAppText,
  CAMPAIGN_COMPLETED_WHATSAPP_REPORT_HINT,
} from "./waba-mail.templates";
import { buildCampaignReportSnapshotHtml } from "../disparos/waba-campaign-report-snapshot";
import {
  buildVitoriaCompletedNotifySnapshot,
  CAMPAIGN_COMPLETED_EVO_INSTANCE_LABELS,
  CAMPAIGN_COMPLETED_EVO_PHONE_HINTS,
  notifyCampaignCompleted,
  resolveCampaignCompletedNotifyTarget,
} from "./waba-campaign-completed-notify.service";
import type { WabaCampaignIntake } from "../disparos/waba-campaign-intake.repository";

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

  it("usa e-mail e WhatsApp do assinante da campanha que finalizou", () => {
    const intake = {
      id: "camp-assinante-1",
      ownerEmail: "cliente@exemplo.com",
      campaignName: "CAMPANHA DO ASSINANTE",
      plannedSendCount: 200,
      status: "completed",
      performanceReport: {
        totalLeads: 200,
        sent: 180,
        delivered: 160,
        read: 90,
        failed: 10,
        source: "meta_lab",
      },
    } as WabaCampaignIntake;
    const target = resolveCampaignCompletedNotifyTarget({
      campaignId: "camp-assinante-1",
      ownerEmail: "outro@exemplo.com",
      campaignName: "OUTRA CAMPANHA",
      intake,
      intakeRepository: { getById: () => intake },
      subscriberRepository: {
        getByEmail: (email) =>
          email === "cliente@exemplo.com"
            ? {
                email: "cliente@exemplo.com",
                fullName: "Maria Cliente",
                whatsapp: "51988887777",
                phone: "5133334444",
              }
            : null,
      },
    });
    assert.equal(target.email, "cliente@exemplo.com");
    assert.equal(target.whatsapp, "51988887777");
    assert.equal(target.recipientName, "Maria Cliente");
    assert.equal(target.campaignName, "CAMPANHA DO ASSINANTE");
    assert.equal(target.campaignId, "camp-assinante-1");
  });

  it("tenta o WhatsApp na ordem Drax → drax-backup → walkup", () => {
    assert.deepEqual([...CAMPAIGN_COMPLETED_EVO_PHONE_HINTS], [
      "5181077770",
      "5198335401",
      "5197462102",
    ]);
    assert.equal(CAMPAIGN_COMPLETED_EVO_INSTANCE_LABELS["5181077770"], "Drax Sistemas");
    assert.equal(CAMPAIGN_COMPLETED_EVO_INSTANCE_LABELS["5198335401"], "drax-backup");
    assert.equal(CAMPAIGN_COMPLETED_EVO_INSTANCE_LABELS["5197462102"], "walkup");
  });

  it("dispara e-mail e WhatsApp do assinante com o print da própria campanha", async () => {
    const intake = {
      id: "camp-assinante-2",
      ownerEmail: "cliente@exemplo.com",
      campaignName: "CAMPANHA QUE FINALIZOU",
      plannedSendCount: 150,
      status: "completed",
      createdAt: "2026-09-10T12:00:00.000Z",
      updatedAt: "2026-09-16T12:00:00.000Z",
      performanceReport: {
        totalLeads: 150,
        sent: 140,
        delivered: 120,
        read: 80,
        failed: 5,
        source: "meta_lab",
      },
    } as WabaCampaignIntake;
    let emailedTo = "";
    let emailedCampaign = "";
    let whatsappTo = "";
    let whatsappHints: string[] = [];
    let snapshotName = "";
    const result = await notifyCampaignCompleted({
      ownerEmail: "cliente@exemplo.com",
      campaignId: "camp-assinante-2",
      campaignName: "CAMPANHA QUE FINALIZOU",
      intake,
      intakeRepository: { getById: () => intake },
      subscriberRepository: {
        getByEmail: () => ({
          email: "cliente@exemplo.com",
          fullName: "Maria Cliente",
          whatsapp: "51988887777",
        }),
      },
      renderPng: async (model) => {
        snapshotName = model.campaignName;
        return Buffer.alloc(64, 7);
      },
      deliverEmail: async (payload) => {
        emailedTo = payload.ownerEmail;
        emailedCampaign = payload.campaignName;
        return { status: "sent", message: "ok" };
      },
      deliverWhatsApp: async (payload) => {
        whatsappTo = payload.targetWhatsapp;
        whatsappHints = payload.phoneHints || [];
        return { status: "sent", message: "ok" };
      },
    });
    assert.equal(result.email.status, "sent");
    assert.equal(result.whatsapp.status, "sent");
    assert.equal(result.hasImage, true);
    assert.equal(emailedTo, "cliente@exemplo.com");
    assert.equal(emailedCampaign, "CAMPANHA QUE FINALIZOU");
    assert.equal(whatsappTo, "51988887777");
    assert.deepEqual(whatsappHints, ["5181077770", "5198335401", "5197462102"]);
    assert.equal(snapshotName, "CAMPANHA QUE FINALIZOU");
  });
});
