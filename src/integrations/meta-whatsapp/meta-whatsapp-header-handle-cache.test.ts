import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import {
  clearHeaderHandleCacheForTests,
  headerFileSha256,
  pickReusableHeaderHandle,
  readCachedHeaderHandle,
  readPersistedHeaderHandle,
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
    assert.equal(readPersistedHeaderHandle("tenant-header-1", sha), "4::abc");
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
