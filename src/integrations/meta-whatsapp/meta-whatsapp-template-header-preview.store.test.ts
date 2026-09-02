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
});
