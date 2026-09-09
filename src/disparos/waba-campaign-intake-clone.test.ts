import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";

describe("clone campaign intake", () => {
  it("copia a campanha com 1000 envios e recorta a planilha", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "waba-clone-"));
    const previousCwd = process.cwd();
    process.chdir(root);
    try {
      const sourceId = "66c69911-9c2f-42a2-7aeab1b15466";
      const dataDir = path.join(root, "data");
      const sourceDir = path.join(dataDir, "campaign-intakes", sourceId);
      mkdirSync(sourceDir, { recursive: true });
      const rows = Array.from({ length: 12 }, (_, index) => ({
        telefone: `1199999${String(1000 + index)}`,
        nome: `Lead ${index + 1}`,
      }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Leads");
      const sheetPath = path.join(sourceDir, "leads.xlsx");
      writeFileSync(sheetPath, Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })));
      writeFileSync(
        path.join(dataDir, "waba-campaign-intakes.json"),
        JSON.stringify({
          version: 1,
          intakes: [
            {
              id: sourceId,
              ownerEmail: "drax@draxsistemas.com.br",
              campaignName: "Opt in PTX",
              regionDdd: "11",
              textOptions: ["a", "b", "c"],
              imageFileName: "foto.jpg",
              imageStoredPath: path.join(sourceDir, "foto.jpg"),
              spreadsheetFileName: "leads.xlsx",
              spreadsheetStoredPath: sheetPath,
              importedLineCount: 2996,
              plannedSendCount: 2996,
              apiKind: "oficial",
              status: "completed",
              performanceReport: { totalLeads: 2996, sent: 2996, delivered: 1, read: 1, failed: 0, filledAt: "2026-09-07T17:47:00.000Z", filledByEmail: "x" },
              createdAt: "2026-09-07T17:47:00.000Z",
              updatedAt: "2026-09-07T17:47:00.000Z",
            },
          ],
        }),
        "utf8",
      );
      writeFileSync(path.join(sourceDir, "foto.jpg"), Buffer.from("x"));

      const { cloneCampaignIntakeWithPlannedSends } = await import("./waba-campaign-intake-clone");
      const first = cloneCampaignIntakeWithPlannedSends({
        sourceId,
        campaignName: "Opt in PTX",
        plannedSendCount: 1000,
        requestId: "opt-in-ptx-1000-test",
      });
      assert.equal(first.skipped, false);
      assert.equal(first.intake.plannedSendCount, 1000);
      assert.equal(first.intake.importedLineCount, 1000);
      assert.equal(first.intake.status, "generated");
      assert.equal(first.intake.campaignName, "Opt in PTX");
      assert.equal(first.intake.ownerEmail, "drax@draxsistemas.com.br");
      assert.equal(first.intake.id === sourceId, false);
      assert.equal(first.intake.performanceReport, undefined);

      const trimmed = XLSX.readFile(first.intake.spreadsheetTrimmedPath || "");
      const trimmedRows = XLSX.utils.sheet_to_json(trimmed.Sheets[trimmed.SheetNames[0]]);
      assert.equal(trimmedRows.length, 12);

      const second = cloneCampaignIntakeWithPlannedSends({
        sourceId,
        campaignName: "Opt in PTX",
        plannedSendCount: 1000,
        requestId: "opt-in-ptx-1000-test",
      });
      assert.equal(second.skipped, true);
      assert.equal(second.intake.id, first.intake.id);
    } finally {
      process.chdir(previousCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
