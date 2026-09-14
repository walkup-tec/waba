import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT,
  WABA_MOZART_FORCED_OPERACIONAL_EMAIL,
  campaignMinPlannedSendCountForEmail,
  forcedOperacionalEmailForCampaignOwner,
} from "./waba-campaign-intake.constants";

describe("mínimo de envios da campanha", () => {
  it("remove o piso de 1000 só para mozart.pmo@gmail.com", () => {
    assert.equal(campaignMinPlannedSendCountForEmail("mozart.pmo@gmail.com"), 1);
    assert.equal(campaignMinPlannedSendCountForEmail("  Mozart.Pmo@gmail.com  "), 1);
  });

  it("mantém 1000 para qualquer outro assinante", () => {
    assert.equal(campaignMinPlannedSendCountForEmail("cliente@exemplo.com"), WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT);
    assert.equal(campaignMinPlannedSendCountForEmail(""), WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT);
    assert.equal(campaignMinPlannedSendCountForEmail(null), WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT);
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
