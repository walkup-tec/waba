import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const html = readFileSync(path.join(__dirname, "../../../index.html"), "utf8");

describe("progresso ao lado de Conectar Portfólio", () => {
  it("mostra as etapas em português e o sucesso com check", () => {
    assert.match(html, /id="meta-tp-connect-progress"/);
    assert.match(html, /class="meta-connect-progress"/);
    assert.match(html, /function metaTpStartConnectProgress/);
    assert.match(html, /function metaTpFinishConnectProgress/);
    assert.match(html, /Consultando o portfólio na Meta/);
    assert.match(html, /Carregando as contas WABA/);
    assert.match(html, /Listando os números do WhatsApp/);
    assert.match(html, /Conexão concluída com sucesso/);
    assert.match(html, /wabaEnsureMetaPortfolioLoad/);
    assert.match(html, /meta-connect-progress-check/);
  });

  it("o bloco de progresso fica na mesma linha do botão Conectar Portfólio", () => {
    const heroStart = html.indexOf('class="meta-onboard-hero"');
    const connectBtn = html.indexOf('id="meta-tp-connect-btn"', heroStart);
    const progress = html.indexOf('id="meta-tp-connect-progress"', connectBtn);
    const heroEnd = html.indexOf("</div>", progress);
    assert.ok(heroStart >= 0 && connectBtn > heroStart);
    assert.ok(progress > connectBtn);
    assert.ok(heroEnd > progress);
  });
});
