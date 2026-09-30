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
    assert.match(html, /timeoutMs: force \? 60000 : 40000/);
    assert.match(html, /function metaTpResetSession\(opts\)/);
    assert.match(html, /keepPortfolios: true/);
    assert.match(html, /function metaTpReloadPortfoliosAfterConnect/);
    assert.match(html, /function metaTpHasListedNumbers/);
    assert.match(html, /function metaTpSyncConnectProgressFromAssets/);
    assert.match(html, /const selected = saved \|\| withNumbers\[0\] \|\| visible\[0\];/);
    assert.doesNotMatch(html, /saved && cardHasNumbers\(saved\)/);
    assert.match(html, /while \(attempt < 12\)/);
    assert.match(html, /Ainda lendo os números na Meta/);
    assert.doesNotMatch(html, /O servidor não concluiu a leitura dos números a tempo/);
    assert.match(html, /await metaTpLoadPortfolio\(\{[\s\S]*?force: true,[\s\S]*?businessId:/);
    assert.match(html, /Lendo WABA e números deste portfólio na Meta/);
    assert.match(
      html,
      /if \(force && metaTpPortfolioInflight\) \{[\s\S]{0,280}a carga anterior não bloqueia o Atualizar/,
    );
    assert.doesNotMatch(
      html,
      /a carga anterior não bloqueia o Atualizar[\s\S]{0,120}if \(metaTpHasListedNumbers\(\)\) return;/,
    );
    assert.doesNotMatch(html, /metaTpPortfolioPage === "ativas" && !ativas.length && restritas.length/);
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
