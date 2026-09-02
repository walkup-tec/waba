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
import type { MetaBroadcastCampaign } from "./meta-whatsapp-broadcast.store";
import {
  collectBusyCloudPhoneNumberIds,
  isCloudPhoneBusyForCampaign,
} from "./meta-whatsapp-phone-occupancy";

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

describe("ocupação do número no Disparo Cloud", () => {
  it("ocupa no início do disparo e só libera depois do relatório", () => {
    assert.equal(isCloudPhoneBusyForCampaign({ broadcastStatus: "queued", intakeStatus: "generated" }), true);
    assert.equal(isCloudPhoneBusyForCampaign({ broadcastStatus: "running", intakeStatus: "in_progress" }), true);
    assert.equal(isCloudPhoneBusyForCampaign({ broadcastStatus: "done", intakeStatus: "in_progress" }), true);
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
