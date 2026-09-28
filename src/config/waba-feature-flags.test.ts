import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertAlternativaProductAllowsApiKind,
  isAlternativaProductEnabled,
  isMetaOfficialPortfolioLabEnabled,
} from "./waba-feature-flags";
describe("API Alternativa product flag", () => {
  it("fica desligada por padrão", () => {
    assert.equal(isAlternativaProductEnabled({}), false);
    assert.equal(isAlternativaProductEnabled({ WABA_ENV: "production" }), false);
  });

  it("liga só com override explícito", () => {
    assert.equal(isAlternativaProductEnabled({ WABA_ALTERNATIVA_PRODUCT_ENABLED: "1" }), true);
    assert.equal(isAlternativaProductEnabled({ WABA_ALTERNATIVA_PRODUCT_ENABLED: "0" }), false);
  });

  it("recusa apiKind alternativa quando o produto está desligado", () => {
    assert.throws(
      () => assertAlternativaProductAllowsApiKind("alternativa"),
      /API Alternativa não está mais disponível/,
    );
    assert.doesNotThrow(() => assertAlternativaProductAllowsApiKind("oficial"));
  });
});

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
