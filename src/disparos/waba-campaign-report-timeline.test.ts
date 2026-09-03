import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  META_REPORT_COLLECTION_NOTE,
  buildSubscriberCampaignTimeline,
  formatCampaignReportDateTime,
  resolveDispatchStartedAt,
} from "./waba-campaign-report-timeline";

describe("linha do tempo do relatório do assinante", () => {
  it("formata dia completo e horário em São Paulo", () => {
    assert.equal(
      formatCampaignReportDateTime("2026-09-02T18:44:08.000Z"),
      "Quarta-feira, 2 de setembro de 2026 - 15:44:08",
    );
  });

  it("omite marcos sem horário conhecido", () => {
    const timeline = buildSubscriberCampaignTimeline({
      createdAt: "2026-09-02T14:00:00.000Z",
      attendanceStartedAt: null,
      templateApprovedAt: "",
      dispatchStartedAt: null,
      dispatchFinishedAt: "2026-09-02T19:22:15.000Z",
    });
    assert.deepEqual(
      timeline.items.map((item) => item.key),
      ["createdAt", "dispatchFinishedAt"],
    );
    assert.equal(timeline.items.some((item) => item.display === "—"), false);
  });

  it("usa só o início real do envio", () => {
    assert.equal(resolveDispatchStartedAt({ status: "queued", createdAt: "2026-09-02T18:00:00.000Z" }), null);
    assert.equal(resolveDispatchStartedAt({ status: "done", createdAt: "2026-09-02T18:00:00.000Z" }), null);
    assert.equal(
      resolveDispatchStartedAt({
        status: "running",
        createdAt: "2026-09-02T18:00:00.000Z",
        sendStartedAt: "2026-09-02T18:01:00.000Z",
      }),
      "2026-09-02T18:01:00.000Z",
    );
  });

  it("monta os cinco marcos e o aviso das 3 horas da Meta", () => {
    const timeline = buildSubscriberCampaignTimeline({
      createdAt: "2026-09-02T14:00:00.000Z",
      attendanceStartedAt: "2026-09-02T15:00:00.000Z",
      templateApprovedAt: "2026-09-02T16:00:00.000Z",
      dispatchStartedAt: "2026-09-02T18:00:00.000Z",
      dispatchFinishedAt: "2026-09-02T19:22:15.000Z",
    });
    assert.equal(timeline.items.length, 5);
    assert.equal(timeline.items[0]?.label, "Criação da Campanha");
    assert.equal(timeline.items[1]?.label, "Início do Atendimento");
    assert.equal(timeline.items[2]?.label, "Aprovação Template");
    assert.equal(timeline.items[3]?.label, "Início do disparo");
    assert.equal(timeline.items[4]?.label, "Fim do disparo");
    assert.equal(timeline.items[4]?.display, "Quarta-feira, 2 de setembro de 2026 - 16:22:15");
    assert.equal(timeline.metaCollectionNote, META_REPORT_COLLECTION_NOTE);
    assert.match(timeline.metaCollectionNote, /3 horas/);
  });
});
