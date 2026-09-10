import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import {
  clearHeaderHandleCacheForTests,
  headerFileSha256,
  pickReusableHeaderHandle,
  readCachedHeaderHandle,
  writeCachedHeaderHandle,
} from "./meta-whatsapp-header-handle-cache";
import { saveTemplateHeaderPreview } from "./meta-whatsapp-template-header-preview.store";

describe("cache de handle de cabeçalho", () => {
  const prevCwd = process.cwd();
  let root = "";

  before(() => {
    root = mkdtempSync(path.join(tmpdir(), "waba-header-handle-"));
    process.chdir(root);
    clearHeaderHandleCacheForTests();
  });

  after(() => {
    process.chdir(prevCwd);
    rmSync(root, { recursive: true, force: true });
    clearHeaderHandleCacheForTests();
  });

  it("reusa o handle da mesma foto dentro do TTL e esquece depois", () => {
    const bytes = Buffer.from("jandira-1080");
    const sha = headerFileSha256(bytes);
    assert.equal(readCachedHeaderHandle("tenant-header-1", sha), "");
    writeCachedHeaderHandle("tenant-header-1", sha, "4::abc", 1_000);
    assert.equal(readCachedHeaderHandle("tenant-header-1", sha, 1_000 + 10 * 60 * 1000), "4::abc");
    assert.equal(readCachedHeaderHandle("tenant-header-1", sha, 1_000 + 46 * 60 * 1000), "4::abc");
    assert.equal(readCachedHeaderHandle("tenant-header-1", sha, 1_000 + 8 * 24 * 60 * 60 * 1000), "");
    assert.equal(readCachedHeaderHandle("outro-tenant", sha, 1_000 + 10 * 60 * 1000), "");
  });

  it("ignora cache sem source=upload (4:: velho de template)", () => {
    const bytes = Buffer.from("jandira-poison");
    const sha = headerFileSha256(bytes);
    const dir = path.join(process.cwd(), "data", "meta-whatsapp", "template-headers", "tenant-header-poison", "handles");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, `${sha}.json`), JSON.stringify({ handle: "4::stale-from-template", at: Date.now() }));
    assert.equal(readCachedHeaderHandle("tenant-header-poison", sha), "");
  });

  it("reusa o handle 4:: de um template que já tem a mesma foto local", () => {
    const bytes = Buffer.from("jandira-mesmo-png");
    saveTemplateHeaderPreview({
      tenantId: "tenant-header-reuse",
      handle: "4::jandira-old",
      mime: "image/png",
      fileName: "header.png",
      bytes,
    });
    const picked = pickReusableHeaderHandle({
      tenantId: "tenant-header-reuse",
      bytes,
      rows: [
        {
          id: "tpl-1",
          name: "jandira_v2",
          language: "pt_BR",
          components: [{ type: "HEADER", format: "IMAGE", example: { header_handle: ["4::jandira-old"] } }],
        },
      ],
    });
    assert.equal(picked.resumable, "4::jandira-old");
    assert.equal(picked.any, "4::jandira-old");
  });
});
