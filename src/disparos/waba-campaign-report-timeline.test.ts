import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { WabaCampaignIntake } from "./waba-campaign-intake.repository";
import {
  META_REPORT_COLLECTION_NOTE,
  buildDistributedCampaignReportTimeline,
  buildSubscriberCampaignTimeline,
  collectIntakeReportTimeline,
  formatCampaignReportDateTime,
  isCampaignReportBusinessInstant,
  resolveDispatchStartedAt,
} from "./waba-campaign-report-timeline";

const stubIntake = (campaignName: string): WabaCampaignIntake => ({
  id: `override-${campaignName}`,
  ownerEmail: "assinante@exemplo.com",
  campaignName,
  regionDdd: "51",
  textOptions: ["a", "b", "c"],
  imageFileName: "img.png",
  imageStoredPath: "/tmp/img.png",
  spreadsheetFileName: "leads.xlsx",
  spreadsheetStoredPath: "/tmp/leads.xlsx",
  importedLineCount: 1000,
  plannedSendCount: 1000,
  status: "completed",
  startedAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

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

  it("Opt in PTX usa a linha do tempo pontual em Brasília", () => {
    const timeline = collectIntakeReportTimeline(stubIntake("Opt in PTX"));
    assert.deepEqual(
      timeline.items.map((item) => item.display),
      [
        "Segunda-feira, 7 de setembro de 2026 - 15:03:00",
        "Terça-feira, 8 de setembro de 2026 - 07:00:00",
        "Sexta-feira, 11 de setembro de 2026 - 15:40:00",
        "Sexta-feira, 11 de setembro de 2026 - 16:00:00",
        "Sexta-feira, 11 de setembro de 2026 - 16:12:00",
      ],
    );
  });

  it("Convite para base Jandira usa a linha do tempo pontual em Brasília", () => {
    const timeline = collectIntakeReportTimeline(stubIntake("Convite para base Jandira"));
    assert.deepEqual(
      timeline.items.map((item) => item.display),
      [
        "Segunda-feira, 7 de setembro de 2026 - 15:03:00",
        "Terça-feira, 8 de setembro de 2026 - 07:15:00",
        "Sexta-feira, 11 de setembro de 2026 - 16:35:00",
        "Sexta-feira, 11 de setembro de 2026 - 16:50:00",
        "Sexta-feira, 11 de setembro de 2026 - 17:22:00",
      ],
    );
  });

  it("VITORIA DA CONQUISTA usa a linha do tempo pontual em Brasília", () => {
    const timeline = collectIntakeReportTimeline(stubIntake("VITORIA DA CONQUISTA"));
    assert.deepEqual(
      timeline.items.map((item) => item.display),
      [
        "Terça-feira, 8 de setembro de 2026 - 18:01:00",
        "Quarta-feira, 9 de setembro de 2026 - 15:34:00",
        "Quinta-feira, 10 de setembro de 2026 - 18:01:00",
        "Segunda-feira, 14 de setembro de 2026 - 12:01:00",
        "Segunda-feira, 14 de setembro de 2026 - 12:17:00",
      ],
    );
  });

  it("NOSSO CONSIG 1 distribui no expediente e termina sexta 18/09/2026 às 10:30", () => {
    const timeline = collectIntakeReportTimeline({
      ...stubIntake("NOSSO CONSIG 1"),
      createdAt: "2026-09-09T17:48:06.000Z",
      updatedAt: "2026-09-18T13:22:00.000Z",
      performanceReport: {
        totalLeads: 2504,
        sent: 2203,
        delivered: 2064,
        read: 958,
        failed: 301,
        clicks: 0,
        source: "meta_lab",
        filledAt: "2026-09-18T13:22:00.000Z",
        filledByEmail: "lab@example.com",
      },
    });
    assert.deepEqual(
      timeline.items.map((item) => item.display),
      [
        "Quarta-feira, 9 de setembro de 2026 - 14:48:06",
        "Quinta-feira, 10 de setembro de 2026 - 17:56:29",
        "Quinta-feira, 17 de setembro de 2026 - 13:55:49",
        "Quinta-feira, 17 de setembro de 2026 - 17:12:54",
        "Sexta-feira, 18 de setembro de 2026 - 10:30:00",
      ],
    );
    for (const item of timeline.items) {
      if (item.key === "createdAt") continue;
      assert.equal(isCampaignReportBusinessInstant(item.at), true, item.key);
    }
  });

  it("distribui 20/70/5/5 no expediente entre criação 08:00 e finalização 18:00", () => {
    const distributed = buildDistributedCampaignReportTimeline(
      "2026-09-18T11:00:00.000Z",
      "2026-09-18T21:00:00.000Z",
    );
    assert.deepEqual(distributed, {
      createdAt: "2026-09-18T11:00:00.000Z",
      attendanceStartedAt: "2026-09-18T13:48:00.000Z",
      templateApprovedAt: "2026-09-18T20:06:00.000Z",
      dispatchStartedAt: "2026-09-18T20:33:00.000Z",
      dispatchFinishedAt: "2026-09-18T21:00:00.000Z",
    });
    const timeline = collectIntakeReportTimeline({
      ...stubIntake("Campanha exemplo distribuida"),
      startedAt: "2026-09-18T12:00:00.000Z",
      createdAt: "2026-09-18T11:00:00.000Z",
      updatedAt: "2026-09-18T21:00:00.000Z",
    });
    assert.deepEqual(
      timeline.items.map((item) => item.display),
      [
        "Sexta-feira, 18 de setembro de 2026 - 08:00:00",
        "Sexta-feira, 18 de setembro de 2026 - 10:48:00",
        "Sexta-feira, 18 de setembro de 2026 - 17:06:00",
        "Sexta-feira, 18 de setembro de 2026 - 17:33:00",
        "Sexta-feira, 18 de setembro de 2026 - 18:00:00",
      ],
    );
  });

  it("não posiciona marco calculado à noite nem no fim de semana", () => {
    const distributed = buildDistributedCampaignReportTimeline(
      "2026-09-11T21:00:00.000Z",
      "2026-09-14T13:00:00.000Z",
    );
    assert.deepEqual(distributed, {
      createdAt: "2026-09-11T21:00:00.000Z",
      attendanceStartedAt: "2026-09-11T21:24:00.000Z",
      templateApprovedAt: "2026-09-14T12:48:00.000Z",
      dispatchStartedAt: "2026-09-14T12:54:00.000Z",
      dispatchFinishedAt: "2026-09-14T13:00:00.000Z",
    });
    assert.equal(isCampaignReportBusinessInstant(distributed?.dispatchStartedAt), true);
    assert.equal(
      formatCampaignReportDateTime(distributed?.dispatchStartedAt),
      "Segunda-feira, 14 de setembro de 2026 - 09:54:00",
    );
  });

  it("campanha em andamento não recebe a distribuição calculada", () => {
    const timeline = collectIntakeReportTimeline({
      ...stubIntake("Campanha ainda aberta"),
      status: "in_progress",
      startedAt: "2026-09-18T12:10:00.000Z",
      createdAt: "2026-09-18T11:00:00.000Z",
      updatedAt: "2026-09-18T21:00:00.000Z",
    });
    assert.deepEqual(
      timeline.items.map((item) => item.key),
      ["createdAt", "attendanceStartedAt"],
    );
    assert.equal(timeline.items[0]?.display, "Sexta-feira, 18 de setembro de 2026 - 08:00:00");
    assert.equal(timeline.items[1]?.display, "Sexta-feira, 18 de setembro de 2026 - 09:10:00");
  });

  it("outra campanha não recebe a linha do tempo da PTX nem da Jandira", () => {
    const at = "2026-03-10T15:00:00.000Z";
    const timeline = collectIntakeReportTimeline({
      ...stubIntake("Outra campanha"),
      startedAt: undefined,
      createdAt: at,
      updatedAt: at,
    });
    assert.equal(timeline.items.length, 5);
    assert.deepEqual(
      timeline.items.map((item) => item.at),
      [at, at, at, at, at],
    );
    assert.equal(
      timeline.items.some((item) => item.display.includes("7 de setembro de 2026")),
      false,
    );
  });
});
