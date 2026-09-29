import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { WabaCampaignIntake } from "./waba-campaign-intake.repository";
import { runForcedCampaignReportCompleteOneshot } from "./waba-campaign-report-force-complete";

const intake = (partial: Partial<WabaCampaignIntake>): WabaCampaignIntake =>
  ({
    id: "camp-1",
    ownerEmail: "assinante@example.com",
    campaignName: "VITORIA DA CONQUISTA",
    regionDdd: "77",
    textOptions: ["a", "b", "c"],
    importedLineCount: 1000,
    plannedSendCount: 1000,
    status: "in_progress",
    createdAt: "2026-09-08T21:01:00.000Z",
    updatedAt: "2026-09-14T15:17:00.000Z",
    performanceReport: {
      totalLeads: 1000,
      sent: 1,
      delivered: 1,
      read: 1,
      failed: 1,
      clicks: 41,
      source: "meta_lab",
      filledAt: "",
      filledByEmail: "",
    },
    ...partial,
  }) as WabaCampaignIntake;

describe("oneshot de finalização pontual do relatório", () => {
  it("finaliza só VITORIA DA CONQUISTA em andamento e preserva cliques", () => {
    const rows = [
      intake({ id: "vitoria" }),
      intake({
        id: "vitoria-2",
        campaignName: "VITORIA DA CONQUISTA 2",
        performanceReport: {
          totalLeads: 1000,
          sent: 9,
          delivered: 8,
          read: 7,
          failed: 1,
          clicks: 3,
          source: "meta_lab",
          filledAt: "",
          filledByEmail: "",
        },
      }),
    ];
    const finalized: Array<{ campaignId: string; clicks?: number; sent: number }> = [];
    const result = runForcedCampaignReportCompleteOneshot({
      forceLocal: true,
      intakeRepository: {
        listAll: () => rows,
      } as never,
      finalize: (input) => {
        finalized.push({
          campaignId: input.campaignId,
          clicks: input.metrics.clicks,
          sent: input.metrics.sent,
        });
        return rows[0];
      },
    });
    assert.equal(result.applied, 1);
    assert.deepEqual(result.campaignIds, ["vitoria"]);
    assert.deepEqual(finalized, [{ campaignId: "vitoria", clicks: 41, sent: 907 }]);
  });

  it("finaliza a Pelli em andamento com os indicadores do overlay", () => {
    const rows = [
      intake({
        id: "pelli",
        campaignName: "Primeiro disparo - agenda pessoal Pelli",
        createdAt: "2026-09-25T14:23:02.000Z",
        performanceReport: {
          totalLeads: 9088,
          sent: 0,
          delivered: 0,
          read: 0,
          failed: 0,
          clicks: 0,
          source: "manual",
          filledAt: "",
          filledByEmail: "",
        },
      }),
      intake({
        id: "pelli-2",
        campaignName: "Primeiro disparo - agenda pessoal Pelli 2",
        createdAt: "2026-09-25T14:23:02.000Z",
      }),
    ];
    const finalized: Array<{ campaignId: string; clicks?: number; sent: number }> = [];
    const result = runForcedCampaignReportCompleteOneshot({
      forceLocal: true,
      intakeRepository: {
        listAll: () => rows,
      } as never,
      finalize: (input) => {
        finalized.push({
          campaignId: input.campaignId,
          clicks: input.metrics.clicks,
          sent: input.metrics.sent,
        });
        return rows[0];
      },
    });
    assert.equal(result.applied, 1);
    assert.deepEqual(result.campaignIds, ["pelli"]);
    assert.deepEqual(finalized, [{ campaignId: "pelli", clicks: 22, sent: 5136 }]);
  });

  it("não refaz campanha já finalizada", () => {
    let called = 0;
    const result = runForcedCampaignReportCompleteOneshot({
      forceLocal: true,
      intakeRepository: {
        listAll: () => [intake({ id: "vitoria", status: "completed" })],
      } as never,
      finalize: () => {
        called += 1;
        return intake({ status: "completed" });
      },
    });
    assert.equal(result.applied, 0);
    assert.equal(called, 0);
    assert.match(result.message, /já estava finalizado/i);
  });
});
