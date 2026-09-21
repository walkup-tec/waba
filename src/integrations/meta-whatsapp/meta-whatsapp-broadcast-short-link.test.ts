import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extraSlugsForIntake,
  planBroadcastButtonTracking,
  resolveBoundCampaignClicks,
  resolveReusedButtonShortUrl,
} from "./meta-whatsapp-broadcast-short-link";

describe("amarração do clique do botão ao disparo", () => {
  it("reusa o slug estático que o WhatsApp abre", () => {
    assert.deepEqual(planBroadcastButtonTracking({ slug: "n9730691", hasVariable: false }), {
      reuseExistingSlug: true,
      slug: "n9730691",
    });
  });

  it("gera slug novo só quando o botão tem variável", () => {
    assert.deepEqual(planBroadcastButtonTracking({ slug: "abc1234", hasVariable: true }), {
      reuseExistingSlug: false,
      slug: "",
    });
    assert.deepEqual(planBroadcastButtonTracking(null), {
      reuseExistingSlug: false,
      slug: "",
    });
  });

  it("mantém a URL pública do botão estático", () => {
    assert.equal(
      resolveReusedButtonShortUrl({
        slug: "n9730691",
        buttonUrl: "https://waba.draxsistemas.com.br/s/n9730691",
        publicBase: "https://outro.host",
      }),
      "https://waba.draxsistemas.com.br/s/n9730691",
    );
    assert.equal(
      resolveReusedButtonShortUrl({
        slug: "abc1234",
        buttonUrl: "https://wa.me/5551997979224",
        publicBase: "https://waba.draxsistemas.com.br",
      }),
      "https://waba.draxsistemas.com.br/s/abc1234",
    );
  });

  it("inclui o slug da campanha do assinante na leitura", () => {
    assert.deepEqual(
      extraSlugsForIntake({
        responseShortSlug: "n9730691",
        responseShortUrl: "https://waba.draxsistemas.com.br/s/outros1",
      }),
      ["n9730691", "outros1"],
    );
  });

  it("não zera o relatório quando o encurtador ainda não carregou", () => {
    assert.equal(
      resolveBoundCampaignClicks({
        campaign: {
          clicks: 3,
          clicksAtStart: 0,
          trackedSlug: "",
          shortSlug: "",
          shortUrl: "",
        },
      }),
      3,
    );
  });
});
