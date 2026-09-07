import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const html = readFileSync(path.join(__dirname, "../../index.html"), "utf8");

describe("prévia da logo do WhatsApp no wizard da campanha", () => {
  it("o CSS só mostra o img quando o wrapper tem is-image", () => {
    assert.match(
      html,
      /\.dis-campaign-wizard-image-preview img[\s\S]*?display:\s*none/,
    );
    assert.match(
      html,
      /\.dis-campaign-wizard-image-preview\.is-image img[\s\S]*?display:\s*block/,
    );
  });

  it("a validação da logo liga is-visible e is-image juntos", () => {
    assert.match(html, /function setDisCampaignWizardWhatsappLogoPreview/);
    assert.match(html, /previewWrap\.classList\.add\("is-visible", "is-image"\)/);
    assert.match(
      html,
      /id="dis-wizard-whatsapp-logo-preview"[\s\S]*?id="dis-wizard-whatsapp-logo-preview-img"/,
    );
  });
});
