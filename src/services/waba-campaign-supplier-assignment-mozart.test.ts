import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WABA_MOZART_FORCED_OPERACIONAL_EMAIL } from "../disparos/waba-campaign-intake.constants";
import type { WabaCampaignIntake } from "../disparos/waba-campaign-intake.repository";
import { WabaCampaignSupplierAssignmentService } from "./waba-campaign-supplier-assignment.service";

const intake = (ownerEmail: string): WabaCampaignIntake =>
  ({
    id: "camp-test",
    ownerEmail,
    campaignName: "Teste",
    regionDdd: "51",
    textOptions: ["aaaaaaaa", "bbbbbbbb", "cccccccc"],
    importedLineCount: 10,
    plannedSendCount: 10,
    apiKind: "oficial",
    status: "generated",
    createdAt: "2026-09-14T13:00:00.000Z",
    updatedAt: "2026-09-14T13:00:00.000Z",
  }) as WabaCampaignIntake;

describe("fila forçada do Mozart", () => {
  it("escolhe só drax@draxsistemas.com.br para campanha do Mozart", () => {
    const service = new WabaCampaignSupplierAssignmentService();
    const next = service.pickNextSupplier(intake("mozart.pmo@gmail.com"), new Set());
    assert.equal(next?.systemUserEmail, WABA_MOZART_FORCED_OPERACIONAL_EMAIL);
    assert.equal(
      service.pickNextSupplier(intake("mozart.pmo@gmail.com"), new Set([WABA_MOZART_FORCED_OPERACIONAL_EMAIL])),
      null,
    );
  });
});
