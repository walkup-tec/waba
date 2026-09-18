import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT,
  WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT_ALTERNATIVA,
  WABA_MOZART_FORCED_OPERACIONAL_EMAIL,
  campaignMinPlannedSendCountForEmail,
  forcedOperacionalEmailForCampaignOwner,
} from "./waba-campaign-intake.constants";

describe("mínimo de envios da campanha", () => {
  it("remove o piso só para mozart.pmo@gmail.com", () => {
    assert.equal(campaignMinPlannedSendCountForEmail("mozart.pmo@gmail.com"), 1);
    assert.equal(campaignMinPlannedSendCountForEmail("  Mozart.Pmo@gmail.com  ", "oficial"), 1);
    assert.equal(campaignMinPlannedSendCountForEmail("mozart.pmo@gmail.com", "alternativa"), 1);
  });

  it("trava a API Oficial em 5000 para qualquer outro assinante", () => {
    assert.equal(WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT, 5000);
    assert.equal(campaignMinPlannedSendCountForEmail("cliente@exemplo.com"), 5000);
    assert.equal(campaignMinPlannedSendCountForEmail("cliente@exemplo.com", "oficial"), 5000);
    assert.equal(campaignMinPlannedSendCountForEmail(""), 5000);
    assert.equal(campaignMinPlannedSendCountForEmail(null), 5000);
  });

  it("mantém 1000 na API Alternativa", () => {
    assert.equal(WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT_ALTERNATIVA, 1000);
    assert.equal(campaignMinPlannedSendCountForEmail("cliente@exemplo.com", "alternativa"), 1000);
  });

  it("manda a fila do Mozart só para drax@draxsistemas.com.br", () => {
    assert.equal(
      forcedOperacionalEmailForCampaignOwner("mozart.pmo@gmail.com"),
      WABA_MOZART_FORCED_OPERACIONAL_EMAIL,
    );
    assert.equal(forcedOperacionalEmailForCampaignOwner("cliente@exemplo.com"), null);
    assert.equal(forcedOperacionalEmailForCampaignOwner(""), null);
  });
});
