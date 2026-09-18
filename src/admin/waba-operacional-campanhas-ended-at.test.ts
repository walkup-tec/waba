import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { WabaCampaignIntake } from "../disparos/waba-campaign-intake.repository";
import { resolveOperacionalCampaignEndedAt } from "./waba-operacional-campanhas.service";

const base = {
  id: "camp-1",
  campaignName: "Campanha teste",
  createdAt: "2026-09-09T17:48:06.000Z",
  updatedAt: "2026-09-18T13:22:00.000Z",
} satisfies Pick<WabaCampaignIntake, "id" | "campaignName" | "createdAt" | "updatedAt">;

describe("data de término da campanha operacional", () => {
  it("campanha em aberto não tem término", () => {
    assert.equal(
      resolveOperacionalCampaignEndedAt({
        ...base,
        status: "in_progress",
      }),
      null,
    );
  });

  it("erro reportado usa a data do reporte", () => {
    assert.equal(
      resolveOperacionalCampaignEndedAt({
        ...base,
        status: "error_reported",
        errorReport: {
          justification: "BM fora",
          reportedAt: "2026-09-14T10:32:00.000Z",
          reportedByEmail: "op@exemplo.com",
        },
      }),
      "2026-09-14T10:32:00.000Z",
    );
  });

  it("NOSSO CONSIG 1 usa o fim pontual das 10:30", () => {
    assert.equal(
      resolveOperacionalCampaignEndedAt({
        ...base,
        campaignName: "NOSSO CONSIG 1",
        status: "completed",
        performanceReport: {
          totalLeads: 2504,
          sent: 2203,
          delivered: 2064,
          read: 958,
          failed: 301,
          clicks: 0,
          source: "meta_lab",
          filledAt: "2026-09-18T13:22:00.000Z",
          filledByEmail: "lab@example.com",
        },
      }),
      "2026-09-18T13:30:00.000Z",
    );
  });
});
