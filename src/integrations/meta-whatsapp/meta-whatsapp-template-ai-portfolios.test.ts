import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const html = readFileSync(path.join(__dirname, "../../../index.html"), "utf8");

describe("criação de template: portfólio e depois WABA", () => {
  it("o passo 1 escolhe um portfólio e o passo 2 a conta WABA", () => {
    assert.match(html, /id="meta-tpl-lab-portfolio"/);
    assert.match(html, /id="meta-tpl-lab-wabas"/);
    assert.match(html, /Selecione um portfólio/);
    assert.match(html, /Selecione a conta WABA/);
    assert.doesNotMatch(html, /cadastra o template em cada WABA/);
    assert.match(html, /function metaTplLabSelectedWabaIds/);
    assert.match(html, /wabaIds,/);
  });
});
