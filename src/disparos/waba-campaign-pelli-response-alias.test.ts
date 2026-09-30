import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { WabaCampaignIntakeRepository } from "./waba-campaign-intake.repository";
import {
  applyPelliResponseAlias,
  PELLI_ORIGINAL_RESPONSE_LINK,
  PELLI_RESPONSE_SHORT_SLUG,
  PELLI_RESPONSE_SHORT_URL,
  runPelliResponseAliasOneshot,
} from "./waba-campaign-pelli-response-alias";
import { PELLI_REOPEN_CAMPAIGN_NAME } from "./waba-campaign-pelli-reopen-aifocus";
import { destinationUrlForShortRedirect } from "../shortener/waba-shortener.service";
import type { WabaShortLinkRecord } from "../shortener/waba-shortener.repository";

describe("alias da Pelli para o grupo do WhatsApp", () => {
  it("o redirect do /s tira o nonce de tracking", () => {
    assert.equal(
      destinationUrlForShortRedirect(
        `${PELLI_ORIGINAL_RESPONSE_LINK}?_n8n_link_nonce=6589823-1`,
      ),
      PELLI_ORIGINAL_RESPONSE_LINK,
    );
    assert.equal(destinationUrlForShortRedirect(PELLI_ORIGINAL_RESPONSE_LINK), PELLI_ORIGINAL_RESPONSE_LINK);
  });

  it("grava o destino do n6589823 e o link original da campanha", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "waba-pelli-alias-"));
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
              id: "camp-pelli-agenda",
              ownerEmail: "pelli@example.com",
              campaignName: PELLI_REOPEN_CAMPAIGN_NAME,
              regionDdd: "21",
              textOptions: ["a", "b", "c"],
              responseLink: "https://waba.draxsistemas.com.br/s/n6589823",
              responseShortUrl: "https://waba.draxsistemas.com.br/s/n6589823",
              responseShortSlug: "n6589823",
              responseLinkOriginal: "https://votepellizzari.com.br/",
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
          ],
        }),
        "utf8",
      );

      const store: WabaShortLinkRecord[] = [
        {
          id: "link-1",
          slug: PELLI_RESPONSE_SHORT_SLUG,
          longUrl: `${PELLI_ORIGINAL_RESPONSE_LINK}?_n8n_link_nonce=6589823-1`,
          tenantId: "pelli@example.com",
          createdAt: "2026-09-25T14:23:02.000Z",
          clicks: 3,
        },
      ];

      const result = await applyPelliResponseAlias({
        intakeRepository: new WabaCampaignIntakeRepository(),
        async findBySlug(slug) {
          return store.find((row) => row.slug === slug) || null;
        },
        async updateLongUrl(slug, longUrl, extras) {
          const row = store.find((item) => item.slug === slug);
          if (!row) return null;
          row.longUrl = longUrl;
          if (extras?.campaignId) row.campaignId = extras.campaignId;
          if (extras?.intakeCampaignId) row.intakeCampaignId = extras.intakeCampaignId;
          return row;
        },
        async createRecord() {
          throw new Error("não deveria criar slug novo");
        },
        now: () => "2026-09-30T12:00:00.000Z",
      });

      assert.equal(result.ok, true);
      assert.equal(result.applied, true);
      assert.equal(store[0]?.longUrl, PELLI_ORIGINAL_RESPONSE_LINK);
      assert.equal(store[0]?.campaignId, "camp-pelli-agenda");

      const saved = new WabaCampaignIntakeRepository().getById("camp-pelli-agenda");
      assert.equal(saved?.responseLinkOriginal, PELLI_ORIGINAL_RESPONSE_LINK);
      assert.equal(saved?.responseShortSlug, PELLI_RESPONSE_SHORT_SLUG);
      assert.equal(saved?.responseShortUrl, PELLI_RESPONSE_SHORT_URL);
    } finally {
      process.chdir(previousCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ignora o oneshot em ambiente local", async () => {
    const previous = process.env.WABA_ENV;
    process.env.WABA_ENV = "v01";
    try {
      const result = await runPelliResponseAliasOneshot();
      assert.equal(result.skipped, true);
    } finally {
      if (previous === undefined) delete process.env.WABA_ENV;
      else process.env.WABA_ENV = previous;
    }
  });
});
