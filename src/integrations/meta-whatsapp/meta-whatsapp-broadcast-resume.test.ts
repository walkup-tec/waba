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
});
