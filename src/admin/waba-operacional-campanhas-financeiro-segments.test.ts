import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { WabaOperacionalCampanhasService } from "./waba-operacional-campanhas.service";
import { WabaCampaignIntakeRepository, type WabaCampaignIntake } from "../disparos/waba-campaign-intake.repository";
import { WabaCampaignSupplierAssignmentService } from "../services/waba-campaign-supplier-assignment.service";

process.env.WABA_SKIP_CLEISON_BALANCE_REPAIR = "1";
process.env.WABA_FINANCEIRO_SPLIT_PAYOUT_ENABLED = "0";

const originalCwd = process.cwd();
const dataRoot = mkdtempSync(path.join(os.tmpdir(), "waba-financeiro-segments-"));
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
    status: "generated",
    createdAt: now,
    updatedAt: now,
    creditFunding: { fromPaid: 9088, fromBonus: 0 },
    ...overrides,
  };
}

function seed() {
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
        id: "drax-1",
        fullName: "Drax",
        email: "drax@draxsistemas.com.br",
        passwordHash: "x",
        role: "operacional",
        operacionalDispatchesApis: ["oficial"],
        operacionalSegments: ["outros"],
        menuPermissions: { dashboard: true, "admin-campanhas": true },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "erick-1",
        fullName: "Erick Sales",
        email: "erick@exemplo.com",
        passwordHash: "x",
        role: "operacional",
        operacionalDispatchesApis: ["oficial"],
        operacionalSegments: ["bets", "outros"],
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
  writeJson("waba-campaign-intakes.json", {
    version: 1,
    intakes: [
      intake({
        assignedOperacionalEmail: "op_douglas@draxsistemas.com.br",
        assignedAt: now,
      }),
    ],
  });
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
        id: "sup-erick-white",
        name: "Erick Sales",
        apiKind: "oficial",
        systemUserEmail: "erick@exemplo.com",
        segment: "outros",
        priority: 3,
        costPerShipmentCents: 16,
        pixKey: "16432854679",
        active: true,
      },
      {
        id: "sup-erick-black",
        name: "Erick Sales",
        apiKind: "oficial",
        systemUserEmail: "erick@exemplo.com",
        segment: "bets",
        priority: 2,
        costPerShipmentCents: 23,
        pixKey: "16432854679",
        active: true,
      },
      {
        id: "sup-claudinei-black",
        name: "Claudinei Fernandes",
        apiKind: "oficial",
        systemUserEmail: "negociosltda01@gmail.com",
        segment: "bets",
        priority: 1,
        costPerShipmentCents: 27,
        pixKey: "45987159873",
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

describe("transferência reconhece Black/White pelas linhas do Financeiro", () => {
  before(() => {
    mkdirSync(path.join(dataRoot, "data"), { recursive: true });
    process.chdir(dataRoot);
  });

  after(() => {
    process.chdir(originalCwd);
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("lista Claudinei como Black + White e Drax só como White numa campanha White", () => {
    seed();
    const items = new WabaOperacionalCampanhasService().listTransferOperacionais(
      "1f625e89-cd14-4a3b-9be4-d245257ce88b",
      { email: "master@exemplo.com", role: "master" },
    );
    const claudinei = items.find((row) => row.email === "negociosltda01@gmail.com");
    const drax = items.find((row) => row.email === "drax@draxsistemas.com.br");
    const erick = items.find((row) => row.email === "erick@exemplo.com");
    assert.ok(claudinei, "Claudinei precisa aparecer: tem linha White no Financeiro");
    assert.ok(drax, "Drax precisa aparecer");
    assert.ok(erick, "Erick precisa aparecer");
    assert.equal(claudinei?.segmentLabel, "Black + White");
    assert.equal(drax?.segmentLabel, "White");
    assert.equal(erick?.segmentLabel, "Black + White");
  });

  it("mantém a prioridade White: Drax p1, não o Claudinei", () => {
    seed();
    writeJson("waba-campaign-intakes.json", {
      version: 1,
      intakes: [intake({ assignedOperacionalEmail: undefined, assignedAt: undefined })],
    });
    const stored = new WabaCampaignIntakeRepository().getById("1f625e89-cd14-4a3b-9be4-d245257ce88b");
    assert.ok(stored);
    const next = new WabaCampaignSupplierAssignmentService().pickNextSupplier(stored, new Set());
    assert.equal(next?.systemUserEmail, "drax@draxsistemas.com.br");
  });

  it("se Drax não puder, a fila White segue para o Claudinei p2 mesmo com cadastro só Black", () => {
    seed();
    writeJson("waba-campaign-intakes.json", {
      version: 1,
      intakes: [intake({ assignedOperacionalEmail: undefined, assignedAt: undefined })],
    });
    const stored = new WabaCampaignIntakeRepository().getById("1f625e89-cd14-4a3b-9be4-d245257ce88b");
    assert.ok(stored);
    const next = new WabaCampaignSupplierAssignmentService().pickNextSupplier(
      stored,
      new Set(["drax@draxsistemas.com.br"]),
    );
    assert.equal(next?.systemUserEmail, "negociosltda01@gmail.com");
  });

  it("master transfere a campanha White para o Claudinei", async () => {
    seed();
    const detail = await new WabaOperacionalCampanhasService().assignCampaignToOperacional(
      "1f625e89-cd14-4a3b-9be4-d245257ce88b",
      "negociosltda01@gmail.com",
      { email: "master@exemplo.com", role: "master" },
    );
    assert.equal(detail.assignedOperacionalEmail, "negociosltda01@gmail.com");
    const visible = new WabaOperacionalCampanhasService().listCampaigns({
      email: "negociosltda01@gmail.com",
      role: "operacional",
    });
    assert.equal(visible[0]?.id, "1f625e89-cd14-4a3b-9be4-d245257ce88b");
  });
});
