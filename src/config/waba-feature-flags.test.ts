import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isMetaOfficialPortfolioLabEnabled } from "./waba-feature-flags";

describe("metaOfficialPortfolioLab flag", () => {
  it("liga por padrão, inclusive em produção", () => {
    assert.equal(
      isMetaOfficialPortfolioLabEnabled({ WABA_ENV: "v02", RUNTIME_MODE: "development" }),
      true,
    );
    assert.equal(
      isMetaOfficialPortfolioLabEnabled({ WABA_ENV: "production", RUNTIME_MODE: "production" }),
      true,
    );
  });

  it("respeita override explícito", () => {
    assert.equal(
      isMetaOfficialPortfolioLabEnabled({ WABA_META_OFFICIAL_PORTFOLIO_LAB: "0" }),
      false,
    );
    assert.equal(
      isMetaOfficialPortfolioLabEnabled({ WABA_META_OFFICIAL_PORTFOLIO_LAB: "true" }),
      true,
    );
  });
});
