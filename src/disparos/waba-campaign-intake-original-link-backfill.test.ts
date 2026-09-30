import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { WabaCampaignIntakeRepository } from "./waba-campaign-intake.repository";
import {
  applyOriginalResponseLinkBackfill,
  runOriginalResponseLinkBackfillOneshot,
} from "./waba-campaign-intake-original-link-backfill";

const CAMPAIGN_ID = "camp-pelli-original";

describe("gravar link original da cliente", () => {
  it("preenche responseLinkOriginal a partir do link informado ou do encurtador", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "waba-original-link-"));
    const previousCwd = process.cwd();
    process.chdir(root);
    try {
      mkdirSync(path.join(root, "data"), { recursive: true });
      writeFileSync(
        path.join(root, "data", "waba-campaign-intakes.json"),
        JSON.stringify({
          version: 1,
          intakes: [
            {
              id: CAMPAIGN_ID,
              ownerEmail: "pelli@example.com",
              campaignName: "Primeiro disparo - agenda pessoal Pelli",
              regionDdd: "21",
              textOptions: ["a", "b", "c"],
              responseLink: "https://waba.draxsistemas.com.br/s/pelli01",
              responseShortUrl: "https://waba.draxsistemas.com.br/s/pelli01",
              responseShortSlug: "pelli01",
              imageFileName: "foto.jpg",
              imageStoredPath: "foto.jpg",
              spreadsheetFileName: "leads.xlsx",
              spreadsheetStoredPath: "leads.xlsx",
              importedLineCount: 10,
              plannedSendCount: 10,
              apiKind: "oficial",
              status: "generated",
              createdAt: "2026-09-25T14:23:02.000Z",
              updatedAt: "2026-09-25T14:23:02.000Z",
            },
            {
              id: "camp-com-original",
              ownerEmail: "a@example.com",
              campaignName: "Outra",
              regionDdd: "11",
              textOptions: ["a", "b", "c"],
              responseLink: "https://cliente.com/oferta",
              imageFileName: "foto.jpg",
              imageStoredPath: "foto.jpg",
              spreadsheetFileName: "leads.xlsx",
              spreadsheetStoredPath: "leads.xlsx",
              importedLineCount: 2,
              plannedSendCount: 2,
              apiKind: "oficial",
              status: "generated",
              createdAt: "2026-09-25T14:23:02.000Z",
              updatedAt: "2026-09-25T14:23:02.000Z",
            },
          ],
        }),
        "utf8",
      );

      const result = await applyOriginalResponseLinkBackfill({
        async lookup(intake) {
          if (intake.id === CAMPAIGN_ID) return "https://votepellizzari.com.br/";
          return String(intake.responseLink || "");
        },
      });
      assert.equal(result.ok, true);
      assert.equal(result.applied, 2);

      const repo = new WabaCampaignIntakeRepository();
      assert.equal(repo.getById(CAMPAIGN_ID)?.responseLinkOriginal, "https://votepellizzari.com.br/");
      assert.equal(repo.getById("camp-com-original")?.responseLinkOriginal, "https://cliente.com/oferta");

      const second = await applyOriginalResponseLinkBackfill({
        async lookup() {
          throw new Error("não deveria consultar de novo");
        },
      });
      assert.equal(second.applied, 0);
    } finally {
      process.chdir(previousCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ignora o oneshot em ambiente local", async () => {
    const previous = process.env.WABA_ENV;
    process.env.WABA_ENV = "v01";
    try {
      const result = await runOriginalResponseLinkBackfillOneshot();
      assert.equal(result.skipped, true);
    } finally {
      if (previous === undefined) delete process.env.WABA_ENV;
      else process.env.WABA_ENV = previous;
    }
  });
});
