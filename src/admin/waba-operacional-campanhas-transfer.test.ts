import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { WabaOperacionalCampanhasService } from "./waba-operacional-campanhas.service";
import { WabaCampaignIntakeRepository, type WabaCampaignIntake } from "../disparos/waba-campaign-intake.repository";

process.env.WABA_SKIP_CLEISON_BALANCE_REPAIR = "1";
process.env.WABA_FINANCEIRO_SPLIT_PAYOUT_ENABLED = "0";

const originalCwd = process.cwd();
const dataRoot = mkdtempSync(path.join(os.tmpdir(), "waba-transfer-ops-"));
const now = "2026-09-25T14:23:00.000Z";

function writeJson(fileName: string, payload: unknown) {
  writeFileSync(path.join(process.cwd(), "data", fileName), JSON.stringify(payload, null, 2));
}

function intake(overrides: Partial<WabaCampaignIntake> = {}): WabaCampaignIntake {
  return {
    id: "1f625e89-cd14-4a3b-9be4-d245257ce88b",
    ownerEmail: "pelli@exemplo.com",
    campaignName: "Primeiro disparo - agenda pessoal Pelli",
    regionDdd: "11",
    textOptions: ["a", "b", "c"],
    imageFileName: "a.png",
    imageStoredPath: "/tmp/a.png",
    spreadsheetFileName: "a.csv",
    spreadsheetStoredPath: "/tmp/a.csv",
    importedLineCount: 9088,
    plannedSendCount: 9088,
    apiKind: "oficial",
    status: "in_progress",
    startedAt: now,
    startedByEmail: "op_douglas@draxsistemas.com.br",
    assignedOperacionalEmail: "op_douglas@draxsistemas.com.br",
    assignedAt: now,
    createdAt: now,
    updatedAt: now,
    creditFunding: { fromPaid: 9088, fromBonus: 0 },
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
        id: "douglas-1",
        fullName: "Douglas",
        email: "op_douglas@draxsistemas.com.br",
        passwordHash: "x",
        role: "operacional",
        operacionalDispatchesApis: ["oficial"],
        operacionalSegments: ["outros"],
        menuPermissions: { dashboard: true, "admin-campanhas": true },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "claudinei-1",
        fullName: "Claudinei Fernandes",
        email: "negociosltda01@gmail.com",
        passwordHash: "x",
        role: "operacional",
        operacionalDispatchesApis: ["oficial"],
        operacionalSegments: ["bets"],
        menuPermissions: { dashboard: true, "admin-campanhas": true },
        createdAt: now,
        updatedAt: now,
      },
    ],
  });
  writeJson("waba-subscribers.json", {
    version: 1,
    subscribers: [
      {
        id: "sub-pelli",
        email: "pelli@exemplo.com",
        passwordHash: "x",
        fullName: "Pelli",
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
  writeJson("waba-financeiro-split-config.json", {
    version: 2,
    updatedAt: now,
    participants: [],
    suppliers: [
      {
        id: "sup-drax-white",
        name: "Drax",
        apiKind: "oficial",
        systemUserEmail: "drax@draxsistemas.com.br",
        segment: "outros",
        priority: 1,
        costPerShipmentCents: 4,
        pixKey: "ae0d66cc-fake",
        active: true,
      },
      {
        id: "sup-claudinei-white",
        name: "Claudinei Fernandes",
        apiKind: "oficial",
        systemUserEmail: "negociosltda01@gmail.com",
        segment: "outros",
        priority: 2,
        costPerShipmentCents: 27,
        pixKey: "45987159873",
        active: true,
      },
    ],
  });
  writeJson("waba-financeiro-split-settlements.json", { version: 1, settlements: [] });
  writeJson("waba-disparos-bonus-balances.json", { version: 2, entries: [] });
  writeJson("waba-indicator-commissions.json", { version: 1, commissions: [] });
  writeJson("waba-indicator-profiles.json", { version: 1, profiles: [] });
  writeJson("waba-indicator-audit.json", { version: 1, events: [] });
}

describe("transferência master ignora cadastro de segmento quando há fornecedor", () => {
  before(() => {
    mkdirSync(path.join(dataRoot, "data"), { recursive: true });
    process.chdir(dataRoot);
  });

  after(() => {
    process.chdir(originalCwd);
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("lista Claudinei mesmo com cadastro só Black, se existe linha White no split", () => {
    seed([intake()]);
    const service = new WabaOperacionalCampanhasService();
    const items = service.listTransferOperacionais("1f625e89-cd14-4a3b-9be4-d245257ce88b", {
      email: "master@exemplo.com",
      role: "master",
    });
    const claudinei = items.find((row) => row.email === "negociosltda01@gmail.com");
    assert.ok(claudinei, "Claudinei precisa aparecer na lista de transferência");
    assert.equal(claudinei?.eligible, true);
    assert.equal(
      items.some((row) => row.email === "op_douglas@draxsistemas.com.br"),
      false,
      "operador atual não entra na lista",
    );
  });

  it("master transfere a campanha para o Claudinei", async () => {
    seed([intake()]);
    const service = new WabaOperacionalCampanhasService();
    const detail = await service.assignCampaignToOperacional(
      "1f625e89-cd14-4a3b-9be4-d245257ce88b",
      "negociosltda01@gmail.com",
      { email: "master@exemplo.com", role: "master" },
    );
    assert.equal(detail.assignedOperacionalEmail, "negociosltda01@gmail.com");
    const stored = new WabaCampaignIntakeRepository().getById("1f625e89-cd14-4a3b-9be4-d245257ce88b");
    assert.equal(stored?.assignedOperacionalEmail, "negociosltda01@gmail.com");
  });

  it("Claudinei vê a campanha atribuída a ele mesmo com cadastro só Black", () => {
    seed([
      intake({
        assignedOperacionalEmail: "negociosltda01@gmail.com",
      }),
    ]);
    const service = new WabaOperacionalCampanhasService();
    const items = service.listCampaigns({
      email: "negociosltda01@gmail.com",
      role: "operacional",
    });
    assert.equal(items.length, 1);
    assert.equal(items[0]?.id, "1f625e89-cd14-4a3b-9be4-d245257ce88b");
  });

  it("fila White Oficial usa a linha de fornecedor mesmo com cadastro Black", async () => {
    seed([
      intake({
        assignedOperacionalEmail: undefined,
        assignedAt: undefined,
        startedByEmail: undefined,
        status: "generated",
      }),
    ]);
    const { WabaCampaignSupplierAssignmentService } = await import(
      "../services/waba-campaign-supplier-assignment.service"
    );
    const assignment = new WabaCampaignSupplierAssignmentService();
    const stored = new WabaCampaignIntakeRepository().getById("1f625e89-cd14-4a3b-9be4-d245257ce88b");
    assert.ok(stored);
    const assigned = assignment.ensureInitialAssignment(stored);
    assert.equal(
      assigned.assignedOperacionalEmail,
      "negociosltda01@gmail.com",
      "Drax p1 não tem usuário operacional; Claudinei p2 White deve receber mesmo com cadastro Black",
    );
  });
});
