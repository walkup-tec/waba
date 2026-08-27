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

  it("produção: Laboratório só para Mozart", () => {
    const prod = { WABA_UI_PROFILE: "production" };
    assert.equal(canAccessWabaLaboratorioMenus("mozart.pmo@gmail.com", prod), true);
    assert.equal(canAccessWabaLaboratorioMenus("walkup@walkuptec.com.br", prod), false);
    assert.equal(canAccessWabaLaboratorioMenus("quantumivst@gmail.com", prod), false);
  });

  it("perfil full/v01 não restringe por e-mail", () => {
    assert.equal(canAccessWabaLaboratorioMenus("walkup@walkuptec.com.br", { WABA_UI_PROFILE: "full" }), true);
    assert.equal(canAccessWabaLaboratorioMenus("walkup@walkuptec.com.br", { WABA_ENV: "v01" }), true);
    assert.equal(isWabaUiProductionProfile({ WABA_ENV: "v01" }), false);
  });

  it("master walkup em produção não recebe menus do Laboratório", () => {
    const prev = process.env.WABA_UI_PROFILE;
    process.env.WABA_UI_PROFILE = "production";
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
      if (prev == null) delete process.env.WABA_UI_PROFILE;
      else process.env.WABA_UI_PROFILE = prev;
    }
  });

  it("master Mozart em produção mantém Laboratório", () => {
    const prev = process.env.WABA_UI_PROFILE;
    process.env.WABA_UI_PROFILE = "production";
    try {
      const perms = resolveEffectiveMenuPermissions({
        email: "mozart.pmo@gmail.com",
        role: "master",
        menuPermissions: null,
      });
      assert.equal(perms["whatsapp-oficial"], true);
      assert.equal(perms["whatsapp-inbox"], true);
    } finally {
      if (prev == null) delete process.env.WABA_UI_PROFILE;
      else process.env.WABA_UI_PROFILE = prev;
    }
  });
});
