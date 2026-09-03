import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

const dataRoot = mkdtempSync(path.join(os.tmpdir(), "waba-tpl-header-"));
const originalCwd = process.cwd();

describe("preview do cabeçalho de mídia do template", () => {
  it("guarda o arquivo local e monta a URL pública do GET autenticado", async () => {
    process.chdir(dataRoot);
    const {
      headerHandleFromComponents,
      headerHttpsUrlFromComponents,
      publicTemplateHeaderPreviewUrl,
      saveTemplateHeaderPreview,
    } = await import("./meta-whatsapp-template-header-preview.store");
    const handle = "4::abc-handle-local";
    const components = [
      { type: "HEADER", format: "IMAGE", example: { header_handle: [handle] } },
      { type: "BODY", text: "Olá" },
    ];
    assert.equal(headerHandleFromComponents(components), handle);
    assert.equal(headerHttpsUrlFromComponents(components), null);
    assert.equal(
      publicTemplateHeaderPreviewUrl({ id: "tpl-1", tenantId: "tenant-a", components }),
      null,
    );
    saveTemplateHeaderPreview({
      tenantId: "tenant-a",
      handle,
      mime: "image/png",
      fileName: "capa.png",
      bytes: Buffer.from("89504e470d0a", "hex"),
    });
    assert.equal(
      publicTemplateHeaderPreviewUrl({ id: "tpl-1", tenantId: "tenant-a", components }),
      "/integrations/meta/whatsapp/templates/tpl-1/header",
    );
    assert.equal(
      headerHttpsUrlFromComponents([
        {
          type: "HEADER",
          format: "IMAGE",
          example: { header_handle: ["https://lookaside.fbsbx.com/whatsapp/sample.png"] },
        },
      ]),
      "https://lookaside.fbsbx.com/whatsapp/sample.png",
    );
    process.chdir(originalCwd);
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("reusa o arquivo local pelo id do template depois que a Graph troca o handle por lookaside", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "waba-tpl-header-alias-"));
    process.chdir(root);
    const {
      copyTemplateHeaderPreview,
      publicTemplateHeaderPreviewUrl,
      readTemplateHeaderPreviewForSend,
      saveTemplateHeaderPreview,
    } = await import("./meta-whatsapp-template-header-preview.store");
    const handle = "4::abc-handle-local";
    const lookaside = "https://lookaside.fbsbx.com/whatsapp/sample.png";
    saveTemplateHeaderPreview({
      tenantId: "tenant-a",
      handle,
      mime: "video/mp4",
      fileName: "capa.mp4",
      bytes: Buffer.from("00000018667479706d703432", "hex"),
    });
    copyTemplateHeaderPreview({
      tenantId: "tenant-a",
      fromHandle: handle,
      toHandles: ["tpl-jandira-2", lookaside],
    });
    const preview = readTemplateHeaderPreviewForSend({
      tenantId: "tenant-a",
      handle: lookaside,
      templateId: "tpl-jandira-2",
    });
    assert.equal(preview?.mime, "video/mp4");
    assert.equal(
      publicTemplateHeaderPreviewUrl({
        id: "tpl-jandira-2",
        tenantId: "tenant-a",
        components: [
          { type: "HEADER", format: "VIDEO", example: { header_handle: [lookaside] } },
        ],
      }),
      "/integrations/meta/whatsapp/templates/tpl-jandira-2/header",
    );
    process.chdir(originalCwd);
    rmSync(root, { recursive: true, force: true });
  });

  it("reusa o arquivo local quando outro template compartilha o mesmo lookaside", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "waba-tpl-header-shared-"));
    process.chdir(root);
    const {
      bindTemplateHeaderPreview,
      publicTemplateHeaderPreviewUrl,
      readTemplateHeaderPreviewForSend,
      saveTemplateHeaderPreview,
    } = await import("./meta-whatsapp-template-header-preview.store");
    const lookaside = "https://lookaside.fbsbx.com/whatsapp/sample.png";
    saveTemplateHeaderPreview({
      tenantId: "tenant-a",
      handle: "tpl-primeiro",
      mime: "image/png",
      fileName: "capa.png",
      bytes: Buffer.from("89504e470d0a1a0a", "hex"),
    });
    bindTemplateHeaderPreview({
      tenantId: "tenant-a",
      handle: lookaside,
      previousHandle: "tpl-primeiro",
      templateId: "tpl-primeiro",
      name: "jandira_quantun_2",
      language: "pt_BR",
    });
    const second = readTemplateHeaderPreviewForSend({
      tenantId: "tenant-a",
      handle: lookaside,
      templateId: "tpl-segundo",
      name: "jandira_quantun_3",
      language: "pt_BR",
    });
    assert.equal(second?.mime, "image/png");
    assert.equal(
      publicTemplateHeaderPreviewUrl({
        id: "tpl-segundo",
        tenantId: "tenant-a",
        components: [{ type: "HEADER", format: "IMAGE", example: { header_handle: [lookaside] } }],
        name: "jandira_quantun_3",
        language: "pt_BR",
      }),
      "/integrations/meta/whatsapp/templates/tpl-segundo/header",
    );
    process.chdir(originalCwd);
    rmSync(root, { recursive: true, force: true });
  });
});
