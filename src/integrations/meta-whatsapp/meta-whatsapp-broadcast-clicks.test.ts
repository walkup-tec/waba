import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveBroadcastCampaignForShortClick,
  resolveBroadcastReportedClicks,
  type MetaBroadcastCampaign,
} from "./meta-whatsapp-broadcast.store";

const campaign = (patch: Partial<MetaBroadcastCampaign> = {}): MetaBroadcastCampaign => ({
  id: "bc-tocantins",
  tenantId: "t1",
  connectionId: "c1",
  templateId: "tpl",
  templateName: "tocantins_sem_bt_v1_1",
  language: "pt_BR",
  phoneNumberId: "phone",
  shortSlug: "newslug1",
  shortUrl: "https://waba.draxsistemas.com.br/s/newslug1",
  trackedSlug: "n9730691",
  clicksAtStart: 2,
  clicks: 0,
  status: "done",
  total: 150,
  sent: 150,
  failed: 0,
  skipped: 0,
  createdAt: "2026-09-21T14:00:00.000Z",
  updatedAt: "2026-09-21T14:40:00.000Z",
  intakeCampaignId: "intake-tocantins",
  leads: [],
  ...patch,
});

describe("cliques do botão /s/ no Disparo Cloud", () => {
  it("não perde o clique quando o slug está amarrado ao id da campanha do assinante", () => {
    const rows = [campaign()];
    const byIntake = resolveBroadcastCampaignForShortClick(rows, {
      campaignId: "intake-tocantins",
      slug: "n9730691",
    });
    assert.equal(byIntake?.id, "bc-tocantins");
    const bySlug = resolveBroadcastCampaignForShortClick(rows, {
      campaignId: "outro-id",
      slug: "n9730691",
    });
    assert.equal(bySlug?.id, "bc-tocantins");
  });

  it("lê o delta do encurtador quando o JSON do disparo ficou em 0", () => {
    assert.equal(resolveBroadcastReportedClicks(campaign({ clicks: 0, clicksAtStart: 2 }), 3), 1);
    assert.equal(resolveBroadcastReportedClicks(campaign({ clicks: 4, clicksAtStart: 2 }), 3), 4);
    assert.equal(resolveBroadcastReportedClicks(campaign({ clicks: 0, clicksAtStart: 0 }), null), 0);
  });

  it("ignora lote cancelado/oculto na hora de creditar o clique", () => {
    const rows = [
      campaign({
        id: "bc-old",
        voidedAt: "2026-09-21T13:00:00.000Z",
        createdAt: "2026-09-21T12:00:00.000Z",
      }),
      campaign(),
    ];
    const got = resolveBroadcastCampaignForShortClick(rows, {
      campaignId: "intake-tocantins",
      slug: "n9730691",
    });
    assert.equal(got?.id, "bc-tocantins");
  });
});
