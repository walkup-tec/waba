import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isRetiredSystemPush } from "./waba-push.repository";

describe("comunicados retirados do sininho", () => {
  it("remove Relatórios de Campanha e Plataforma META", () => {
    assert.equal(
      isRetiredSystemPush({
        title: "Relatórios de Campanha",
        reviewedText:
          "O Relatório de sua campanha foi atualizado. COnfira ela na tela de Campanhas da API Oficial.",
      }),
      true,
    );
    assert.equal(
      isRetiredSystemPush({
        title: "Plataforma META",
        reviewedText:
          "No dia 31 de julho, a plataforma META realizou uma atualização para as aplicações relacionadas ao WhatsApp.",
      }),
      true,
    );
  });

  it("mantém comunicados novos", () => {
    assert.equal(
      isRetiredSystemPush({
        title: "Manutenção programada",
        reviewedText: "O sistema entra em manutenção às 22h.",
      }),
      false,
    );
  });
});
