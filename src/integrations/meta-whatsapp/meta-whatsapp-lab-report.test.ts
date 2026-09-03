import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  campaignAttendedByLaboratorioStaff,
  staffEmailHasLaboratorioAccess,
  type LaboratorioStaffLookup,
} from "../../disparos/waba-campaign-laboratorio-attended";
import { computeCampaignPerformanceMetrics } from "../../disparos/waba-campaign-performance-metrics";
import {
  shouldFinalizeMetaLabReport,
  computeMetaLabCampaignMetrics,
  META_LAB_REPORT_QUIET_MS,
  META_LAB_REPORT_MAX_WAIT_MS,
} from "./meta-whatsapp-broadcast-report";
import {
  matchBroadcastLeadForMetaStatus,
  mergeBroadcastCampaignPreservingMeta,
  type MetaBroadcastCampaign,
} from "./meta-whatsapp-broadcast.store";
import {
  maskCloudRecipient,
  summarizeBroadcastSendIssues,
} from "./meta-whatsapp-broadcast-send-issues";
import {
  collectBusyCloudPhoneNumberIds,
  isCloudPhoneBusyForCampaign,
} from "./meta-whatsapp-phone-occupancy";
import {
  formatCloudLinkableCampaignLabel,
  isLinkableLabCampaignStatus,
} from "./meta-whatsapp-broadcast-linkable";
import {
  cloudBroadcastDisplayStatus,
  cloudBroadcastProgress,
} from "./meta-whatsapp-broadcast-history";

const prodEnv = {
  WABA_UI_PROFILE: "production",
  WABA_ENV: "production",
  RUNTIME_MODE: "production",
} as NodeJS.ProcessEnv;

function lookup(
  users: Record<
    string,
    { email: string; role: "master" | "operacional" | "suporte"; menuPermissions?: Record<string, boolean> | null }
  >,
): LaboratorioStaffLookup {
  return {
    getByEmail(email: string) {
      return users[String(email || "").trim().toLowerCase()] || null;
    },
  };
}

describe("campanha atendida pelo Laboratório", () => {
  const staff = lookup({
    "lab.op@waba.test": {
      email: "lab.op@waba.test",
      role: "operacional",
      menuPermissions: { "whatsapp-oficial": true, "whatsapp-templates": true },
    },
    "fila.op@waba.test": {
      email: "fila.op@waba.test",
      role: "operacional",
      menuPermissions: { dashboard: true, campanhas: true },
    },
    "mozart.pmo@gmail.com": {
      email: "mozart.pmo@gmail.com",
      role: "master",
      menuPermissions: null,
    },
    "walkup@walkuptec.com.br": {
      email: "walkup@walkuptec.com.br",
      role: "master",
      menuPermissions: null,
    },
  });

  it("operacional com menu do Laboratório tem acesso; operacional da fila não", () => {
    assert.equal(staffEmailHasLaboratorioAccess("lab.op@waba.test", staff, prodEnv), true);
    assert.equal(staffEmailHasLaboratorioAccess("fila.op@waba.test", staff, prodEnv), false);
  });

  it("em produção só o master Mozart tem Laboratório", () => {
    assert.equal(staffEmailHasLaboratorioAccess("mozart.pmo@gmail.com", staff, prodEnv), true);
    assert.equal(staffEmailHasLaboratorioAccess("walkup@walkuptec.com.br", staff, prodEnv), false);
  });

  it("usa o operacional atribuído, não o plano da campanha", () => {
    const labCampaign = {
      assignedOperacionalEmail: "lab.op@waba.test",
      apiKind: "alternativa" as const,
    };
    const filaCampaign = {
      assignedOperacionalEmail: "fila.op@waba.test",
      apiKind: "oficial" as const,
    };
    assert.equal(campaignAttendedByLaboratorioStaff(labCampaign, staff, prodEnv), true);
    assert.equal(campaignAttendedByLaboratorioStaff(filaCampaign, staff, prodEnv), false);
  });

  it("sem atribuição, cai no quem iniciou a campanha", () => {
    assert.equal(
      campaignAttendedByLaboratorioStaff({ startedByEmail: "lab.op@waba.test" }, staff, prodEnv),
      true,
    );
    assert.equal(
      campaignAttendedByLaboratorioStaff({ startedByEmail: "fila.op@waba.test" }, staff, prodEnv),
      false,
    );
    assert.equal(campaignAttendedByLaboratorioStaff({}, staff, prodEnv), false);
  });
});

describe("métricas do relatório", () => {
  it("taxa de cliques = cliques ÷ entregues", () => {
    const got = computeCampaignPerformanceMetrics({
      totalLeads: 100,
      sent: 90,
      delivered: 80,
      read: 40,
      failed: 5,
      clicks: 16,
    });
    assert.equal(got.clicks, 16);
    assert.equal(got.clickRate, 20);
    assert.equal(got.deliveryRate, 88.89);
  });

  it("sem entregues, taxa de cliques fica 0", () => {
    const got = computeCampaignPerformanceMetrics({ sent: 10, delivered: 0, clicks: 3 });
    assert.equal(got.clickRate, 0);
  });
});

describe("fechamento automático do relatório Meta", () => {
  const base = (patch: Partial<MetaBroadcastCampaign>): MetaBroadcastCampaign => ({
    id: "bc-1",
    tenantId: "t1",
    connectionId: "c1",
    templateId: "tpl",
    templateName: "aviso",
    language: "pt_BR",
    phoneNumberId: "123",
    shortSlug: "abc",
    shortUrl: "https://wabadisparos.com.br/s/abc",
    trackedSlug: "abc",
    clicksAtStart: 0,
    clicks: 4,
    status: "done",
    total: 2,
    sent: 2,
    failed: 0,
    skipped: 0,
    createdAt: "2026-09-02T10:00:00.000Z",
    updatedAt: "2026-09-02T10:05:00.000Z",
    sendFinishedAt: "2026-09-02T10:05:00.000Z",
    lastMetaStatusAt: "2026-09-02T10:06:00.000Z",
    leads: [
      { waId: "5551999887766", status: "sent", metaStatus: "read" },
      { waId: "5551982001261", status: "sent", metaStatus: "delivered" },
    ],
    ...patch,
  });

  it("espera a janela quieta depois do último evento da Meta", () => {
    const campaign = base({});
    const lastEvent = Date.parse(campaign.lastMetaStatusAt || "");
    assert.equal(shouldFinalizeMetaLabReport(campaign, lastEvent + 60_000), false);
    assert.equal(shouldFinalizeMetaLabReport(campaign, lastEvent + META_LAB_REPORT_QUIET_MS + 1_000), true);
  });

  it("não fecha na janela quieta se só há accepted/sent, sem entregue nem lido", () => {
    const campaign = base({
      lastMetaStatusAt: "2026-09-02T10:06:00.000Z",
      leads: [
        { waId: "5551999887766", status: "sent", metaStatus: "accepted" },
        { waId: "5551982001261", status: "sent", metaStatus: "sent" },
      ],
    });
    const lastEvent = Date.parse(campaign.lastMetaStatusAt || "");
    assert.equal(shouldFinalizeMetaLabReport(campaign, lastEvent + META_LAB_REPORT_QUIET_MS + 1_000), false);
    assert.equal(
      shouldFinalizeMetaLabReport(campaign, Date.parse(campaign.sendFinishedAt || "") + META_LAB_REPORT_MAX_WAIT_MS),
      true,
    );
  });

  it("não fecha se ainda há lead na fila", () => {
    const campaign = base({
      leads: [{ waId: "5551999887766", status: "queued" }],
    });
    assert.equal(shouldFinalizeMetaLabReport(campaign, Date.now() + META_LAB_REPORT_MAX_WAIT_MS), false);
  });

  it("conta enviados/entregues/lidos/falhados/cliques a partir do webhook", () => {
    const metrics = computeMetaLabCampaignMetrics(
      base({
        clicks: 7,
        leads: [
          { waId: "1", status: "sent", metaStatus: "read" },
          { waId: "2", status: "sent", metaStatus: "delivered" },
          { waId: "3", status: "failed", metaStatus: "failed" },
          { waId: "4", status: "sent", metaStatus: "sent" },
        ],
      }),
      4,
    );
    assert.equal(metrics.sent, 3);
    assert.equal(metrics.delivered, 2);
    assert.equal(metrics.read, 1);
    assert.equal(metrics.failed, 1);
    assert.equal(metrics.clicks, 7);
  });
});

describe("webhook do Disparo Cloud não perde entregue/lido", () => {
  const campaign = (patch: Partial<MetaBroadcastCampaign> = {}): MetaBroadcastCampaign => ({
    id: "bc-merge",
    tenantId: "t1",
    connectionId: "c1",
    templateId: "tpl",
    templateName: "aviso",
    language: "pt_BR",
    phoneNumberId: "phone-1",
    shortSlug: "abc",
    shortUrl: "https://wabadisparos.com.br/s/abc",
    trackedSlug: "abc",
    clicksAtStart: 0,
    clicks: 0,
    status: "running",
    total: 1,
    sent: 1,
    failed: 0,
    skipped: 0,
    createdAt: "2026-09-02T10:00:00.000Z",
    updatedAt: "2026-09-02T10:05:00.000Z",
    leads: [{ waId: "5551999887766", status: "sent", metaStatus: "accepted", wamid: "wamid.1" }],
    ...patch,
  });

  it("gravação do próximo envio não apaga delivered/read do webhook", () => {
    const stored = campaign({
      clicks: 3,
      lastMetaStatusAt: "2026-09-02T10:07:00.000Z",
      leads: [{ waId: "5551999887766", status: "sent", metaStatus: "delivered", wamid: "wamid.1" }],
    });
    const incoming = campaign({
      sent: 2,
      total: 2,
      leads: [
        { waId: "5551999887766", status: "sent", metaStatus: "accepted", wamid: "wamid.1" },
        { waId: "5551982001261", status: "sent", metaStatus: "accepted", wamid: "wamid.2" },
      ],
    });
    const merged = mergeBroadcastCampaignPreservingMeta(incoming, stored);
    assert.equal(merged.leads[0].metaStatus, "delivered");
    assert.equal(merged.clicks, 3);
    assert.equal(merged.lastMetaStatusAt, "2026-09-02T10:07:00.000Z");
  });

  it("preserva trilha e código de erro da Meta no merge", () => {
    const stored = campaign({
      leads: [
        {
          waId: "5551999887766",
          status: "failed",
          metaStatus: "failed",
          wamid: "wamid.1",
          errorCode: "131026",
          error: "Número não está no WhatsApp.",
          statusLog: [
            { status: "accepted", at: "2026-09-02T10:05:00.000Z" },
            { status: "failed", at: "2026-09-02T10:06:00.000Z", errorCode: "131026" },
          ],
        },
      ],
    });
    const incoming = campaign({
      leads: [
        {
          waId: "5551999887766",
          status: "sent",
          metaStatus: "accepted",
          wamid: "wamid.1",
          statusLog: [{ status: "accepted", at: "2026-09-02T10:05:00.000Z" }],
        },
      ],
    });
    const merged = mergeBroadcastCampaignPreservingMeta(incoming, stored);
    assert.equal(merged.leads[0].metaStatus, "failed");
    assert.equal(merged.leads[0].errorCode, "131026");
    assert.equal(merged.leads[0].error, "Número não está no WhatsApp.");
    assert.equal(merged.leads[0].statusLog?.length, 2);
  });

  it("preserva início do disparo e aprovação do template no merge", () => {
    const stored = campaign({
      sendStartedAt: "2026-09-02T10:01:00.000Z",
      sendFinishedAt: "2026-09-02T10:20:00.000Z",
      templateApprovedAt: "2026-09-01T12:00:00.000Z",
    });
    const incoming = campaign({
      status: "running",
      sendFinishedAt: undefined,
      templateApprovedAt: undefined,
    });
    const merged = mergeBroadcastCampaignPreservingMeta(incoming, stored);
    assert.equal(merged.sendStartedAt, "2026-09-02T10:01:00.000Z");
    assert.equal(merged.sendFinishedAt, "2026-09-02T10:20:00.000Z");
    assert.equal(merged.templateApprovedAt, "2026-09-01T12:00:00.000Z");
  });

  it("casa o status da Meta pelo wamid ou pelo destinatário", () => {
    const rows = [
      campaign({
        leads: [{ waId: "5551999887766", status: "sent", metaStatus: "accepted" }],
      }),
    ];
    const byRecipient = matchBroadcastLeadForMetaStatus(rows, {
      wamid: "wamid.novo",
      recipientId: "5551999887766",
      phoneNumberId: "phone-1",
    });
    assert.equal(byRecipient?.lead.waId, "5551999887766");
    const byWamid = matchBroadcastLeadForMetaStatus(
      [campaign({ leads: [{ waId: "5551982001261", status: "sent", wamid: "wamid.X" }] })],
      { wamid: "wamid.X" },
    );
    assert.equal(byWamid?.lead.wamid, "wamid.X");
  });
});

describe("erros de envio visíveis ao operacional", () => {
  it("mascara o destino e separa falha de aceito sem comprovante", () => {
    assert.equal(maskCloudRecipient("5511949490317"), "11 •••••-0317");
    const issues = summarizeBroadcastSendIssues({
      id: "bc-1",
      tenantId: "t1",
      connectionId: "c1",
      templateId: "tpl",
      templateName: "aviso",
      language: "pt_BR",
      phoneNumberId: "phone-1",
      shortSlug: "abc",
      shortUrl: "https://wabadisparos.com.br/s/abc",
      trackedSlug: "abc",
      clicksAtStart: 0,
      clicks: 0,
      status: "done",
      total: 3,
      sent: 2,
      failed: 1,
      skipped: 0,
      createdAt: "2026-09-02T10:00:00.000Z",
      updatedAt: "2026-09-02T10:05:00.000Z",
      leads: [
        { waId: "5511949490317", status: "sent", metaStatus: "accepted", wamid: "wamid.ok" },
        {
          waId: "5551982001261",
          status: "failed",
          metaStatus: "failed",
          errorCode: "131026",
          error: "Falha informada pela Meta.",
        },
        { waId: "5551999111111", status: "sent", metaStatus: "delivered", wamid: "wamid.d" },
        { waId: "5551999000000", status: "skipped", metaStatus: "queued" },
      ],
    });
    assert.equal(issues.pendingConfirmation, 1);
    assert.equal(issues.failureCount, 1);
    assert.equal(issues.failures[0]?.errorCode, "131026");
    assert.equal(issues.failures[0]?.error, "Número inválido ou sem WhatsApp.");
    assert.equal(issues.failures[0]?.recipient, "51 •••••-1261");
  });

  it("troca o inglês 131053 da Meta pelo aviso de weblink 403", () => {
    const issues = summarizeBroadcastSendIssues({
      id: "bc-j2",
      tenantId: "t1",
      connectionId: "c1",
      templateId: "tpl",
      templateName: "jandira_quantun_2",
      language: "pt_BR",
      phoneNumberId: "phone-1",
      shortSlug: "abc",
      shortUrl: "https://wabadisparos.com.br/s/abc",
      trackedSlug: "abc",
      clicksAtStart: 0,
      clicks: 0,
      status: "done",
      total: 1,
      sent: 1,
      failed: 0,
      skipped: 0,
      createdAt: "2026-09-03T15:11:44.265Z",
      updatedAt: "2026-09-03T15:59:32.481Z",
      leads: [
        {
          waId: "5551999666841",
          status: "sent",
          metaStatus: "failed",
          errorCode: "131053",
          error: "Downloading media from weblink failed with http code 403, status message Forbidden",
          wamid: "wamid.HBgMNTU1MTk5NjY2ODQxFQIAER",
        },
      ],
    });
    assert.equal(issues.failureCount, 1);
    assert.equal(issues.failures[0]?.errorCode, "131053");
    assert.match(String(issues.failures[0]?.error), /weblink 403/);
  });
});

describe("ocupação do número no Disparo Cloud", () => {
  it("ocupa no início do disparo e só libera depois do relatório", () => {
    assert.equal(isCloudPhoneBusyForCampaign({ broadcastStatus: "queued", intakeStatus: "generated" }), true);
    assert.equal(isCloudPhoneBusyForCampaign({ broadcastStatus: "running", intakeStatus: "in_progress" }), true);
    assert.equal(isCloudPhoneBusyForCampaign({ broadcastStatus: "done", intakeStatus: "in_progress" }), true);
    assert.equal(
      isCloudPhoneBusyForCampaign({
        broadcastStatus: "done",
        intakeStatus: "in_progress",
        inactive: true,
      }),
      false,
    );
    assert.equal(isCloudPhoneBusyForCampaign({ broadcastStatus: "failed", intakeStatus: "in_progress" }), true);
    assert.equal(isCloudPhoneBusyForCampaign({ broadcastStatus: "done", intakeStatus: "completed" }), false);
    assert.equal(isCloudPhoneBusyForCampaign({ broadcastStatus: "done", intakeStatus: "error_reported" }), false);
    assert.equal(isCloudPhoneBusyForCampaign({ broadcastStatus: "failed", intakeStatus: "cancelled" }), false);
  });

  it("sem campanha do assinante, ocupa só enquanto o envio está na fila ou rodando", () => {
    assert.equal(isCloudPhoneBusyForCampaign({ broadcastStatus: "queued" }), true);
    assert.equal(isCloudPhoneBusyForCampaign({ broadcastStatus: "running" }), true);
    assert.equal(isCloudPhoneBusyForCampaign({ broadcastStatus: "done" }), false);
    assert.equal(isCloudPhoneBusyForCampaign({ broadcastStatus: "failed" }), false);
  });

  it("um disparo em andamento deixa o número ocupado mesmo se outro já tiver relatório", () => {
    const busy = collectBusyCloudPhoneNumberIds(
      [
        { phoneNumberId: "phone-a", status: "done", intakeCampaignId: "old" },
        { phoneNumberId: "phone-a", status: "queued", intakeCampaignId: "new" },
        { phoneNumberId: "phone-b", status: "done", intakeCampaignId: "done-b" },
      ],
      new Map([
        ["old", "completed"],
        ["new", "in_progress"],
        ["done-b", "completed"],
      ]),
    );
    assert.equal(busy.has("phone-a"), true);
    assert.equal(busy.has("phone-b"), false);
  });
});

describe("campanha do assinante no Disparo Cloud", () => {
  it("só aceita status Em andamento", () => {
    assert.equal(isLinkableLabCampaignStatus("in_progress"), true);
    assert.equal(isLinkableLabCampaignStatus("generated"), false);
    assert.equal(isLinkableLabCampaignStatus("completed"), false);
    assert.equal(isLinkableLabCampaignStatus("error_reported"), false);
    assert.equal(isLinkableLabCampaignStatus("cancelled"), false);
  });

  it("rótulo é nome do assinante - campanha - envios", () => {
    assert.equal(
      formatCloudLinkableCampaignLabel({
        subscriberName: "Maria Silva",
        ownerEmail: "assinante@exemplo.com",
        campaignName: "Campanha Setembro",
        plannedSendCount: 500,
      }),
      "Maria Silva - Campanha Setembro - 500",
    );
    assert.equal(
      formatCloudLinkableCampaignLabel({
        ownerEmail: "assinante@exemplo.com",
        campaignName: "Campanha Setembro",
        plannedSendCount: 0,
      }),
      "assinante@exemplo.com - Campanha Setembro - 0",
    );
  });
});

describe("histórico do Disparo Cloud", () => {
  it("barra de andamento usa enviados contra a quantidade solicitada", () => {
    const mid = cloudBroadcastProgress({ sent: 180, failed: 0, plannedSendCount: 500, status: "running" });
    assert.equal(mid.percent, 36);
    assert.equal(mid.processed, 180);
    const done = cloudBroadcastProgress({ sent: 480, failed: 20, plannedSendCount: 500, status: "done" });
    assert.equal(done.percent, 100);
  });

  it("status da tabela segue o envio e o relatório da campanha", () => {
    assert.equal(cloudBroadcastDisplayStatus({ broadcastStatus: "running" }).label, "Enviando");
    assert.equal(
      cloudBroadcastDisplayStatus({ broadcastStatus: "done", intakeStatus: "in_progress" }).label,
      "Coletando relatório da Meta",
    );
    assert.equal(
      cloudBroadcastDisplayStatus({ broadcastStatus: "done", intakeStatus: "completed" }).label,
      "Finalizado",
    );
    assert.equal(
      cloudBroadcastDisplayStatus({
        broadcastStatus: "done",
        intakeStatus: "in_progress",
        voided: true,
      }).label,
      "Cancelado",
    );
  });
});
