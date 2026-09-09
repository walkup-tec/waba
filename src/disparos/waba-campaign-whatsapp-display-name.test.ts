import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { WABA_CAMPAIGN_WHATSAPP_DISPLAY_NAME } from "./waba-campaign-whatsapp-display-name";

const html = readFileSync(path.join(__dirname, "../../index.html"), "utf8");
const intakeRoutes = readFileSync(path.join(__dirname, "./waba-campaign-intake.routes.ts"), "utf8");

describe("nome de exibição do WhatsApp na campanha do assinante", () => {
  it("fixa Atendimento e Relacionamento no backend, ignorando o que o cliente enviar", () => {
    assert.equal(WABA_CAMPAIGN_WHATSAPP_DISPLAY_NAME, "Atendimento e Relacionamento");
    assert.match(intakeRoutes, /WABA_CAMPAIGN_WHATSAPP_DISPLAY_NAME/);
    assert.doesNotMatch(intakeRoutes, /Informe o nome no WhatsApp/);
  });

  it("o wizard informa o nome fixo e não pede um campo de nome", () => {
    assert.match(
      html,
      /O nome que será exibido no WhatsApp será Atendimento e Relacionamento/,
    );
    assert.match(html, /id="dis-wizard-whatsapp-name-note"/);
    assert.match(html, /DIS_CAMPAIGN_WHATSAPP_DISPLAY_NAME = "Atendimento e Relacionamento"/);
    assert.match(html, /formData\.append\("whatsappName", DIS_CAMPAIGN_WHATSAPP_DISPLAY_NAME\)/);
    assert.doesNotMatch(html, /id="dis-wizard-whatsapp-name"/);
    assert.doesNotMatch(html, /Informe o nome no WhatsApp/);
  });
});
