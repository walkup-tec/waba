import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPublicLandingMaintenanceEnabled,
  isPublicLandingPath,
  isPublicMarketingHost,
  PUBLIC_LANDING_MAINTENANCE_MESSAGE,
  renderPublicMaintenanceHtml,
  requestLooksLikePublicLanding,
} from "./public-site-maintenance";

describe("Páginas públicas em manutenção", () => {
  it("reconhece os hosts comerciais, inclusive os nomes pedidos", () => {
    assert.equal(isPublicMarketingHost("wabadisparos.com.br"), true);
    assert.equal(isPublicMarketingHost("wabadisparador.com.br"), true);
    assert.equal(isPublicMarketingHost("bet.waba.info"), true);
    assert.equal(isPublicMarketingHost("bets.waba.info"), true);
    assert.equal(isPublicMarketingHost("www.bet.waba.info:443"), true);
    assert.equal(isPublicMarketingHost("waba.draxsistemas.com.br"), false);
  });

  it("bloqueia só as rotas de landing, não o painel", () => {
    assert.equal(isPublicLandingPath("/vendas"), true);
    assert.equal(isPublicLandingPath("/bets/"), true);
    assert.equal(isPublicLandingPath("/cadastro"), true);
    assert.equal(isPublicLandingPath("/"), false);
    assert.equal(isPublicLandingPath("/index.html"), false);
  });

  it("combina host encaminhado com path da landing", () => {
    assert.equal(
      requestLooksLikePublicLanding({
        forwardedHost: "bets.waba.info",
        path: "/",
      }),
      true,
    );
    assert.equal(
      requestLooksLikePublicLanding({
        host: "waba.draxsistemas.com.br",
        path: "/vendas",
      }),
      true,
    );
    assert.equal(
      requestLooksLikePublicLanding({
        host: "waba.draxsistemas.com.br",
        path: "/",
      }),
      false,
    );
  });

  it("mantém a manutenção ligada por padrão", () => {
    const prev = process.env.PUBLIC_LANDING_MAINTENANCE;
    delete process.env.PUBLIC_LANDING_MAINTENANCE;
    try {
      assert.equal(isPublicLandingMaintenanceEnabled(), true);
    } finally {
      if (prev === undefined) delete process.env.PUBLIC_LANDING_MAINTENANCE;
      else process.env.PUBLIC_LANDING_MAINTENANCE = prev;
    }
  });

  it("renderiza a mensagem e o cavalete", () => {
    const html = renderPublicMaintenanceHtml();
    assert.match(html, /Site em manutenção, temporariamente indisponível\. Aguarde, em breve novidades!/);
    assert.match(html, /Cavalete e cone de obra/);
    assert.equal(PUBLIC_LANDING_MAINTENANCE_MESSAGE.includes("em breve novidades"), true);
  });
});
