import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  META_ES_LEGACY_EXCHANGE_PATHS,
  META_ES_TECH_PROVIDER_PATHS,
  META_ES_UNAVAILABLE_MESSAGE,
  buildMetaEsFbLoginOptions,
  buildMetaEsOauthDialogUrl,
  buildMetaEsOauthLaunchUrl,
  buildMetaEsSetupPrefill,
  configIdLast4,
  isGenericFacebookOauthUrl,
  rewriteMetaEsOauthUrl,
  describeMetaEsBrowserSurface,
  isLegacyExchangePath,
  mentionsMissingConfigId,
  parseMetaEsOauthReturn,
  planMetaEsTechProviderClick,
  readMetaConfigIdFromEnv,
  META_ES_JS_SDK_GRAPH_VERSION,
  resolveFbLoginOptionsForAttempt,
  resolveMetaEsConfigId,
  resolveMetaEsJsSdkGraphVersion,
  shouldOpenMetaEsPopup,
  shouldUseMetaEsPageRedirect,
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
    assert.deepEqual(buildMetaEsSetupPrefill({ businessId: "1588459689692010" }), {});
    assert.deepEqual(buildMetaEsFbLoginOptions("1467449278208212", { business: { id: "1588459689692010" } })?.extras, {
      setup: {},
    });
    const plan = planMetaEsTechProviderClick("1467449278208212");
    assert.equal(plan.callFbInit, false);
    assert.equal(plan.openPageRedirect, true);
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

  it("login recusado pela Meta não pede Testador nem Parceiros", () => {
    const html = readFileSync(path.join(process.cwd(), "index.html"), "utf8");
    assert.match(html, /WABA_META_ES_LOGIN_BLOCKED_MESSAGE/);
    assert.match(html, /janela\/aba nova|nova janela\/aba/);
    assert.match(html, /AdsPower/);
    assert.match(html, /Grupo Walkup App/);
    assert.match(html, /wabaMetaEsBuildOauthDialogUrl/);
    assert.match(html, /wabaMetaEsBuildOauthLaunchUrl/);
    assert.match(html, /wabaMetaEsResumeLabOauthReturn/);
    assert.match(html, /wabaMetaEsOpenFacebook/);
    assert.match(html, /display", "page"/);
    assert.match(html, /popup=yes/);
    assert.match(html, /window\.open\(url, "_blank"\)/);
    assert.doesNotMatch(html, /adicione a conta deste perfil AdsPower como Testador/);
    assert.doesNotMatch(html, /Data Use Checkup/);
    assert.doesNotMatch(html, /troque web\.facebook\.com/);
    assert.doesNotMatch(html, /Parceiros → Adicionar/);
    assert.doesNotMatch(html, /window\.location\.assign\(dialogUrl\)/);
  });

  it("não reescreve web.facebook.com do SDK; AdsPower abre o wizard em janela nova", () => {
    const raw =
      "https://web.facebook.com/v26.0/dialog/oauth?app_id=1279182514183979&cbt=1790173659109&channel_url=https%3A%2F%2Fstaticxx.facebook.com%2Fx%2Fconnect%2Fxd_arbiter";
    assert.equal(rewriteMetaEsOauthUrl(raw, { configId: "1590195526041278" }), raw);
    const dialog = buildMetaEsOauthDialogUrl({
      appId: "1279182514183979",
      configId: "1590195526041278",
      redirectUri: "https://waba.draxsistemas.com.br/",
      state: "abc123",
    });
    assert.ok(dialog);
    const parsed = new URL(dialog);
    assert.equal(parsed.hostname, "web.facebook.com");
    assert.equal(parsed.searchParams.get("client_id"), "1279182514183979");
    assert.equal(parsed.searchParams.get("app_id"), "1279182514183979");
    assert.equal(parsed.searchParams.get("config_id"), "1590195526041278");
    assert.equal(parsed.searchParams.get("response_type"), "code");
    assert.equal(parsed.searchParams.get("display"), "page");
    assert.equal(parsed.searchParams.get("redirect_uri"), "https://waba.draxsistemas.com.br");
    assert.equal(parsed.searchParams.get("state"), "abc123");
    assert.match(String(parsed.searchParams.get("extras") || ""), /"setup":\{\}/);
    assert.equal("sessionInfoVersion" in JSON.parse(String(parsed.searchParams.get("extras"))), false);
    const launch = buildMetaEsOauthLaunchUrl({
      appId: "1279182514183979",
      configId: "1590195526041278",
      redirectUri: "https://waba.draxsistemas.com.br/",
      state: "abc123",
    });
    assert.ok(launch);
    const launchParsed = new URL(launch);
    assert.equal(launchParsed.hostname, "web.facebook.com");
    assert.equal(launchParsed.pathname, "/login/reauth.php");
    assert.equal(launchParsed.searchParams.get("app_id"), "1279182514183979");
    assert.equal(launchParsed.searchParams.get("signed_next"), "1");
    assert.match(String(launchParsed.searchParams.get("next") || ""), /config_id=1590195526041278/);
    assert.doesNotMatch(launch, /www\.facebook\.com/);
    assert.equal(
      shouldUseMetaEsPageRedirect({ preferPage: true }),
      true,
    );
    assert.equal(
      shouldUseMetaEsPageRedirect({
        userAgent: "Mozilla/5.0 Chrome/120",
        windowOpen: function hookedOpen() {
          return null;
        },
      }),
      true,
    );
    assert.equal(shouldUseMetaEsPageRedirect({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120" }), false);
    assert.equal(shouldUseMetaEsPageRedirect({ userAgent: "Mozilla/5.0 AdsPower SunBrowser Chrome/120" }), true);
    const returned = parseMetaEsOauthReturn("?code=AQC123&state=abc123&waba_id=waba-9");
    assert.equal(returned.code, "AQC123");
    assert.equal(returned.state, "abc123");
    assert.equal(returned.wabaId, "waba-9");
    const surface = describeMetaEsBrowserSurface({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120",
      userAgentData: { mobile: false, platform: "Windows" },
    });
    assert.equal(surface.adsPowerNativeWebHost, false);
    assert.equal(surface.adsPowerLike, false);
    assert.equal(surface.mobileHint, false);
  });

  it("botão + sem WABA não envia extras.setup só com BM", () => {
    const html = readFileSync(path.join(process.cwd(), "index.html"), "utf8");
    assert.match(html, /wabaAddMetaWhatsappNumber/);
    assert.match(
      html,
      /businessId && wabaId\s*\n\s*\? \{ business: \{ id: businessId \}, whatsAppBusinessAccount: \{ ids: wabaId \} \}/,
    );
    assert.doesNotMatch(html, /if \(metaTpSession\.savedBusinessId\) setup\.business/);
    assert.match(html, /if \(businessId && wabaId\) \{\s*\n\s*extrasSetup\.business/);
  });
});
