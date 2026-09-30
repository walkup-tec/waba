import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MetaWhatsappError } from "../integrations/meta-whatsapp/meta-whatsapp-errors";
import {
  createCampaignIntakeTrackedShortUrl,
  persistClientOriginalResponseLink,
  resolveCampaignCardResponseLink,
  resolveOperacionalManualReportClicks,
  resolveOperacionalManualReportShowClicks,
  resolveStoredClientOriginalResponseLink,
  shouldCreateIntakeTrackedShortUrl,
} from "./waba-campaign-intake-short-url";

describe("URL curta na criação da campanha Oficial", () => {
  it("só gera URL curta no plano Oficial", () => {
    assert.equal(shouldCreateIntakeTrackedShortUrl("oficial"), true);
    assert.equal(shouldCreateIntakeTrackedShortUrl("alternativa"), false);
  });

  it("o card prefere a URL curta e cai no link informado", () => {
    assert.equal(
      resolveCampaignCardResponseLink({
        responseLink: "https://site.com/promo",
        responseShortUrl: "https://wabadisparos.com.br/s/abc1234",
      }),
      "https://wabadisparos.com.br/s/abc1234",
    );
    assert.equal(
      resolveCampaignCardResponseLink({ responseLink: "https://site.com/promo" }),
      "https://site.com/promo",
    );
  });

  it("guarda o link da cliente e ignora o alias /s", () => {
    assert.equal(
      persistClientOriginalResponseLink("", "https://cliente.com/voto?x=1"),
      "https://cliente.com/voto?x=1",
    );
    assert.equal(
      persistClientOriginalResponseLink(
        "https://cliente.com/voto",
        "https://waba.draxsistemas.com.br/s/abc1234",
      ),
      "https://cliente.com/voto",
    );
    assert.equal(
      persistClientOriginalResponseLink("", "https://waba.draxsistemas.com.br/s/abc1234"),
      "",
    );
    assert.equal(
      persistClientOriginalResponseLink(
        "",
        "https://cliente.com/voto?_n8n_link_nonce=123-9",
      ),
      "https://cliente.com/voto",
    );
    assert.equal(
      resolveStoredClientOriginalResponseLink({
        responseLink: "https://cliente.com/voto",
        responseShortUrl: "https://waba.draxsistemas.com.br/s/abc1234",
      }),
      "https://cliente.com/voto",
    );
  });

  it("cria a URL /s/{slug} do Disparador Cloud e amarra a campanha", async () => {
    const attached: Array<{ slug: string; campaignId: string }> = [];
    const created = await createCampaignIntakeTrackedShortUrl(
      {
        destinationUrl: "https://exemplo.com/retorno",
        campaignId: "camp-oficial-1",
        ownerEmail: "assinante@exemplo.com",
      },
      {
        async createShortUrl(input) {
          assert.equal(input.destinationUrl, "https://exemplo.com/retorno");
          assert.equal(input.tenantId, "assinante@exemplo.com");
          return "https://wabadisparos.com.br/s/n8abcde";
        },
        async attachCampaign(slug, campaignId) {
          attached.push({ slug, campaignId });
          return true;
        },
      },
    );
    assert.equal(created.shortUrl, "https://wabadisparos.com.br/s/n8abcde");
    assert.equal(created.shortSlug, "n8abcde");
    assert.deepEqual(attached, [{ slug: "n8abcde", campaignId: "camp-oficial-1" }]);
  });

  it("relatório manual do operador mostra cliques da URL e ignora o valor enviado no form", () => {
    assert.equal(resolveOperacionalManualReportShowClicks({ hideClicks: false }), true);
    assert.equal(resolveOperacionalManualReportShowClicks({ hideClicks: true }), false);
    assert.equal(
      resolveOperacionalManualReportShowClicks({ hideClicks: true, forceShowClicks: true }),
      true,
    );
    assert.equal(resolveOperacionalManualReportClicks({ trackedClicks: 47 }), 47);
    assert.equal(resolveOperacionalManualReportClicks({ overrideClicks: 130, trackedClicks: 47 }), 130);
    assert.equal(resolveOperacionalManualReportClicks({ trackedClicks: -3 }), 0);
  });

  it("recusa link inválido com o mesmo recado do wizard", async () => {
    await assert.rejects(
      () =>
        createCampaignIntakeTrackedShortUrl(
          {
            destinationUrl: "ftp://arquivo.local",
            campaignId: "camp-oficial-1",
            ownerEmail: "assinante@exemplo.com",
          },
          {
            async createShortUrl() {
              throw new MetaWhatsappError("template_url_https");
            },
          },
        ),
      (error: unknown) => {
        assert.equal((error as Error).message, "Informe um link de resposta válido (http ou https).");
        assert.equal((error as { statusCode?: number }).statusCode, 400);
        return true;
      },
    );
  });
});
