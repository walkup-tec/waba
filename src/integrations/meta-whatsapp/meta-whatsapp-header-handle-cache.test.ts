import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import {
  clearHeaderHandleCacheForTests,
  headerFileSha256,
  readCachedHeaderHandle,
  writeCachedHeaderHandle,
} from "./meta-whatsapp-header-handle-cache";

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
    assert.equal(readCachedHeaderHandle("tenant-header-1", sha, 1_000 + 46 * 60 * 1000), "");
    assert.equal(readCachedHeaderHandle("outro-tenant", sha, 1_000 + 10 * 60 * 1000), "");
  });
});
