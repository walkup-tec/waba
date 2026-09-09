import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, after } from "node:test";
import type { MetaBroadcastCampaign } from "./meta-whatsapp-broadcast.store";

const dataRoot = mkdtempSync(path.join(os.tmpdir(), "waba-broadcast-resume-"));
const originalCwd = process.cwd();

function base(overrides: Partial<MetaBroadcastCampaign> = {}): MetaBroadcastCampaign {
  const now = new Date().toISOString();
  return {
    id: "camp-1",
    tenantId: "tenant-a",
    connectionId: "conn-1",
    templateId: "tpl-1",
    templateName: "jandira_quantun_2",
    language: "pt_BR",
    phoneNumberId: "phone-1",
    shortSlug: "abc",
    shortUrl: "https://example.com/abc",
    trackedSlug: "abc",
    clicksAtStart: 0,
    clicks: 0,
    status: "running",
    total: 3,
    sent: 1,
    failed: 0,
    skipped: 0,
    createdAt: now,
    updatedAt: now,
    leads: [
      { waId: "5511999990001", status: "sent", metaStatus: "delivered" },
      { waId: "5511999990002", status: "queued" },
      { waId: "5511999990003", status: "queued" },
    ],
    ...overrides,
  };
}

describe("resume de Disparo Cloud órfão pós-Redeploy", () => {
  after(() => {
    process.chdir(originalCwd);
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("detecta pending e fecha running sem fila", async () => {
    process.chdir(dataRoot);
    const {
      broadcastLeadIsPendingSend,
      listResumableOrphanedBroadcasts,
      listStaleRunningBroadcastsWithoutPending,
      saveBroadcastCampaign,
      finalizeStaleRunningBroadcast,
    } = await import("./meta-whatsapp-broadcast.store");

    assert.equal(broadcastLeadIsPendingSend({ waId: "1", status: "queued" }), true);
    assert.equal(broadcastLeadIsPendingSend({ waId: "1", status: "sent" }), false);

    saveBroadcastCampaign(base());
    saveBroadcastCampaign(
      base({
        id: "camp-void",
        voidedAt: new Date().toISOString(),
      }),
    );
    saveBroadcastCampaign(
      base({
        id: "camp-done-ish",
        sent: 3,
        leads: [
          { waId: "1", status: "sent" },
          { waId: "2", status: "failed" },
          { waId: "3", status: "skipped" },
        ],
      }),
    );

    const resumable = listResumableOrphanedBroadcasts().map((row) => row.id);
    assert.deepEqual(resumable, ["camp-1"]);

    const stale = listStaleRunningBroadcastsWithoutPending().map((row) => row.id);
    assert.ok(stale.includes("camp-done-ish"));
    assert.equal(finalizeStaleRunningBroadcast("camp-done-ish")?.status, "done");
  });

  it("não reabre Opt in PTX failed sem WABA_FORCE_OPT_IN_PTX_RESUME", async () => {
    process.chdir(dataRoot);
    const previous = process.env.WABA_FORCE_OPT_IN_PTX_RESUME;
    delete process.env.WABA_FORCE_OPT_IN_PTX_RESUME;
    try {
      const { OPT_IN_PTX_RESUME_BROADCAST_ID } = await import("./meta-whatsapp-broadcast-void");
      const { reopenOptInPtxBroadcastToContinue, saveBroadcastCampaign, findBroadcastCampaign } =
        await import("./meta-whatsapp-broadcast.store");

      saveBroadcastCampaign(
        base({
          id: OPT_IN_PTX_RESUME_BROADCAST_ID,
          intakeCampaignId: "c213963a-209a-465e-b3b6-85fef1328caf",
          status: "failed",
          sent: 0,
          failed: 2,
          total: 2,
          leads: [
            { waId: "5511999000001", status: "failed", errorCode: "132001" },
            { waId: "5511999000002", status: "queued" },
          ],
        }),
      );

      assert.equal(reopenOptInPtxBroadcastToContinue(), null);
      const kept = findBroadcastCampaign("tenant-a", OPT_IN_PTX_RESUME_BROADCAST_ID);
      assert.equal(kept?.status, "failed");
      assert.equal((kept?.leads || []).filter((lead) => lead.status === "queued").length, 1);
    } finally {
      if (previous === undefined) delete process.env.WABA_FORCE_OPT_IN_PTX_RESUME;
      else process.env.WABA_FORCE_OPT_IN_PTX_RESUME = previous;
    }
  });

  it("reabre a Opt in PTX failed com fila e não reenvia os já sent", async () => {
    process.chdir(dataRoot);
    process.env.WABA_FORCE_OPT_IN_PTX_RESUME = "1";
    const { OPT_IN_PTX_RESUME_INTAKE_ID } = await import("./meta-whatsapp-broadcast-void");
    const {
      listResumableOrphanedBroadcasts,
      reopenOptInPtxBroadcastToContinue,
      saveBroadcastCampaign,
    } = await import("./meta-whatsapp-broadcast.store");

    saveBroadcastCampaign(
      base({
        id: "opt-in-ptx-broadcast",
        intakeCampaignId: OPT_IN_PTX_RESUME_INTAKE_ID,
        status: "failed",
        voidedAt: "2026-09-07T18:00:00.000Z",
        sendFinishedAt: "2026-09-07T18:00:00.000Z",
        sent: 1980,
        total: 2996,
        leads: [
          { waId: "5511999000001", status: "sent", metaStatus: "accepted" },
          { waId: "5511999000002", status: "failed", errorCode: "4" },
          { waId: "5511999000003", status: "queued" },
          { waId: "5511999000004", status: "queued" },
        ],
      }),
    );

    const reopened = reopenOptInPtxBroadcastToContinue();
    assert.equal(reopened?.id, "opt-in-ptx-broadcast");
    assert.equal(reopened?.status, "running");
    assert.equal(reopened?.voidedAt, undefined);
    assert.equal(reopened?.sendFinishedAt, undefined);
    assert.equal(reopened?.sent, 1);
    assert.equal(
      (reopened?.leads || []).filter((lead) => lead.status === "queued").length,
      3,
    );
    assert.equal(
      (reopened?.leads || []).filter((lead) => lead.status === "sent").length,
      1,
    );

    const resumable = listResumableOrphanedBroadcasts().map((row) => row.id);
    assert.ok(resumable.includes("opt-in-ptx-broadcast"));
    delete process.env.WABA_FORCE_OPT_IN_PTX_RESUME;
  });

  it("reabre o lote paulo_teix 1980 failed sem wamid", async () => {
    process.chdir(dataRoot);
    process.env.WABA_FORCE_OPT_IN_PTX_RESUME = "1";
    const { OPT_IN_PTX_RESUME_BROADCAST_ID } = await import("./meta-whatsapp-broadcast-void");
    const { listResumableOrphanedBroadcasts, reopenOptInPtxBroadcastToContinue, saveBroadcastCampaign } =
      await import("./meta-whatsapp-broadcast.store");

    saveBroadcastCampaign(
      base({
        id: OPT_IN_PTX_RESUME_BROADCAST_ID,
        intakeCampaignId: "c213963a-209a-465e-b3b6-85fef1328caf",
        templateName: "paulo_teix_v2_2",
        status: "failed",
        sent: 0,
        failed: 1980,
        total: 1980,
        leads: [
          { waId: "5511999000001", status: "failed", error: "rate limit", errorCode: "4" },
          { waId: "5511999000002", status: "failed", wamid: "wamid.keep", metaStatus: "failed" },
          { waId: "5511999000003", status: "failed", errorCode: "130429" },
        ],
      }),
    );

    const reopened = reopenOptInPtxBroadcastToContinue();
    assert.equal(reopened?.id, OPT_IN_PTX_RESUME_BROADCAST_ID);
    assert.equal(reopened?.status, "running");
    assert.equal(reopened?.sent, 0);
    assert.equal(
      (reopened?.leads || []).filter((lead) => lead.status === "queued").length,
      2,
    );
    assert.equal(
      (reopened?.leads || []).filter((lead) => lead.status === "failed" && lead.wamid).length,
      1,
    );
    assert.ok(listResumableOrphanedBroadcasts().some((row) => row.id === OPT_IN_PTX_RESUME_BROADCAST_ID));
    delete process.env.WABA_FORCE_OPT_IN_PTX_RESUME;
  });
});
