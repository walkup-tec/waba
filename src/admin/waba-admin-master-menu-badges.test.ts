import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { WALKUP_MASTER_EMAIL } from "../users/waba-subscriber-master-visibility";

const EDUARDO = "eduardo.master@exemplo.com";
const HIDDEN_EMAIL = "raphaela.oculta@exemplo.com";
const VISIBLE_EMAIL = "cliente.visivel@exemplo.com";
const SEEN_AT = "2026-09-24T10:00:00.000Z";
const NEW_AT = "2026-09-25T12:00:00.000Z";

const originalCwd = process.cwd();
const dataRoot = mkdtempSync(path.join(os.tmpdir(), "waba-eduardo-badges-"));

function writeJson(fileName: string, payload: unknown) {
  writeFileSync(path.join(process.cwd(), "data", fileName), JSON.stringify(payload, null, 2));
}

function seed() {
  mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
  writeJson("waba-system-users.json", {
    version: 1,
    users: [
      {
        id: "eduardo",
        fullName: "Eduardo Master",
        email: EDUARDO,
        passwordHash: "x",
        role: "master",
        createdAt: NEW_AT,
        updatedAt: NEW_AT,
      },
    ],
  });
  writeJson("waba-subscribers.json", {
    version: 1,
    subscribers: [
      {
        id: "sub-hidden",
        email: HIDDEN_EMAIL,
        passwordHash: "x",
        fullName: "Raphaela oculta",
        whatsapp: "11911111111",
        phone: "11911111111",
        cpfCnpj: "00000000191",
        segment: "outros",
        visibleToMasters: false,
        createdAt: NEW_AT,
        updatedAt: NEW_AT,
      },
      {
        id: "sub-visible",
        email: VISIBLE_EMAIL,
        passwordHash: "x",
        fullName: "Cliente visível",
        whatsapp: "11922222222",
        phone: "11922222222",
        cpfCnpj: "00000000192",
        segment: "outros",
        visibleToMasters: true,
        createdAt: NEW_AT,
        updatedAt: NEW_AT,
      },
    ],
  });
  writeJson("waba-campaign-intakes.json", {
    version: 1,
    intakes: [
      {
        id: "camp-hidden-1",
        ownerEmail: HIDDEN_EMAIL,
        campaignName: "Raphaela 01",
        regionDdd: "11",
        textOptions: ["a", "b", "c"],
        imageFileName: "a.jpg",
        imageStoredPath: "/tmp/a.jpg",
        spreadsheetFileName: "a.xlsx",
        spreadsheetStoredPath: "/tmp/a.xlsx",
        importedLineCount: 1000,
        plannedSendCount: 1000,
        status: "generated",
        createdAt: NEW_AT,
        updatedAt: NEW_AT,
      },
      {
        id: "camp-hidden-2",
        ownerEmail: HIDDEN_EMAIL,
        campaignName: "Raphaela 02",
        regionDdd: "11",
        textOptions: ["a", "b", "c"],
        imageFileName: "a.jpg",
        imageStoredPath: "/tmp/a.jpg",
        spreadsheetFileName: "a.xlsx",
        spreadsheetStoredPath: "/tmp/a.xlsx",
        importedLineCount: 1000,
        plannedSendCount: 1000,
        status: "generated",
        createdAt: NEW_AT,
        updatedAt: NEW_AT,
      },
      {
        id: "camp-visible",
        ownerEmail: VISIBLE_EMAIL,
        campaignName: "Campanha visível",
        regionDdd: "11",
        textOptions: ["a", "b", "c"],
        imageFileName: "a.jpg",
        imageStoredPath: "/tmp/a.jpg",
        spreadsheetFileName: "a.xlsx",
        spreadsheetStoredPath: "/tmp/a.xlsx",
        importedLineCount: 500,
        plannedSendCount: 500,
        status: "generated",
        createdAt: NEW_AT,
        updatedAt: NEW_AT,
      },
    ],
  });
  writeJson("waba-billing-orders.json", [
    {
      id: "ord-hidden-1",
      product: "waba-disparos",
      apiKind: "oficial",
      customerName: "Raphaela",
      ownerEmail: HIDDEN_EMAIL,
      whatsapp: "11911111111",
      cpfCnpj: "00000000191",
      billingType: "PIX",
      valueCents: 10000,
      status: "pending_payment",
      asaasExternalReference: "ref-1",
      createdAt: NEW_AT,
      updatedAt: NEW_AT,
    },
    {
      id: "ord-hidden-2",
      product: "waba-disparos",
      apiKind: "oficial",
      customerName: "Raphaela",
      ownerEmail: HIDDEN_EMAIL,
      whatsapp: "11911111111",
      cpfCnpj: "00000000191",
      billingType: "PIX",
      valueCents: 20000,
      status: "pending_payment",
      asaasExternalReference: "ref-2",
      createdAt: NEW_AT,
      updatedAt: NEW_AT,
    },
    {
      id: "ord-hidden-3",
      product: "waba-disparos",
      apiKind: "oficial",
      customerName: "Raphaela",
      ownerEmail: HIDDEN_EMAIL,
      whatsapp: "11911111111",
      cpfCnpj: "00000000191",
      billingType: "PIX",
      valueCents: 30000,
      status: "pending_payment",
      asaasExternalReference: "ref-3",
      createdAt: NEW_AT,
      updatedAt: NEW_AT,
    },
    {
      id: "ord-visible",
      product: "waba-disparos",
      apiKind: "oficial",
      customerName: "Visível",
      ownerEmail: VISIBLE_EMAIL,
      whatsapp: "11922222222",
      cpfCnpj: "00000000192",
      billingType: "PIX",
      valueCents: 15000,
      status: "pending_payment",
      asaasExternalReference: "ref-4",
      createdAt: NEW_AT,
      updatedAt: NEW_AT,
    },
  ]);
  writeJson("waba-support-tickets.json", {
    version: 1,
    tickets: [
      {
        id: "t-hidden",
        displayId: "1",
        ownerEmail: HIDDEN_EMAIL,
        ownerName: "Raphaela",
        status: "open",
        title: "Chamado oculto",
        description: "x",
        masterResponse: "",
        attachments: [],
        createdAt: NEW_AT,
        updatedAt: NEW_AT,
        submittedAt: NEW_AT,
      },
      {
        id: "t-visible",
        displayId: "2",
        ownerEmail: VISIBLE_EMAIL,
        ownerName: "Visível",
        status: "open",
        title: "Chamado visível",
        description: "x",
        masterResponse: "",
        attachments: [],
        createdAt: NEW_AT,
        updatedAt: NEW_AT,
        submittedAt: NEW_AT,
      },
    ],
  });
  writeJson("waba-master-menu-seen.json", {
    version: 1,
    masters: {
      [EDUARDO]: {
        "admin-assinantes": SEEN_AT,
        "admin-campanhas": SEEN_AT,
        "admin-usuarios": SEEN_AT,
        "admin-financeiro": SEEN_AT,
        "admin-chamados": SEEN_AT,
      },
      [WALKUP_MASTER_EMAIL]: {
        "admin-assinantes": SEEN_AT,
        "admin-campanhas": SEEN_AT,
        "admin-usuarios": SEEN_AT,
        "admin-financeiro": SEEN_AT,
        "admin-chamados": SEEN_AT,
      },
    },
  });
}

describe("badges do menu master respeitam Visível", () => {
  before(() => {
    process.chdir(dataRoot);
    seed();
  });

  after(() => {
    process.chdir(originalCwd);
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("Eduardo não conta campanha, financeiro, assinante nem chamado de Visível off", async () => {
    const { WabaAdminMasterMenuBadgesService } = await import("./waba-admin-master-menu-badges.service");
    const badges = new WabaAdminMasterMenuBadgesService().getBadges(EDUARDO);
    assert.equal(badges["admin-campanhas"], 1);
    assert.equal(badges["admin-financeiro"], 1);
    assert.equal(badges["admin-assinantes"], 1);
    assert.equal(badges["admin-chamados"], 1);
  });

  it("Walkup continua vendo as ações do assinante oculto", async () => {
    const { WabaAdminMasterMenuBadgesService } = await import("./waba-admin-master-menu-badges.service");
    const badges = new WabaAdminMasterMenuBadgesService().getBadges(WALKUP_MASTER_EMAIL);
    assert.equal(badges["admin-campanhas"], 3);
    assert.equal(badges["admin-financeiro"], 4);
    assert.equal(badges["admin-assinantes"], 2);
    assert.equal(badges["admin-chamados"], 2);
  });
});
