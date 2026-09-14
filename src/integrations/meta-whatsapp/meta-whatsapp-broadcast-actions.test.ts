import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cloudBroadcastActionFlags,
  cloudBroadcastHasStarted,
  decideCancelBroadcast,
  decideHideBroadcast,
  decidePauseBroadcast,
} from "./meta-whatsapp-broadcast-actions";
import type { MetaBroadcastCampaign } from "./meta-whatsapp-broadcast.store";

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

describe("ações do histórico Disparo Cloud", () => {
  it("agendada sem início: Cancelar e Excluir; Pausar some", () => {
    const row = base({ scheduledSendAt: "2026-09-14T04:00:00.000Z" });
    assert.equal(cloudBroadcastHasStarted(row), false);
    const flags = cloudBroadcastActionFlags(row);
    assert.deepEqual(flags, {
      canCancel: true,
      canPause: false,
      canDelete: true,
      showPause: false,
    });
    assert.equal(decideCancelBroadcast(row).ok, true);
    assert.equal(decidePauseBroadcast(row).ok, false);
    assert.equal(decideHideBroadcast(row).ok, true);
  });

  it("depois que o disparo começa: Cancelar desliga e Pausar aparece", () => {
    const row = base({
      status: "running",
      sendStartedAt: "2026-09-14T11:53:00.000Z",
      sent: 10,
    });
    const flags = cloudBroadcastActionFlags(row);
    assert.equal(flags.canCancel, false);
    assert.equal(flags.canPause, true);
    assert.equal(flags.showPause, true);
    assert.equal(decideCancelBroadcast(row).ok, false);
    assert.equal(decidePauseBroadcast(row).ok, true);
  });

  it("pausada ou cancelada não volta a disparar pelos botões", () => {
    const paused = base({
      status: "running",
      sendStartedAt: "2026-09-14T11:53:00.000Z",
      pausedAt: "2026-09-14T11:58:00.000Z",
    });
    assert.equal(cloudBroadcastActionFlags(paused).canPause, false);
    assert.equal(cloudBroadcastActionFlags(paused).showPause, true);
    assert.equal(decidePauseBroadcast(paused).ok, false);
    assert.equal(decideCancelBroadcast(paused).ok, false);

    const cancelled = base({ status: "failed", voidedAt: "2026-09-14T11:58:00.000Z" });
    assert.equal(cloudBroadcastActionFlags(cancelled).canCancel, false);
    assert.equal(decideHideBroadcast(cancelled).ok, true);
  });

  it("já excluída da lista não aceita outra exclusão", () => {
    const hidden = base({ hiddenAt: "2026-09-14T12:00:00.000Z" });
    assert.equal(cloudBroadcastActionFlags(hidden).canDelete, false);
    assert.equal(decideHideBroadcast(hidden).ok, false);
  });
});
