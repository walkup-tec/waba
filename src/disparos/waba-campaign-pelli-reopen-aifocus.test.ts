import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";
import { WabaCampaignIntakeRepository } from "./waba-campaign-intake.repository";
import { toCampaignIntakeDisplayStatus } from "./waba-campaign-intake-status";
import {
  applyPelliReopenToAifocus,
  isPelliAgendaPessoalCampaignName,
  PELLI_REOPEN_CAMPAIGN_NAME,
  PELLI_REOPEN_IMAGE_FILE_NAME,
  PELLI_REOPEN_LEADS_FILE_NAME,
  PELLI_REOPEN_OPERACIONAL_EMAIL,
  PELLI_REOPEN_PLANNED_SEND_COUNT,
  PELLI_REOPEN_TEXT,
  resolvePelliReopenLeadsPath,
  runPelliReopenAifocusOneshot,
} from "./waba-campaign-pelli-reopen-aifocus";
import { dedupeOfficialCampaignLeadsFile } from "./waba-campaign-intake-oficial-dedupe";

const CAMPAIGN_ID = "camp-pelli-agenda";

const operacional = {
  getByEmail(email: string) {
    if (String(email || "").trim().toLowerCase() !== PELLI_REOPEN_OPERACIONAL_EMAIL) return null;
    return {
      id: "op-aifocus",
      fullName: "AI Focus",
      email: PELLI_REOPEN_OPERACIONAL_EMAIL,
      role: "operacional" as const,
    };
  },
};

function writeLeads(filePath: string, phones: string[]) {
  const rows = phones.map((numero) => ({ ddd: "21", numero }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Leads");
  writeFileSync(filePath, Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })));
}

function writeCampaignPng(filePath: string) {
  const buf = Buffer.alloc(24, 0);
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  buf[4] = 0x0d;
  buf[5] = 0x0a;
  buf[6] = 0x1a;
  buf[7] = 0x0a;
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(1200, 16);
  buf.writeUInt32BE(628, 20);
  writeFileSync(filePath, buf);
}

describe("reabrir Pelli na fila aifocusdev", () => {
  it("reconhece só o nome exato da agenda pessoal Pelli", () => {
    assert.equal(isPelliAgendaPessoalCampaignName(PELLI_REOPEN_CAMPAIGN_NAME), true);
    assert.equal(isPelliAgendaPessoalCampaignName("Primeiro disparo - agenda pessoal Pelli 2"), false);
    assert.equal(PELLI_REOPEN_PLANNED_SEND_COUNT, 13922);
    assert.equal(PELLI_REOPEN_LEADS_FILE_NAME, "leads-13922-envios.xlsx");
  });

  it("a planilha nova fecha em 13922 envios únicos", () => {
    const leadsPath = resolvePelliReopenLeadsPath();
    assert.equal(existsSync(leadsPath), true);
    const deduped = dedupeOfficialCampaignLeadsFile(
      readFileSync(leadsPath),
      PELLI_REOPEN_LEADS_FILE_NAME,
      PELLI_REOPEN_PLANNED_SEND_COUNT,
    );
    assert.ok(deduped.uniqueCount >= PELLI_REOPEN_PLANNED_SEND_COUNT);
    assert.equal(
      Math.min(deduped.uniqueCount, PELLI_REOPEN_PLANNED_SEND_COUNT),
      13922,
    );
  });

  it("coloca na fila Aguardando configuração, grava o texto e a planilha e zera indicadores", () => {
    const root = mkdtempSync(path.join(tmpdir(), "waba-pelli-reopen-"));
    const previousCwd = process.cwd();
    process.chdir(root);
    try {
      const dataDir = path.join(root, "data");
      const storageDir = path.join(dataDir, "campaign-intakes", CAMPAIGN_ID);
      mkdirSync(storageDir, { recursive: true });
      writeFileSync(
        path.join(dataDir, "waba-campaign-intakes.json"),
        JSON.stringify({
          version: 1,
          intakes: [
            {
              id: CAMPAIGN_ID,
              ownerEmail: "pelli@example.com",
              campaignName: PELLI_REOPEN_CAMPAIGN_NAME,
              regionDdd: "21",
              textOptions: ["texto antigo um xx", "texto antigo dois xx", "texto antigo tres xx"],
              imageFileName: "foto.jpg",
              imageStoredPath: path.join(storageDir, "foto.jpg"),
              spreadsheetFileName: "leads-antiga.xlsx",
              spreadsheetStoredPath: path.join(storageDir, "leads-antiga.xlsx"),
              importedLineCount: 8333,
              plannedSendCount: 8333,
              apiKind: "oficial",
              status: "completed",
              assignedOperacionalEmail: "negociosltda01@gmail.com",
              startedAt: "2026-09-29T13:29:15.000Z",
              startedByEmail: "negociosltda01@gmail.com",
              performanceReport: {
                totalLeads: 8333,
                sent: 5136,
                delivered: 4829,
                read: 2895,
                failed: 246,
                clicks: 22,
                source: "manual",
                filledAt: "2026-09-29T18:22:15.000Z",
                filledByEmail: "meta-lab",
              },
              createdAt: "2026-09-25T14:23:02.000Z",
              updatedAt: "2026-09-29T18:22:15.000Z",
            },
          ],
        }),
        "utf8",
      );
      const leadsPath = path.join(root, "nova-base.xlsx");
      writeLeads(leadsPath, ["920003149", "920009160", "920003149", "920011000"]);
      const imagePath = path.join(root, "pelli.png");
      writeCampaignPng(imagePath);

      const result = applyPelliReopenToAifocus({
        leadsPath,
        imagePath,
        systemUserService: operacional as never,
        voidBroadcast: false,
        now: () => "2026-09-29T22:00:00.000Z",
      });
      assert.equal(result.ok, true);
      assert.equal(result.applied, true);
      assert.equal(result.uniqueCount, 3);
      assert.equal(result.plannedSendCount, 3);

      const stored = new WabaCampaignIntakeRepository().getById(CAMPAIGN_ID);
      assert.equal(stored?.status, "generated");
      assert.equal(stored?.ownerEmail, "pelli@example.com");
      assert.equal(stored?.assignedOperacionalEmail, PELLI_REOPEN_OPERACIONAL_EMAIL);
      assert.equal(stored?.plannedSendCount, 3);
      assert.equal(stored?.importedLineCount, 3);
      assert.equal(stored?.performanceReport, undefined);
      assert.equal(stored?.startedAt, undefined);
      assert.equal(stored?.textOptions?.[0], PELLI_REOPEN_TEXT);
      assert.equal(stored?.textOptions?.[1], PELLI_REOPEN_TEXT);
      assert.equal(stored?.textOptions?.[2], PELLI_REOPEN_TEXT);
      assert.equal(stored?.spreadsheetFileName, PELLI_REOPEN_LEADS_FILE_NAME);
      assert.equal(stored?.imageFileName, PELLI_REOPEN_IMAGE_FILE_NAME);
      assert.equal(stored?.campaignMediaKind, "image");
      assert.equal(existsSync(String(stored?.spreadsheetStoredPath || "")), true);
      assert.equal(existsSync(String(stored?.imageStoredPath || "")), true);
      assert.equal(existsSync(String(stored?.spreadsheetTrimmedPath || "")), true);
      assert.equal(toCampaignIntakeDisplayStatus(stored!.status, "operacional"), "Aguardando configuração");

      const raw = JSON.parse(readFileSync(path.join(dataDir, "waba-campaign-intakes.json"), "utf8"));
      assert.equal(Object.prototype.hasOwnProperty.call(raw.intakes[0], "performanceReport"), false);

      const second = applyPelliReopenToAifocus({
        leadsPath,
        imagePath,
        systemUserService: operacional as never,
        voidBroadcast: false,
        now: () => "2026-09-29T22:05:00.000Z",
      });
      assert.equal(second.ok, true);
      assert.equal(second.skipped, true);
    } finally {
      process.chdir(previousCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("atualiza só a imagem se a Pelli já estiver na fila", () => {
    const root = mkdtempSync(path.join(tmpdir(), "waba-pelli-image-"));
    const previousCwd = process.cwd();
    process.chdir(root);
    try {
      const dataDir = path.join(root, "data");
      const storageDir = path.join(dataDir, "campaign-intakes", CAMPAIGN_ID);
      mkdirSync(storageDir, { recursive: true });
      writeFileSync(path.join(storageDir, "foto.jpg"), "old");
      writeFileSync(
        path.join(dataDir, "waba-campaign-intakes.json"),
        JSON.stringify({
          version: 1,
          intakes: [
            {
              id: CAMPAIGN_ID,
              ownerEmail: "pelli@example.com",
              campaignName: PELLI_REOPEN_CAMPAIGN_NAME,
              regionDdd: "21",
              textOptions: [PELLI_REOPEN_TEXT, PELLI_REOPEN_TEXT, PELLI_REOPEN_TEXT],
              imageFileName: "foto.jpg",
              imageStoredPath: path.join(storageDir, "foto.jpg"),
              spreadsheetFileName: PELLI_REOPEN_LEADS_FILE_NAME,
              spreadsheetStoredPath: path.join(storageDir, PELLI_REOPEN_LEADS_FILE_NAME),
              importedLineCount: 3,
              plannedSendCount: 3,
              apiKind: "oficial",
              status: "generated",
              assignedOperacionalEmail: PELLI_REOPEN_OPERACIONAL_EMAIL,
              createdAt: "2026-09-25T14:23:02.000Z",
              updatedAt: "2026-09-29T22:00:00.000Z",
            },
          ],
        }),
        "utf8",
      );
      const leadsPath = path.join(root, "nova-base.xlsx");
      writeLeads(leadsPath, ["920003149", "920009160", "920011000"]);
      const imagePath = path.join(root, "pelli.png");
      writeCampaignPng(imagePath);

      const result = applyPelliReopenToAifocus({
        leadsPath,
        imagePath,
        systemUserService: operacional as never,
        voidBroadcast: false,
        now: () => "2026-09-30T12:00:00.000Z",
      });
      assert.equal(result.ok, true);
      assert.equal(result.applied, true);
      assert.match(String(result.message || ""), /Imagem da Pelli atualizada/);

      const stored = new WabaCampaignIntakeRepository().getById(CAMPAIGN_ID);
      assert.equal(stored?.status, "generated");
      assert.equal(stored?.assignedOperacionalEmail, PELLI_REOPEN_OPERACIONAL_EMAIL);
      assert.equal(stored?.imageFileName, PELLI_REOPEN_IMAGE_FILE_NAME);
      assert.equal(existsSync(String(stored?.imageStoredPath || "")), true);
      assert.equal(stored?.plannedSendCount, 3);
    } finally {
      process.chdir(previousCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ignora o oneshot em ambiente local", () => {
    const previous = process.env.WABA_ENV;
    process.env.WABA_ENV = "v01";
    try {
      const result = runPelliReopenAifocusOneshot();
      assert.equal(result.skipped, true);
    } finally {
      if (previous === undefined) delete process.env.WABA_ENV;
      else process.env.WABA_ENV = previous;
    }
  });
});
