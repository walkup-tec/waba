import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  authorizeMetaOficialLabAccess,
  authorizeMetaOficialTokenMint,
  META_OFICIAL_LAB_GRAPH_PROXY_PATHS,
  META_OFICIAL_LAB_TOKEN_MINT_PATHS,
} from "./waba-meta-oficial-token-access";
import type { WabaRequestAuth } from "./waba-request-auth";

const DENIED: WabaRequestAuth[] = [
  { email: "", role: "guest" },
  { email: "assinante@exemplo.com", role: "subscriber" },
  { email: "ops@exemplo.com", role: "operacional" },
  { email: "suporte@exemplo.com", role: "suporte" },
];

describe("authorizeMetaOficialLabAccess", () => {
  it("guest é NEGADO (401)", () => {
    const result = authorizeMetaOficialLabAccess({ email: "", role: "guest" });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 401);
      assert.equal(/token|secret|Bearer/i.test(result.error), false);
    }
  });

  it("subscriber é NEGADO (403) e não acessa proxy Graph legado", () => {
    const result = authorizeMetaOficialLabAccess({
      email: "assinante@exemplo.com",
      role: "subscriber",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 403);
  });

  it("operacional é NEGADO (403) e não acessa proxy Graph legado", () => {
    const result = authorizeMetaOficialLabAccess({
      email: "ops@exemplo.com",
      role: "operacional",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 403);
  });

  it("suporte é NEGADO (403) e não acessa proxy Graph legado", () => {
    const result = authorizeMetaOficialLabAccess({
      email: "suporte@exemplo.com",
      role: "suporte",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 403);
  });

  it("master é permitido", () => {
    const result = authorizeMetaOficialLabAccess({
      email: "master@exemplo.com",
      role: "master",
    });
    assert.equal(result.ok, true);
  });

  it("authorizeMetaOficialTokenMint é o mesmo guard (sem duplicar regra)", () => {
    assert.equal(authorizeMetaOficialTokenMint, authorizeMetaOficialLabAccess);
  });
});

describe("rotas LAB Meta no backend", () => {
  const indexSrc = readFileSync(path.join(__dirname, "..", "index.ts"), "utf8");

  it("todas as rotas de mint/exchange e proxy Graph passam pelo guard antes do token", () => {
    assert.match(
      indexSrc,
      /async function metaEmbeddedSignupExchangeCodeHandler[\s\S]{0,180}rejectUnlessMetaOficialLab/,
    );
    for (const labeled of META_OFICIAL_LAB_TOKEN_MINT_PATHS) {
      const routePath = labeled.replace(/^POST\s+/, "");
      const marker = `app.post("${routePath}"`;
      const idx = indexSrc.indexOf(marker);
      assert.ok(idx >= 0, `rota ausente em src/index.ts: ${routePath}`);
      const window = indexSrc.slice(idx, idx + 280);
      const usesSharedExchange = window.includes("metaEmbeddedSignupExchangeCodeHandler");
      const hasInlineGuard = /rejectUnlessMetaOficialLab/.test(window);
      assert.ok(
        usesSharedExchange || hasInlineGuard,
        `guard ausente no registro de ${routePath}`,
      );
    }
    for (const labeled of META_OFICIAL_LAB_GRAPH_PROXY_PATHS) {
      const routePath = labeled.replace(/^POST\s+/, "");
      const marker = `app.post("${routePath}"`;
      const idx = indexSrc.indexOf(marker);
      assert.ok(idx >= 0, `rota ausente em src/index.ts: ${routePath}`);
      const window = indexSrc.slice(idx, idx + 420);
      const guardAt = window.indexOf("rejectUnlessMetaOficialLab");
      const graphAt = window.indexOf("callMetaGraphApi");
      assert.ok(guardAt >= 0, `guard ausente no handler de ${routePath}`);
      assert.ok(graphAt < 0 || guardAt < graphAt, `Graph antes do guard em ${routePath}`);
    }
  });

  it("config público do LAB não exige master (sem token no body)", () => {
    const idx = indexSrc.indexOf('app.get("/meta-oficial/embedded-signup/config"');
    assert.ok(idx >= 0);
    const window = indexSrc.slice(idx, idx + 450);
    assert.equal(window.includes("rejectUnlessMetaOficialLab"), false);
    assert.equal(/accessToken|access_token/.test(window), false);
  });

  it("papéis não-master são negados para o conjunto completo de rotas LAB", () => {
    for (const auth of DENIED) {
      const result = authorizeMetaOficialLabAccess(auth);
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.ok(result.status === 401 || result.status === 403);
      }
    }
    assert.equal(
      authorizeMetaOficialLabAccess({ email: "m@x.com", role: "master" }).ok,
      true,
    );
  });
});
