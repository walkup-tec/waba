import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isManualCampaignReportIncomplete,
  parseManualCampaignReportMetrics,
  parsePresentNonNegativeInt,
} from "./waba-campaign-report-metrics";

describe("indicadores obrigatórios do relatório manual", () => {
  it("zero digitado vale; vazio, nulo ou ausente não vale", () => {
    assert.equal(parsePresentNonNegativeInt(0), 0);
    assert.equal(parsePresentNonNegativeInt("0"), 0);
    assert.equal(parsePresentNonNegativeInt(" 12 "), 12);
    assert.equal(parsePresentNonNegativeInt(""), null);
    assert.equal(parsePresentNonNegativeInt("   "), null);
    assert.equal(parsePresentNonNegativeInt(null), null);
    assert.equal(parsePresentNonNegativeInt(undefined), null);
    assert.equal(parsePresentNonNegativeInt(-1), null);
    assert.equal(parsePresentNonNegativeInt("abc"), null);
  });

  it("só aceita o relatório quando os quatro indicadores vieram preenchidos", () => {
    assert.equal(parseManualCampaignReportMetrics({}), null);
    assert.equal(
      parseManualCampaignReportMetrics({ sent: 10, delivered: 8, read: 4 }),
      null,
    );
    assert.deepEqual(
      parseManualCampaignReportMetrics({ sent: 10, delivered: 8, read: 4, failed: 0 }),
      { sent: 10, delivered: 8, read: 4, failed: 0 },
    );
  });

  it("recusa o envio sem informação (tudo zero), que era o finalize sem preencher", () => {
    const empty = parseManualCampaignReportMetrics({
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
    });
    assert.deepEqual(empty, { sent: 0, delivered: 0, read: 0, failed: 0 });
    assert.equal(isManualCampaignReportIncomplete(empty), true);
    assert.equal(
      isManualCampaignReportIncomplete({ sent: 10, delivered: 0, read: 0, failed: 0 }),
      false,
    );
    assert.equal(isManualCampaignReportIncomplete(null), true);
  });
});
