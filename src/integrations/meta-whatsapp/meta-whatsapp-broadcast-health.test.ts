import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLOUD_BROADCAST_MISSED_SCHEDULE_GRACE_MS,
  CLOUD_BROADCAST_NOT_SENDING_MS,
  CLOUD_BROADCAST_STALL_MS,
  evaluateCloudBroadcastHealth,
} from "./meta-whatsapp-broadcast-health";
import type { MetaBroadcastCampaign } from "./meta-whatsapp-broadcast.store";

const nowMs = Date.parse("2026-09-14T12:00:00.000Z");

const base = (partial: Partial<MetaBroadcastCampaign> = {}): MetaBroadcastCampaign => ({
  id: "camp-1",
  tenantId: "t1",
  connectionId: "c1",
  templateId: "tpl",
  templateName: "cashback_ok",
  language: "pt_BR",
  phoneNumberId: "phone",
  shortSlug: "x",
  shortUrl: "https://example.com/x",
  trackedSlug: "x",
  clicksAtStart: 0,
  clicks: 0,
  status: "queued",
  total: 12266,
  sent: 0,
  failed: 0,
  skipped: 0,
  createdAt: "2026-09-14T11:52:19.000Z",
  updatedAt: "2026-09-14T11:52:19.000Z",
  leads: [{ waId: "5511999990001", status: "queued" }],
  ...partial,
});

describe("saúde do Disparo Cloud", () => {
  it("marca agendamento que passou sem nenhum envio", () => {
    const health = evaluateCloudBroadcastHealth(
      base({
        scheduledSendAt: new Date(nowMs - CLOUD_BROADCAST_MISSED_SCHEDULE_GRACE_MS - 1_000).toISOString(),
      }),
      nowMs,
    );
    assert.equal(health.ok, false);
    assert.equal(health.key, "missed_schedule");
  });

  it("não marca agendamento ainda no futuro", () => {
    const health = evaluateCloudBroadcastHealth(
      base({
        scheduledSendAt: new Date(nowMs + 60_000).toISOString(),
      }),
      nowMs,
    );
    assert.equal(health.ok, true);
  });

  it("marca running sem envio depois da tolerância", () => {
    const health = evaluateCloudBroadcastHealth(
      base({
        status: "running",
        sendStartedAt: new Date(nowMs - CLOUD_BROADCAST_NOT_SENDING_MS - 1_000).toISOString(),
        updatedAt: new Date(nowMs - CLOUD_BROADCAST_NOT_SENDING_MS - 1_000).toISOString(),
      }),
      nowMs,
    );
    assert.equal(health.ok, false);
    assert.equal(health.key, "not_sending");
  });

  it("marca running parado com fila pendente", () => {
    const health = evaluateCloudBroadcastHealth(
      base({
        status: "running",
        sendStartedAt: new Date(nowMs - 10_000).toISOString(),
        sent: 40,
        updatedAt: new Date(nowMs - CLOUD_BROADCAST_STALL_MS - 1_000).toISOString(),
        leads: [
          { waId: "5511999990001", status: "sent", metaStatus: "accepted" },
          { waId: "5511999990002", status: "queued" },
        ],
      }),
      nowMs,
    );
    assert.equal(health.ok, false);
    assert.equal(health.key, "stalled");
  });

  it("marca cabeçalho 131053 sem entrega", () => {
    const health = evaluateCloudBroadcastHealth(
      base({
        status: "running",
        sendStartedAt: new Date(nowMs - 5_000).toISOString(),
        sent: 1,
        updatedAt: new Date(nowMs - 1_000).toISOString(),
        leads: [
          { waId: "5511999990001", status: "sent", metaStatus: "failed", errorCode: "131053" },
          { waId: "5511999990002", status: "queued" },
        ],
      }),
      nowMs,
    );
    assert.equal(health.ok, false);
    assert.equal(health.key, "header_media");
  });

  it("não marca campanha já pausada ou cancelada", () => {
    assert.equal(
      evaluateCloudBroadcastHealth(
        base({
          status: "running",
          pausedAt: "2026-09-14T11:58:00.000Z",
          sendStartedAt: new Date(nowMs - CLOUD_BROADCAST_NOT_SENDING_MS - 1_000).toISOString(),
        }),
        nowMs,
      ).ok,
      true,
    );
    assert.equal(
      evaluateCloudBroadcastHealth(
        base({
          status: "failed",
          voidedAt: "2026-09-14T11:58:00.000Z",
        }),
        nowMs,
      ).ok,
      true,
    );
  });
});
