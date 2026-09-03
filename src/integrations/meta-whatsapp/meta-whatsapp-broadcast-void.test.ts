import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MetaBroadcastCampaign } from "./meta-whatsapp-broadcast.store";
import {
  JANDIRA2_VOID_BROADCAST_ID,
  JANDIRA2_VOID_INTAKE_ID,
  isBroadcastAbandonedForRetry,
  isCloudBroadcastInactiveForRetry,
  shouldVoidCloudBroadcast,
} from "./meta-whatsapp-broadcast-void";

const base = (partial: Partial<MetaBroadcastCampaign> = {}): MetaBroadcastCampaign => ({
  id: "other",
  tenantId: "t1",
  connectionId: "c1",
  templateId: "tpl",
  templateName: "jandira_quantun_2",
  language: "pt_BR",
  phoneNumberId: "phone",
  shortSlug: "x",
  shortUrl: "https://wabadisparos.com.br/s/x",
  trackedSlug: "x",
  clicksAtStart: 0,
  clicks: 0,
  status: "done",
  total: 2,
  sent: 2,
  failed: 0,
  skipped: 0,
  createdAt: "2026-09-03T15:11:44.265Z",
  updatedAt: "2026-09-03T15:59:32.481Z",
  leads: [],
  ...partial,
});

describe("cancelar Disparo Cloud sem entrega", () => {
  it("marca o lote da Jandira 2 e o abandono 131053", () => {
    const jandira = base({
      id: JANDIRA2_VOID_BROADCAST_ID,
      intakeCampaignId: JANDIRA2_VOID_INTAKE_ID,
      leads: [
        { waId: "5551999666841", status: "sent", metaStatus: "failed", errorCode: "131053" },
        { waId: "5551998335401", status: "sent", metaStatus: "failed", errorCode: "131053" },
      ],
    });
    assert.equal(isBroadcastAbandonedForRetry(jandira), true);
    assert.equal(shouldVoidCloudBroadcast(jandira), true);
    assert.equal(isCloudBroadcastInactiveForRetry(jandira), true);
  });

  it("não cancela um disparo novo com entrega", () => {
    const ok = base({
      id: "novo",
      intakeCampaignId: JANDIRA2_VOID_INTAKE_ID,
      leads: [
        { waId: "5551999666841", status: "sent", metaStatus: "delivered" },
        { waId: "5551998335401", status: "sent", metaStatus: "accepted" },
      ],
    });
    assert.equal(isBroadcastAbandonedForRetry(ok), false);
    assert.equal(shouldVoidCloudBroadcast(ok), false);
  });

  it("não cancela envio ainda na fila", () => {
    const queued = base({
      id: "fila",
      status: "queued",
      leads: [{ waId: "5551999666841", status: "queued" }],
    });
    assert.equal(isBroadcastAbandonedForRetry(queued), false);
    assert.equal(shouldVoidCloudBroadcast(queued), false);
  });
});
