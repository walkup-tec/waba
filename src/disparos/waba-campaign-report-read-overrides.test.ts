import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeCampaignPerformanceMetrics } from "./waba-campaign-performance-metrics";
import type { WabaCampaignPerformanceReport } from "./waba-campaign-intake.repository";
import {
  applyCampaignReportReadOverride,
  campaignHoldsSubscriberInProgress,
  campaignReportHidesClicks,
  campaignReportShowsClicks,
  resolveCampaignReportReadOverride,
} from "./waba-campaign-report-read-overrides";

const augustStamp = "2026-08-14T18:54:00.000Z";

const report = (
  partial: Partial<WabaCampaignPerformanceReport> = {},
): WabaCampaignPerformanceReport => ({
  totalLeads: 100,
  sent: 80,
  delivered: 70,
  read: 40,
  failed: 1,
  clicks: 5,
  source: "meta_lab",
  filledAt: "2026-09-02T12:00:00.000Z",
  filledByEmail: "lab@example.com",
  ...partial,
});

describe("override pontual do relatório", () => {
  it("Campanha Jandira deste disparo recebe 981 entregues e 431 lidos", () => {
    const stored = report({
      totalLeads: 1990,
      sent: 1156,
      delivered: 0,
      read: 0,
      failed: 2,
      clicks: 0,
    });
    const got = applyCampaignReportReadOverride(
      "Campanha Jandira",
      "2026-09-02T10:00:00.000Z",
      stored,
    );
    assert.equal(got?.delivered, 981);
    assert.equal(got?.read, 431);
    assert.equal(got?.sent, 1156);
    assert.equal(got?.totalLeads, 1990);
    assert.equal(got?.failed, 2);
    assert.equal(campaignReportHidesClicks("Campanha Jandira", "2026-09-02T10:00:00.000Z", stored), true);
  });

  it("taxas da Campanha Jandira acompanham 981/431 e o bônus 834 permanece", () => {
    const metrics = computeCampaignPerformanceMetrics({
      totalLeads: 1990,
      sent: 1156,
      delivered: 981,
      read: 431,
      failed: 2,
    });
    assert.equal(metrics.deliveryRate, 84.86);
    assert.equal(metrics.readRate, 43.93);
    assert.equal(metrics.failureRate, 0.1);
    assert.equal(metrics.pendingSent, 173);
    assert.equal(metrics.bonusShipments, 834);
  });

  it("outra campanha Lab não recebe os números da Jandira", () => {
    const stored = report({
      totalLeads: 500,
      sent: 400,
      delivered: 10,
      read: 4,
      failed: 1,
    });
    const got = applyCampaignReportReadOverride("Outra campanha Lab", "2026-09-02T10:00:00.000Z", stored);
    assert.equal(got?.delivered, 10);
    assert.equal(got?.read, 4);
    assert.equal(
      campaignReportHidesClicks("Outra campanha Lab", "2026-09-02T10:00:00.000Z", stored),
      false,
    );
  });

  it("outra Jandira com totais diferentes não casa o fingerprint", () => {
    const stored = report({
      totalLeads: 1990,
      sent: 1800,
      delivered: 0,
      read: 0,
      failed: 2,
    });
    const got = applyCampaignReportReadOverride("Campanha Jandira", "2026-09-02T10:00:00.000Z", stored);
    assert.equal(got?.delivered, 0);
    assert.equal(got?.read, 0);
    assert.equal(campaignReportHidesClicks("Campanha Jandira", "2026-09-02T10:00:00.000Z", stored), false);
  });

  it("SQUARE RESIDENCIAL de 14/08 continua com 480 lidos", () => {
    const stored = report({ delivered: 600, read: 0 });
    const got = applyCampaignReportReadOverride("SQUARE RESIDENCIAL", augustStamp, stored);
    assert.equal(got?.read, 480);
    assert.equal(got?.delivered, 600);
    assert.equal(resolveCampaignReportReadOverride("SQUARE RESIDENCIAL", augustStamp), 480);
    assert.equal(campaignReportHidesClicks("SQUARE RESIDENCIAL", augustStamp, stored), false);
  });

  it("6 DE AGOSTO de 14/08 continua com 518 lidos", () => {
    const stored = report({ delivered: 700, read: 0 });
    const got = applyCampaignReportReadOverride("6 DE AGOSTO", augustStamp, stored);
    assert.equal(got?.read, 518);
    assert.equal(got?.delivered, 700);
    assert.equal(campaignReportHidesClicks("6 DE AGOSTO", augustStamp, stored), false);
  });

  it("Opt in PTX recebe indicadores manuais com cliques", () => {
    const stored = report({
      totalLeads: 2996,
      sent: 1980,
      delivered: 0,
      read: 0,
      failed: 0,
      clicks: 203,
      source: "manual",
    });
    const got = applyCampaignReportReadOverride("Opt in PTX", "2026-09-09T01:34:51.000Z", stored);
    assert.equal(got?.sent, 825);
    assert.equal(got?.delivered, 695);
    assert.equal(got?.read, 417);
    assert.equal(got?.failed, 120);
    assert.equal(got?.clicks, 47);
    assert.equal(got?.totalLeads, 2996);
    assert.equal(campaignReportShowsClicks("Opt in PTX", "2026-09-09T01:34:51.000Z", stored), true);
    assert.equal(campaignReportHidesClicks("Opt in PTX", "2026-09-09T01:34:51.000Z", stored), false);

    const metrics = computeCampaignPerformanceMetrics({
      totalLeads: 2996,
      sent: 825,
      delivered: 695,
      read: 417,
      failed: 120,
      clicks: 47,
    });
    assert.equal(metrics.deliveryRate, 84.24);
    assert.equal(metrics.readRate, 60);
    assert.equal(metrics.failureRate, 4.01);
    assert.equal(metrics.clickRate, 6.76);
  });

  it("Opt in PTX não altera campanha com nome parecido", () => {
    const stored = report({ sent: 10, delivered: 8, read: 4, failed: 1, clicks: 2 });
    const got = applyCampaignReportReadOverride("Opt in PTX 2", "2026-09-09T01:34:51.000Z", stored);
    assert.equal(got?.sent, 10);
    assert.equal(got?.delivered, 8);
    assert.equal(got?.clicks, 2);
    assert.equal(campaignReportShowsClicks("Opt in PTX 2", "2026-09-09T01:34:51.000Z", stored), false);
  });

  it("Convite para base Jandira recebe indicadores manuais com cliques", () => {
    const stored = report({
      totalLeads: 1800,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      clicks: 0,
      source: "manual",
    });
    const got = applyCampaignReportReadOverride(
      "Convite para base Jandira",
      "2026-09-12T10:00:00.000Z",
      stored,
    );
    assert.equal(got?.sent, 1652);
    assert.equal(got?.delivered, 1553);
    assert.equal(got?.read, 931);
    assert.equal(got?.failed, 79);
    assert.equal(got?.clicks, 130);
    assert.equal(got?.totalLeads, 1800);
    assert.equal(
      campaignReportShowsClicks("Convite para base Jandira", "2026-09-12T10:00:00.000Z", stored),
      true,
    );
    assert.equal(
      campaignReportHidesClicks("Convite para base Jandira", "2026-09-12T10:00:00.000Z", stored),
      false,
    );

    const metrics = computeCampaignPerformanceMetrics({
      totalLeads: 1800,
      sent: 1652,
      delivered: 1553,
      read: 931,
      failed: 79,
      clicks: 130,
    });
    assert.equal(metrics.clickRate, 8.37);
    assert.equal(metrics.deliveryRate, 94.01);
    assert.equal(metrics.readRate, 59.95);
  });

  it("Convite para base Jandira não altera Campanha Jandira nem nome parecido", () => {
    const jandira = report({
      totalLeads: 1990,
      sent: 1156,
      delivered: 0,
      read: 0,
      failed: 2,
    });
    const other = applyCampaignReportReadOverride(
      "Convite para base Jandira 2",
      "2026-09-12T10:00:00.000Z",
      report({ sent: 10, delivered: 8, read: 4, failed: 1, clicks: 2 }),
    );
    const kept = applyCampaignReportReadOverride(
      "Campanha Jandira",
      "2026-09-02T10:00:00.000Z",
      jandira,
    );
    assert.equal(kept?.delivered, 981);
    assert.equal(kept?.read, 431);
    assert.equal(campaignReportHidesClicks("Campanha Jandira", "2026-09-02T10:00:00.000Z", jandira), true);
    assert.equal(other?.sent, 10);
    assert.equal(other?.clicks, 2);
    assert.equal(
      campaignReportShowsClicks("Convite para base Jandira 2", "2026-09-12T10:00:00.000Z"),
      false,
    );
  });

  it("Campanha Jandira 2 fica Em andamento e não casa a Jandira antiga", () => {
    const created = "2026-09-03T14:11:00.000Z";
    assert.equal(campaignHoldsSubscriberInProgress("Campanha Jandira 2", created), true);
    assert.equal(
      campaignHoldsSubscriberInProgress("Outra", created, "368d053b-d59b-4eed-a235-fe9e9f32c68c"),
      true,
    );
    assert.equal(campaignHoldsSubscriberInProgress("Campanha Jandira", "2026-09-02T10:00:00.000Z"), false);
    assert.equal(campaignHoldsSubscriberInProgress("Campanha Jandira 2", "2026-09-02T10:00:00.000Z"), false);
  });
});
