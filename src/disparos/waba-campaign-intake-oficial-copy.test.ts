import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import type { WabaCampaignIntake } from "./waba-campaign-intake.repository";

const sourceIntake = (overrides: Partial<WabaCampaignIntake> = {}): WabaCampaignIntake => ({
  id: "src-oficial-1",
  ownerEmail: "cliente@exemplo.com",
  campaignName: "Campanha CLT",
  regionDdd: "51",
  textOptions: ["texto um xx", "texto dois xx", "texto tres xx"],
  responseLink: "https://exemplo.com/oferta",
  imageFileName: "foto.jpg",
  imageStoredPath: "",
  spreadsheetFileName: "leads.xlsx",
  spreadsheetStoredPath: "",
  importedLineCount: 5000,
  plannedSendCount: 5000,
  apiKind: "oficial",
  status: "generated",
  createdAt: "2026-09-19T12:00:00.000Z",
  updatedAt: "2026-09-19T12:00:00.000Z",
  ...overrides,
});

describe("duplicar campanha API Oficial", () => {
  it("monta o nome da cópia sem repetir o sufixo", async () => {
    const { buildOfficialCampaignCopyName } = await import("./waba-campaign-intake-oficial-copy");
    assert.equal(buildOfficialCampaignCopyName("Campanha CLT"), "Campanha CLT (cópia)");
    assert.equal(buildOfficialCampaignCopyName("Campanha CLT (cópia)"), "Campanha CLT (cópia 2)");
    assert.equal(buildOfficialCampaignCopyName("Campanha CLT (cópia 2)"), "Campanha CLT (cópia 3)");
  });

  it("só duplica Gerada e Erro Reportado da API Oficial do dono", async () => {
    const {
      canDuplicateOfficialCampaign,
      canEditOfficialCampaign,
      assertCanDuplicateOfficialCampaign,
    } = await import("./waba-campaign-intake-oficial-copy");
    const owner = "cliente@exemplo.com";
    assert.equal(canDuplicateOfficialCampaign(sourceIntake(), owner), true);
    assert.equal(
      canDuplicateOfficialCampaign(sourceIntake({ status: "error_reported" }), owner),
      true,
    );
    assert.equal(canDuplicateOfficialCampaign(sourceIntake({ status: "in_progress" }), owner), false);
    assert.equal(canDuplicateOfficialCampaign(sourceIntake({ status: "completed" }), owner), false);
    assert.equal(canDuplicateOfficialCampaign(sourceIntake({ apiKind: "alternativa" }), owner), false);
    assert.equal(canDuplicateOfficialCampaign(sourceIntake(), "outro@exemplo.com"), false);
    assert.equal(canEditOfficialCampaign(sourceIntake(), owner), true);
    assert.equal(canEditOfficialCampaign(sourceIntake({ status: "error_reported" }), owner), false);

    assert.throws(
      () => assertCanDuplicateOfficialCampaign(sourceIntake({ status: "completed" }), owner),
      /Gerada ou Erro Reportado/,
    );
  });

  it("copia arquivos, zera relatório e assume status Gerada", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "waba-oficial-copy-"));
    const previousCwd = process.cwd();
    process.chdir(root);
    try {
      const sourceId = "src-oficial-1";
      const dataDir = path.join(root, "data");
      const sourceDir = path.join(dataDir, "campaign-intakes", sourceId);
      mkdirSync(sourceDir, { recursive: true });
      writeFileSync(path.join(sourceDir, "foto.jpg"), Buffer.from("img"));
      writeFileSync(path.join(sourceDir, "leads.xlsx"), Buffer.from("xls"));
      writeFileSync(path.join(dataDir, "waba-campaign-intakes.json"), JSON.stringify({ version: 1, intakes: [] }));

      const { buildOfficialCampaignDuplicate } = await import("./waba-campaign-intake-oficial-copy");
      const source = sourceIntake({
        imageStoredPath: path.join(sourceDir, "foto.jpg"),
        spreadsheetStoredPath: path.join(sourceDir, "leads.xlsx"),
        errorReport: {
          justification: "falhou",
          reportedAt: "2026-09-19T12:00:00.000Z",
          reportedByEmail: "op@exemplo.com",
        },
        performanceReport: {
          totalLeads: 10,
          sent: 0,
          delivered: 0,
          read: 0,
          failed: 10,
          filledAt: "2026-09-19T12:00:00.000Z",
          filledByEmail: "op@exemplo.com",
        },
        assignedOperacionalEmail: "op@exemplo.com",
        status: "error_reported",
      });
      const clone = buildOfficialCampaignDuplicate(source, {
        nextId: "dup-oficial-1",
        now: new Date("2026-09-20T15:00:00.000Z"),
      });
      assert.equal(clone.id, "dup-oficial-1");
      assert.notEqual(clone.id, source.id);
      assert.equal(clone.campaignName, "Campanha CLT (cópia)");
      assert.equal(clone.status, "generated");
      assert.equal(clone.apiKind, "oficial");
      assert.equal(clone.ownerEmail, source.ownerEmail);
      assert.equal(clone.plannedSendCount, 5000);
      assert.equal(clone.errorReport, undefined);
      assert.equal(clone.performanceReport, undefined);
      assert.equal(clone.assignedOperacionalEmail, undefined);
      assert.equal(readFileSync(clone.imageStoredPath, "utf8"), "img");
      assert.equal(readFileSync(clone.spreadsheetStoredPath, "utf8"), "xls");
    } finally {
      process.chdir(previousCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("interface das campanhas oficiais", () => {
  it("tem ícone duplicar, botão editar e modal do wizard", () => {
    const html = readFileSync(path.join(__dirname, "../../index.html"), "utf8");
    assert.match(html, /btn-campaign-intake-duplicate/);
    assert.match(html, /btn-campaign-intake-edit/);
    assert.match(html, /id="dis-campaign-edit-overlay"/);
    assert.match(html, /id="dis-campaign-wizard-home"/);
    assert.match(html, /function duplicateDisparosIntakeCampaign/);
    assert.match(html, /function openDisCampaignIntakeEditModal/);
    assert.match(html, /Salvar campanha/);
    assert.match(html, /\/disparos\/campanhas\/intake\/\$\{/);
    assert.match(html, /WABA_CAMPAIGN_INTAKE_API_VERSION_EXPECTED = 8/);
  });
});
