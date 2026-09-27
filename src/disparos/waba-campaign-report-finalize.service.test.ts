import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import type { WabaCampaignIntake } from "./waba-campaign-intake.repository";
import { WabaCampaignIntakeRepository } from "./waba-campaign-intake.repository";
import { finalizeIntakePerformanceReport } from "./waba-campaign-report-finalize.service";
import { PAYOUT_EVIDENCE_REQUIRED_MESSAGE } from "./waba-campaign-payout-approval";
import type { WabaFinanceiroSplitService } from "../billing/waba-financeiro-split.service";

process.env.WABA_SKIP_CLEISON_BALANCE_REPAIR = "1";
process.env.WABA_FINANCEIRO_SPLIT_PAYOUT_ENABLED = "0";

const originalCwd = process.cwd();
const dataRoot = mkdtempSync(path.join(os.tmpdir(), "waba-payout-finalize-"));
const now = "2026-09-27T01:00:00.000Z";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function writeJson(fileName: string, payload: unknown) {
  writeFileSync(path.join(process.cwd(), "data", fileName), JSON.stringify(payload, null, 2));
}

function intake(overrides: Partial<WabaCampaignIntake> & { id: string }): WabaCampaignIntake {
  return {
    ownerEmail: "ana@exemplo.com",
    campaignName: "Campanha manual",
    regionDdd: "11",
    textOptions: ["a", "b", "c"],
    imageFileName: "a.png",
    imageStoredPath: "/tmp/a.png",
    spreadsheetFileName: "a.csv",
    spreadsheetStoredPath: "/tmp/a.csv",
    importedLineCount: 1000,
    plannedSendCount: 1000,
    apiKind: "oficial",
    status: "in_progress",
    createdAt: now,
    updatedAt: now,
    creditFunding: { fromPaid: 1000, fromBonus: 0 },
    assignedOperacionalEmail: "op@exemplo.com",
    ...overrides,
  };
}

describe("finalizar relatório defere o Pix manual e paga o Laboratório", () => {
  before(() => {
    mkdirSync(path.join(dataRoot, "data"), { recursive: true });
    process.chdir(dataRoot);
    writeJson("waba-campaign-intakes.json", { version: 1, intakes: [] });
    writeJson("waba-subscribers.json", { version: 1, subscribers: [] });
    writeJson("waba-disparos-bonus-balances.json", { version: 2, entries: [] });
  });

  after(() => {
    process.chdir(originalCwd);
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("operador manual sem print não finaliza", () => {
    writeJson("waba-campaign-intakes.json", {
      version: 1,
      intakes: [intake({ id: "camp-no-print" })],
    });
    const repository = new WabaCampaignIntakeRepository();
    assert.throws(
      () =>
        finalizeIntakePerformanceReport({
          campaignId: "camp-no-print",
          metrics: { sent: 900, delivered: 800, read: 400, failed: 20 },
          filledByEmail: "op@exemplo.com",
          source: "manual",
          intakeRepository: repository,
          bonusService: { grantCampaignBonus() {} } as never,
          splitService: {
            payoutSupplierForCompletedCampaign: async () => {
              throw new Error("não deveria pagar");
            },
          } as unknown as WabaFinanceiroSplitService,
        }),
      { message: PAYOUT_EVIDENCE_REQUIRED_MESSAGE },
    );
    assert.equal(repository.getById("camp-no-print")?.status, "in_progress");
  });

  it("operador manual grava evidência, finaliza e não dispara o split", async () => {
    writeJson("waba-campaign-intakes.json", {
      version: 1,
      intakes: [intake({ id: "camp-manual" })],
    });
    const paid: string[] = [];
    const repository = new WabaCampaignIntakeRepository();
    const completed = finalizeIntakePerformanceReport({
      campaignId: "camp-manual",
      metrics: { sent: 900, delivered: 800, read: 400, failed: 20 },
      filledByEmail: "op@exemplo.com",
      source: "manual",
      payoutEvidence: {
        buffer: PNG,
        originalName: "indicadores.png",
        mimeType: "image/png",
      },
      intakeRepository: repository,
      bonusService: { grantCampaignBonus() {} } as never,
      splitService: {
        payoutSupplierForCompletedCampaign: async (row: WabaCampaignIntake) => {
          paid.push(row.id);
          return { id: "should-not" };
        },
      } as unknown as WabaFinanceiroSplitService,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(completed.status, "completed");
    assert.equal(completed.payoutApproval?.status, "pending_master");
    assert.equal(completed.payoutApproval?.evidenceFileName, "indicadores.png");
    assert.ok(String(completed.payoutApproval?.evidenceStoredPath || "").includes("payout-evidence.png"));
    assert.equal(completed.supplierPayoutSettlementId, undefined);
    assert.deepEqual(paid, []);
  });

  it("Laboratório Cloud continua disparando o split ao finalizar", async () => {
    writeJson("waba-campaign-intakes.json", {
      version: 1,
      intakes: [intake({ id: "camp-lab", campaignName: "Lab Cloud" })],
    });
    const paid: string[] = [];
    const repository = new WabaCampaignIntakeRepository();
    finalizeIntakePerformanceReport({
      campaignId: "camp-lab",
      metrics: { sent: 900, delivered: 800, read: 400, failed: 20, clicks: 10 },
      filledByEmail: "meta-lab",
      source: "meta_lab",
      intakeRepository: repository,
      bonusService: { grantCampaignBonus() {} } as never,
      splitService: {
        payoutSupplierForCompletedCampaign: async (row: WabaCampaignIntake) => {
          paid.push(row.id);
          return { id: "set-lab" };
        },
      } as unknown as WabaFinanceiroSplitService,
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.deepEqual(paid, ["camp-lab"]);
    assert.equal(repository.getById("camp-lab")?.payoutApproval, undefined);
    assert.equal(repository.getById("camp-lab")?.supplierPayoutSettlementId, "set-lab");
  });
});
