import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAccessWabaLaboratorioMenus,
  isWabaLaboratorioOwnerEmail,
  isWabaUiProductionProfile,
} from "./waba-laboratorio-access";
import { resolveEffectiveMenuPermissions } from "./waba-menu-permissions.service";

describe("waba-laboratorio-access", () => {
  it("só Mozart é dono do Laboratório", () => {
    assert.equal(isWabaLaboratorioOwnerEmail("mozart.pmo@gmail.com"), true);
    assert.equal(isWabaLaboratorioOwnerEmail("Mozart.Pmo@gmail.com"), true);
    assert.equal(isWabaLaboratorioOwnerEmail("walkup@walkuptec.com.br"), false);
    assert.equal(isWabaLaboratorioOwnerEmail("quantumivst@gmail.com"), false);
  });

  it("localhost V02 libera Laboratório para validação", () => {
    const v02 = { WABA_ENV: "v02", RUNTIME_MODE: "development" };
    assert.equal(canAccessWabaLaboratorioMenus("walkup@walkuptec.com.br", v02), true);
    assert.equal(canAccessWabaLaboratorioMenus("mozart.pmo@gmail.com", v02), true);
  });

  it("produção e V02 com RUNTIME_MODE=production continuam só Mozart", () => {
    const prod = { WABA_UI_PROFILE: "production", WABA_ENV: "production", RUNTIME_MODE: "production" };
    assert.equal(canAccessWabaLaboratorioMenus("mozart.pmo@gmail.com", prod), true);
    assert.equal(canAccessWabaLaboratorioMenus("walkup@walkuptec.com.br", prod), false);
    assert.equal(canAccessWabaLaboratorioMenus("quantumivst@gmail.com", prod), false);
    assert.equal(
      canAccessWabaLaboratorioMenus("walkup@walkuptec.com.br", {
        WABA_ENV: "v02",
        RUNTIME_MODE: "production",
        WABA_UI_PROFILE: "production",
      }),
      false,
    );
  });

  it("perfil full/v01 não restringe por e-mail", () => {
    assert.equal(canAccessWabaLaboratorioMenus("walkup@walkuptec.com.br", { WABA_UI_PROFILE: "full" }), true);
    assert.equal(canAccessWabaLaboratorioMenus("walkup@walkuptec.com.br", { WABA_ENV: "v01" }), true);
    assert.equal(isWabaUiProductionProfile({ WABA_ENV: "v01" }), false);
  });

  it("master walkup em produção não recebe menus do Laboratório", () => {
    const prev = {
      ui: process.env.WABA_UI_PROFILE,
      env: process.env.WABA_ENV,
      runtime: process.env.RUNTIME_MODE,
    };
    process.env.WABA_UI_PROFILE = "production";
    process.env.WABA_ENV = "production";
    process.env.RUNTIME_MODE = "production";
    try {
      const perms = resolveEffectiveMenuPermissions({
        email: "walkup@walkuptec.com.br",
        role: "master",
        menuPermissions: null,
      });
      assert.equal(perms["whatsapp-oficial"], false);
      assert.equal(perms["whatsapp-inbox"], false);
      assert.equal(perms["whatsapp-templates"], false);
      assert.equal(perms["whatsapp-automation"], false);
      assert.equal(perms.dashboard, true);
    } finally {
      if (prev.ui == null) delete process.env.WABA_UI_PROFILE;
      else process.env.WABA_UI_PROFILE = prev.ui;
      if (prev.env == null) delete process.env.WABA_ENV;
      else process.env.WABA_ENV = prev.env;
      if (prev.runtime == null) delete process.env.RUNTIME_MODE;
      else process.env.RUNTIME_MODE = prev.runtime;
    }
  });

  it("master Mozart em produção mantém Laboratório", () => {
    const prev = {
      ui: process.env.WABA_UI_PROFILE,
      env: process.env.WABA_ENV,
      runtime: process.env.RUNTIME_MODE,
    };
    process.env.WABA_UI_PROFILE = "production";
    process.env.WABA_ENV = "production";
    process.env.RUNTIME_MODE = "production";
    try {
      const perms = resolveEffectiveMenuPermissions({
        email: "mozart.pmo@gmail.com",
        role: "master",
        menuPermissions: null,
      });
      assert.equal(perms["whatsapp-oficial"], true);
      assert.equal(perms["whatsapp-inbox"], true);
    } finally {
      if (prev.ui == null) delete process.env.WABA_UI_PROFILE;
      else process.env.WABA_UI_PROFILE = prev.ui;
      if (prev.env == null) delete process.env.WABA_ENV;
      else process.env.WABA_ENV = prev.env;
      if (prev.runtime == null) delete process.env.RUNTIME_MODE;
      else process.env.RUNTIME_MODE = prev.runtime;
    }
  });
});
