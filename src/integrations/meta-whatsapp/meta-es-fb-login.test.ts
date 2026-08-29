import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  META_ES_LEGACY_EXCHANGE_PATHS,
  META_ES_TECH_PROVIDER_PATHS,
  META_ES_UNAVAILABLE_MESSAGE,
  buildMetaEsFbLoginOptions,
  buildMetaEsSetupPrefill,
  configIdLast4,
  isGenericFacebookOauthUrl,
  isLegacyExchangePath,
  mentionsMissingConfigId,
  planMetaEsTechProviderClick,
  readMetaConfigIdFromEnv,
  META_ES_JS_SDK_GRAPH_VERSION,
  resolveFbLoginOptionsForAttempt,
  resolveMetaEsConfigId,
  resolveMetaEsJsSdkGraphVersion,
  shouldOpenMetaEsPopup,
  toPublicMetaEsConfig,
} from "./meta-es-fb-login";

describe("meta-es-fb-login", () => {
  it("config presente → FB.login recebe config_id", () => {
    const options = buildMetaEsFbLoginOptions("1467449278208212");
    assert.ok(options);
    assert.equal(options.config_id, "1467449278208212");
    assert.equal(options.response_type, "code");
    assert.equal(options.override_default_response_type, true);
    assert.deepEqual(options.extras, { setup: {} });
    assert.equal("sessionInfoVersion" in options.extras, false);
    const prefill = buildMetaEsSetupPrefill({
      businessId: "1247508354180311",
      wabaId: "waba-1",
    });
    const withSetup = buildMetaEsFbLoginOptions("1467449278208212", prefill);
    assert.equal(withSetup?.extras.setup.business?.id, "1247508354180311");
    assert.equal(withSetup?.extras.setup.whatsAppBusinessAccount?.ids, "waba-1");
    const plan = planMetaEsTechProviderClick("1467449278208212");
    assert.equal(plan.callFbInit, false);
    assert.equal(plan.loginOptions?.config_id, "1467449278208212");
  });

  it("config ausente → popup não abre", () => {
    assert.equal(buildMetaEsFbLoginOptions(""), null);
    assert.equal(buildMetaEsFbLoginOptions("   "), null);
    const blocked = shouldOpenMetaEsPopup({ configId: "", sdkReady: true });
    assert.equal(blocked.open, false);
    assert.equal(blocked.error, META_ES_UNAVAILABLE_MESSAGE);
  });

  it("reauth / segunda tentativa → config_id continua presente", () => {
    const first = resolveFbLoginOptionsForAttempt("1467449278208212", 1);
    const second = resolveFbLoginOptionsForAttempt("1467449278208212", 2);
    assert.ok(first);
    assert.ok(second);
    assert.equal(first.config_id, second.config_id);
    assert.equal(second.config_id, "1467449278208212");
    assert.equal(second.response_type, "code");
    assert.equal(second.override_default_response_type, true);
    assert.deepEqual(second.extras, { setup: {} });
  });

  it("fluxo novo não chama OAuth genérico", () => {
    const plan = planMetaEsTechProviderClick("1467449278208212");
    assert.equal(plan.openGenericOauthUrl, false);
    assert.equal(
      isGenericFacebookOauthUrl(
        "https://www.facebook.com/v22.0/dialog/oauth?app_id=1279182514183979&response_type=code",
      ),
      true,
    );
    assert.equal(
      isGenericFacebookOauthUrl(
        "https://www.facebook.com/v22.0/dialog/oauth?app_id=1279182514183979&config_id=1467449278208212&response_type=code",
      ),
      false,
    );
  });

  it("fluxo novo não chama exchange legado", () => {
    const plan = planMetaEsTechProviderClick("1467449278208212");
    assert.equal(plan.configPath, META_ES_TECH_PROVIDER_PATHS.config);
    assert.equal(plan.startPath, META_ES_TECH_PROVIDER_PATHS.start);
    assert.equal(plan.callbackPath, META_ES_TECH_PROVIDER_PATHS.callback);
    assert.equal(plan.completePath, META_ES_TECH_PROVIDER_PATHS.complete);
    assert.equal(plan.confirmPath, META_ES_TECH_PROVIDER_PATHS.confirm);
    for (const path of META_ES_LEGACY_EXCHANGE_PATHS) {
      assert.equal(plan.forbiddenPaths.includes(path), true);
      assert.equal(isLegacyExchangePath(path), true);
    }
    assert.equal(isLegacyExchangePath(META_ES_TECH_PROVIDER_PATHS.callback), false);
  });

  it("config público expõe configId e não vaza secrets", () => {
    const publicCfg = toPublicMetaEsConfig({
      appId: "1279182514183979",
      configId: "1467449278208212",
      graphVersion: "v22.0",
      appSecret: "super-secret",
      accessToken: "EAABsecret",
      encryptionKey: "enc-key",
    });
    const json = JSON.stringify(publicCfg);
    assert.equal(publicCfg.ok, true);
    assert.equal(publicCfg.configId, "1467449278208212");
    assert.doesNotMatch(json, /super-secret|EAABsecret|enc-key|APP_SECRET|accessToken/);
    assert.equal(resolveMetaEsConfigId(publicCfg), "1467449278208212");
    assert.equal(configIdLast4(publicCfg.configId || ""), "8212");
  });

  it("FB.init usa Graph latest independente de META_GRAPH_VERSION", () => {
    assert.equal(META_ES_JS_SDK_GRAPH_VERSION, "v26.0");
    assert.equal(resolveMetaEsJsSdkGraphVersion({ META_GRAPH_VERSION: "v22.0" }), "v26.0");
    assert.equal(resolveMetaEsJsSdkGraphVersion({ META_ES_JS_SDK_GRAPH_VERSION: "v25.0" }), "v25.0");
    const publicCfg = toPublicMetaEsConfig({
      appId: "1279182514183979",
      configId: "1590195526041278",
    });
    assert.equal(publicCfg.graphVersion, "v26.0");
  });

  it("lê META_CONFIG_ID com fallback META_ES_CONFIG_ID", () => {
    assert.equal(
      readMetaConfigIdFromEnv({ META_CONFIG_ID: "111", META_ES_CONFIG_ID: "222" }),
      "111",
    );
    assert.equal(readMetaConfigIdFromEnv({ META_ES_CONFIG_ID: "222" }), "222");
    assert.equal(mentionsMissingConfigId("Parâmetro inválido: config_id é obrigatório."), true);
  });
});
