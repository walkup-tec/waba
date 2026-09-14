import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  VITORIA_DA_CONQUISTA_CAMPAIGN_NAME,
  VITORIA_DA_CONQUISTA_SUBSCRIBER_ID,
  ensureVitoriaDaConquistaIntakeShortUrlByCampaignId,
  isVitoriaDaConquistaCampaignName,
  runVitoriaDaConquistaShortUrlOneshot,
  shouldBackfillVitoriaDaConquistaShortUrl,
} from "./waba-campaign-intake-vitoria-short-url";
import { WabaCampaignIntakeRepository } from "./waba-campaign-intake.repository";

const SUBSCRIBER_ID = VITORIA_DA_CONQUISTA_SUBSCRIBER_ID;
const OWNER_EMAIL = "assinante.vitoria@exemplo.com";
const CAMPAIGN_ID = "camp-vitoria-conquista-1";

describe("URL curta Vitoria da Conquista", () => {
  it("reconhece o nome da campanha com acento e espaços extras", () => {
    assert.equal(isVitoriaDaConquistaCampaignName("Vitória da Conquista"), true);
    assert.equal(isVitoriaDaConquistaCampaignName("  VITORIA   DA CONQUISTA  "), true);
    assert.equal(isVitoriaDaConquistaCampaignName("Vitoria da Conquista 2"), false);
  });

  it("só incorpora a URL desta assinante e desta campanha quando ainda não há /s/{slug}", () => {
    assert.equal(
      shouldBackfillVitoriaDaConquistaShortUrl({
        subscriberId: SUBSCRIBER_ID,
        campaignName: VITORIA_DA_CONQUISTA_CAMPAIGN_NAME,
        responseLink: "https://cliente.com/promocao",
      }),
      true,
    );
    assert.equal(
      shouldBackfillVitoriaDaConquistaShortUrl({
        subscriberId: "outro-assinante",
        campaignName: VITORIA_DA_CONQUISTA_CAMPAIGN_NAME,
        responseLink: "https://cliente.com/promocao",
      }),
      false,
    );
    assert.equal(
      shouldBackfillVitoriaDaConquistaShortUrl({
        subscriberId: SUBSCRIBER_ID,
        campaignName: VITORIA_DA_CONQUISTA_CAMPAIGN_NAME,
        responseLink: "https://cliente.com/promocao",
        responseShortUrl: "https://wabadisparos.com.br/s/abc1234",
        responseShortSlug: "abc1234",
      }),
      false,
    );
    assert.equal(
      shouldBackfillVitoriaDaConquistaShortUrl({
        subscriberId: SUBSCRIBER_ID,
        campaignName: VITORIA_DA_CONQUISTA_CAMPAIGN_NAME,
      }),
      false,
    );
  });

  it("gera a URL do sistema a partir do link informado no detalhe e persiste no registro", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "waba-vitoria-short-"));
    const previousCwd = process.cwd();
    process.chdir(root);
    try {
      const dataDir = path.join(root, "data");
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(
        path.join(dataDir, "waba-subscribers.json"),
        JSON.stringify({
          version: 1,
          subscribers: [
            {
              id: SUBSCRIBER_ID,
              email: OWNER_EMAIL,
              passwordHash: "x",
              fullName: "Assinante Vitoria",
              whatsapp: "77999999999",
              phone: "77999999999",
              cpfCnpj: "00000000000",
              createdAt: "2026-09-01T12:00:00.000Z",
              updatedAt: "2026-09-01T12:00:00.000Z",
            },
          ],
        }),
        "utf8",
      );
      writeFileSync(
        path.join(dataDir, "waba-campaign-intakes.json"),
        JSON.stringify({
          version: 1,
          intakes: [
            {
              id: CAMPAIGN_ID,
              ownerEmail: OWNER_EMAIL,
              campaignName: "Vitória da Conquista",
              regionDdd: "77",
              textOptions: ["a", "b", "c"],
              responseLink: "https://cliente.com/promocao-vitoria",
              imageFileName: "foto.jpg",
              imageStoredPath: path.join(dataDir, "foto.jpg"),
              spreadsheetFileName: "leads.xlsx",
              spreadsheetStoredPath: path.join(dataDir, "leads.xlsx"),
              importedLineCount: 100,
              plannedSendCount: 100,
              apiKind: "alternativa",
              status: "generated",
              createdAt: "2026-09-13T12:00:00.000Z",
              updatedAt: "2026-09-13T12:00:00.000Z",
            },
          ],
        }),
        "utf8",
      );

      const attached: Array<{ slug: string; campaignId: string }> = [];
      const created = await ensureVitoriaDaConquistaIntakeShortUrlByCampaignId(CAMPAIGN_ID, {
        async createShortUrl(input) {
          assert.equal(input.destinationUrl, "https://cliente.com/promocao-vitoria");
          assert.equal(input.tenantId, OWNER_EMAIL);
          return "https://wabadisparos.com.br/s/vitoria1";
        },
        async attachCampaign(slug, campaignId) {
          attached.push({ slug, campaignId });
          return true;
        },
      });
      assert.equal(created?.shortUrl, "https://wabadisparos.com.br/s/vitoria1");
      assert.equal(created?.shortSlug, "vitoria1");
      assert.deepEqual(attached, [{ slug: "vitoria1", campaignId: CAMPAIGN_ID }]);

      const stored = new WabaCampaignIntakeRepository().getById(CAMPAIGN_ID);
      assert.equal(stored?.responseLink, "https://cliente.com/promocao-vitoria");
      assert.equal(stored?.responseShortUrl, "https://wabadisparos.com.br/s/vitoria1");
      assert.equal(stored?.responseShortSlug, "vitoria1");

      const second = await ensureVitoriaDaConquistaIntakeShortUrlByCampaignId(CAMPAIGN_ID, {
        async createShortUrl() {
          throw new Error("não deveria criar de novo");
        },
      });
      assert.equal(second, null);
    } finally {
      process.chdir(previousCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("oneshot encontra a campanha da assinante e incorpora o destino na URL WABA", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "waba-vitoria-oneshot-"));
    const previousCwd = process.cwd();
    process.chdir(root);
    try {
      const dataDir = path.join(root, "data");
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(
        path.join(dataDir, "waba-subscribers.json"),
        JSON.stringify({
          version: 1,
          subscribers: [
            {
              id: SUBSCRIBER_ID,
              email: OWNER_EMAIL,
              passwordHash: "x",
              fullName: "Assinante Vitoria",
              whatsapp: "77999999999",
              phone: "77999999999",
              cpfCnpj: "00000000000",
              createdAt: "2026-09-01T12:00:00.000Z",
              updatedAt: "2026-09-01T12:00:00.000Z",
            },
          ],
        }),
        "utf8",
      );
      writeFileSync(
        path.join(dataDir, "waba-campaign-intakes.json"),
        JSON.stringify({
          version: 1,
          intakes: [
            {
              id: CAMPAIGN_ID,
              ownerEmail: OWNER_EMAIL,
              campaignName: VITORIA_DA_CONQUISTA_CAMPAIGN_NAME,
              regionDdd: "77",
              textOptions: ["a", "b", "c"],
              responseLink: "https://lp.cliente.com/vitoria",
              imageFileName: "foto.jpg",
              imageStoredPath: path.join(dataDir, "foto.jpg"),
              spreadsheetFileName: "leads.xlsx",
              spreadsheetStoredPath: path.join(dataDir, "leads.xlsx"),
              importedLineCount: 50,
              plannedSendCount: 50,
              apiKind: "oficial",
              status: "in_progress",
              createdAt: "2026-09-13T12:00:00.000Z",
              updatedAt: "2026-09-13T12:00:00.000Z",
            },
          ],
        }),
        "utf8",
      );

      const result = await runVitoriaDaConquistaShortUrlOneshot({
        forceLocal: true,
        async createShortUrl() {
          return "https://wabadisparos.com.br/s/vitoria2";
        },
        async attachCampaign() {
          return true;
        },
      });
      assert.equal(result.applied, true);
      assert.equal(result.shortUrl, "https://wabadisparos.com.br/s/vitoria2");
      assert.equal(new WabaCampaignIntakeRepository().getById(CAMPAIGN_ID)?.responseShortUrl, result.shortUrl);
    } finally {
      process.chdir(previousCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
