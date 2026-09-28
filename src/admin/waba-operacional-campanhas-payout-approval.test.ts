import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { WabaOperacionalCampanhasService } from "./waba-operacional-campanhas.service";
import { WabaCampaignIntakeRepository, type WabaCampaignIntake } from "../disparos/waba-campaign-intake.repository";
import type { WabaFinanceiroSplitService } from "../billing/waba-financeiro-split.service";

process.env.WABA_SKIP_CLEISON_BALANCE_REPAIR = "1";
process.env.WABA_FINANCEIRO_SPLIT_PAYOUT_ENABLED = "0";

const originalCwd = process.cwd();
const dataRoot = mkdtempSync(path.join(os.tmpdir(), "waba-payout-approve-"));
const now = "2026-09-27T01:10:00.000Z";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const EMAIL = "ana@exemplo.com";

function writeJson(fileName: string, payload: unknown) {
  writeFileSync(path.join(process.cwd(), "data", fileName), JSON.stringify(payload, null, 2));
}

function completedManual(overrides: Partial<WabaCampaignIntake> = {}): WabaCampaignIntake {
  return {
    id: "camp-manual-1",
    ownerEmail: EMAIL,
    campaignName: "Campanha alternativa",
    regionDdd: "11",
    textOptions: ["a", "b", "c"],
    imageFileName: "a.png",
    imageStoredPath: "/tmp/a.png",
    spreadsheetFileName: "a.csv",
    spreadsheetStoredPath: "/tmp/a.csv",
    importedLineCount: 1000,
    plannedSendCount: 1000,
    apiKind: "alternativa",
    status: "completed",
    createdAt: now,
    updatedAt: now,
    assignedOperacionalEmail: "op@exemplo.com",
    creditFunding: { fromPaid: 1000, fromBonus: 0 },
    performanceReport: {
      totalLeads: 1000,
      sent: 900,
      delivered: 800,
      read: 400,
      failed: 20,
      source: "manual",
      filledAt: now,
      filledByEmail: "op@exemplo.com",
    },
    payoutApproval: {
      status: "pending_master",
      evidenceFileName: "indicadores.png",
      evidenceStoredPath: path.join(process.cwd(), "data", "campaign-intakes", "camp-manual-1", "payout-evidence.png"),
      evidenceMimeType: "image/png",
      uploadedAt: now,
      uploadedByEmail: "op@exemplo.com",
    },
    ...overrides,
  };
}

function seed(intakes: WabaCampaignIntake[]) {
  mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
  writeJson("waba-system-users.json", {
    version: 1,
    users: [
      {
        id: "master-1",
        fullName: "Master",
        email: "master@exemplo.com",
        passwordHash: "x",
        role: "master",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "op-1",
        fullName: "Operacional",
        email: "op@exemplo.com",
        passwordHash: "x",
        role: "operacional",
        menuPermissions: {
          dashboard: true,
          "admin-campanhas": true,
        },
        createdAt: now,
        updatedAt: now,
      },
    ],
  });
  writeJson("waba-subscribers.json", {
    version: 1,
    subscribers: [
      {
        id: "sub-1",
        email: EMAIL,
        passwordHash: "x",
        fullName: "Ana Souza",
        whatsapp: "11999999999",
        phone: "11999999999",
        cpfCnpj: "00000000191",
        segment: "outros",
        visibleToMasters: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
  });
  writeJson("waba-campaign-intakes.json", { version: 1, intakes });
  writeJson("waba-billing-orders.json", []);
  writeJson("waba-financeiro-split-config.json", { version: 2, updatedAt: now, suppliers: [], participants: [] });
  writeJson("waba-financeiro-split-settlements.json", { version: 1, settlements: [] });
  writeJson("waba-disparos-bonus-balances.json", { version: 2, entries: [] });
  writeJson("waba-indicator-commissions.json", { version: 1, commissions: [] });
  writeJson("waba-indicator-profiles.json", { version: 1, profiles: [] });
  writeJson("waba-indicator-audit.json", { version: 1, events: [] });
}

describe("aprovação master do split operacional", () => {
  before(() => {
    mkdirSync(path.join(dataRoot, "data"), { recursive: true });
    process.chdir(dataRoot);
  });

  after(() => {
    process.chdir(originalCwd);
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("master aprova e dispara o split de todas as partes", async () => {
    const row = completedManual();
    mkdirSync(path.dirname(row.payoutApproval!.evidenceStoredPath), { recursive: true });
    writeFileSync(row.payoutApproval!.evidenceStoredPath, PNG);
    seed([row]);
    const paid: { id: string; skipSupplier?: boolean }[] = [];
    const service = new WabaOperacionalCampanhasService();
    (service as unknown as { splitService: WabaFinanceiroSplitService }).splitService = {
      payoutSupplierForCompletedCampaign: async (
        intake: WabaCampaignIntake,
        options?: { skipSupplier?: boolean },
      ) => {
        paid.push({ id: intake.id, skipSupplier: options?.skipSupplier });
        return { id: "set-approved" };
      },
    } as unknown as WabaFinanceiroSplitService;
    const detail = await service.approveCampaignPayout("camp-manual-1", {
      email: "master@exemplo.com",
      role: "master",
    });
    assert.equal(detail.payoutApprovalStatus, "approved");
    assert.equal(detail.canApprovePayout, false);
    assert.deepEqual(paid, [{ id: "camp-manual-1", skipSupplier: undefined }]);
    const stored = new WabaCampaignIntakeRepository().getById("camp-manual-1");
    assert.equal(stored?.payoutApproval?.status, "approved");
    assert.equal(stored?.payoutApproval?.approvedByEmail, "master@exemplo.com");
    assert.equal(stored?.supplierPayoutSettlementId, "set-approved");
  });

  it("operacional não pode aprovar o pagamento", async () => {
    const row = completedManual({ id: "camp-op" });
    row.payoutApproval = {
      ...row.payoutApproval!,
      evidenceStoredPath: path.join(process.cwd(), "data", "campaign-intakes", "camp-op", "payout-evidence.png"),
    };
    mkdirSync(path.dirname(row.payoutApproval.evidenceStoredPath), { recursive: true });
    writeFileSync(row.payoutApproval.evidenceStoredPath, PNG);
    seed([row]);
    const service = new WabaOperacionalCampanhasService();
    await assert.rejects(
      () =>
        service.approveCampaignPayout("camp-op", {
          email: "op@exemplo.com",
          role: "operacional",
        }),
      { message: "Somente usuários master podem aprovar o pagamento." },
    );
  });

  it("não aprova duas vezes", async () => {
    const row = completedManual({
      id: "camp-done",
      payoutApproval: {
        status: "approved",
        evidenceFileName: "indicadores.png",
        evidenceStoredPath: path.join(process.cwd(), "data", "campaign-intakes", "camp-done", "payout-evidence.png"),
        evidenceMimeType: "image/png",
        uploadedAt: now,
        uploadedByEmail: "op@exemplo.com",
        approvedAt: now,
        approvedByEmail: "master@exemplo.com",
      },
    });
    mkdirSync(path.dirname(row.payoutApproval!.evidenceStoredPath), { recursive: true });
    writeFileSync(row.payoutApproval!.evidenceStoredPath, PNG);
    seed([row]);
    const service = new WabaOperacionalCampanhasService();
    await assert.rejects(
      () =>
        service.approveCampaignPayout("camp-done", {
          email: "master@exemplo.com",
          role: "master",
        }),
      { message: "O pagamento desta campanha já foi aprovado." },
    );
  });

  it("master Sem Split não dispara PIX do fornecedor", async () => {
    const row = completedManual({ id: "camp-sem-split" });
    row.payoutApproval = {
      ...row.payoutApproval!,
      evidenceStoredPath: path.join(
        process.cwd(),
        "data",
        "campaign-intakes",
        "camp-sem-split",
        "payout-evidence.png",
      ),
    };
    mkdirSync(path.dirname(row.payoutApproval.evidenceStoredPath), { recursive: true });
    writeFileSync(row.payoutApproval.evidenceStoredPath, PNG);
    seed([row]);
    const paid: { id: string; skipSupplier?: boolean }[] = [];
    const service = new WabaOperacionalCampanhasService();
    (service as unknown as { splitService: WabaFinanceiroSplitService }).splitService = {
      payoutSupplierForCompletedCampaign: async (
        intake: WabaCampaignIntake,
        options?: { skipSupplier?: boolean },
      ) => {
        paid.push({ id: intake.id, skipSupplier: options?.skipSupplier });
        return { id: "set-sem-split" };
      },
    } as unknown as WabaFinanceiroSplitService;
    const detail = await service.approveCampaignPayout(
      "camp-sem-split",
      { email: "master@exemplo.com", role: "master" },
      { skipSupplier: true },
    );
    assert.equal(detail.payoutApprovalStatus, "approved");
    assert.equal(detail.canApprovePayout, false);
    assert.deepEqual(paid, [{ id: "camp-sem-split", skipSupplier: true }]);
    const stored = new WabaCampaignIntakeRepository().getById("camp-sem-split");
    assert.equal(stored?.payoutApproval?.status, "approved");
    assert.equal(stored?.payoutApproval?.skipSupplier, true);
  });
});
