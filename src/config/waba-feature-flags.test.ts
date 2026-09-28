import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertAlternativaProductAllowsApiKind,
  isAlternativaProductEnabled,
  isDeviceCloudProductEnabled,
  isMetaOfficialPortfolioLabEnabled,
} from "./waba-feature-flags";
import { listWabaMenuDefinitions, listWabaMenuIds } from "../menus/waba-menu-registry";
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

describe("Device Cloud / Dispositivos product flag", () => {
  it("fica desligado por padrão", () => {
    assert.equal(isDeviceCloudProductEnabled({}), false);
    assert.equal(isDeviceCloudProductEnabled({ WABA_ENV: "production" }), false);
  });

  it("liga só com override explícito", () => {
    assert.equal(isDeviceCloudProductEnabled({ WABA_DEVICE_CLOUD_PRODUCT_ENABLED: "1" }), true);
    assert.equal(isDeviceCloudProductEnabled({ WABA_DEVICE_CLOUD_PRODUCT_ENABLED: "0" }), false);
  });

  it("omite o menu Dispositivos do registry quando o produto está desligado", () => {
    const prev = process.env.WABA_DEVICE_CLOUD_PRODUCT_ENABLED;
    try {
      delete process.env.WABA_DEVICE_CLOUD_PRODUCT_ENABLED;
      assert.equal(listWabaMenuIds().includes("dispositivos"), false);
      assert.equal(
        listWabaMenuDefinitions().some((item) => item.id === "dispositivos"),
        false,
      );
      process.env.WABA_DEVICE_CLOUD_PRODUCT_ENABLED = "1";
      assert.equal(listWabaMenuIds().includes("dispositivos"), true);
    } finally {
      if (prev == null) delete process.env.WABA_DEVICE_CLOUD_PRODUCT_ENABLED;
      else process.env.WABA_DEVICE_CLOUD_PRODUCT_ENABLED = prev;
    }
  });
});
