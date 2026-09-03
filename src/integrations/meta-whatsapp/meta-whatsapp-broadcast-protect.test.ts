import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCloudBroadcastProtectSnapshot } from "./meta-whatsapp-broadcast-protect";
import type { MetaBroadcastCampaign } from "./meta-whatsapp-broadcast.store";

const base = (partial: Partial<MetaBroadcastCampaign> = {}): MetaBroadcastCampaign => ({
  id: "c1",
  tenantId: "t1",
  connectionId: "conn",
  templateId: "tpl",
  templateName: "jandira_quantun_2",
  language: "pt_BR",
  phoneNumberId: "phone",
  shortSlug: "x",
  shortUrl: "https://example.com/x",
  trackedSlug: "x",
  clicksAtStart: 0,
  clicks: 0,
  status: "running",
  total: 10,
  sent: 3,
  failed: 0,
  skipped: 0,
  createdAt: "2026-09-03T18:51:19.000Z",
  updatedAt: "2026-09-03T19:20:00.000Z",
  leads: [
    { waId: "1", status: "sent" },
    { waId: "2", status: "sent" },
    { waId: "3", status: "sent" },
    { waId: "4", status: "queued" },
    { waId: "5", status: "queued" },
  ],
  ...partial,
});

describe("proteção Disparo Cloud", () => {
  it("marca blockRedeploy quando há fila pendente", () => {
    const snap = buildCloudBroadcastProtectSnapshot({
      campaigns: [base()],
      isLoopAlive: () => false,
    });
    assert.equal(snap.active, true);
    assert.equal(snap.blockRedeploy, true);
    assert.equal(snap.pendingLeads, 2);
    assert.equal(snap.items[0].loopAlive, false);
    assert.equal(snap.policy, "resume_on_boot_and_watchdog");
  });

  it("ignora voided e libera Redeploy sem ativos", () => {
    const snap = buildCloudBroadcastProtectSnapshot({
      campaigns: [
        base({
          id: "voided",
          voidedAt: "2026-09-03T19:00:00.000Z",
        }),
      ],
      isLoopAlive: () => false,
    });
    assert.equal(snap.active, false);
    assert.equal(snap.blockRedeploy, false);
    assert.equal(snap.count, 0);
  });
});
