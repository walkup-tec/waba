import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const html = readFileSync(path.join(__dirname, "../../../index.html"), "utf8");

describe("criação de template: portfólios e depois WABAs", () => {
  it("o passo 1 marca vários portfólios e o passo 2 as contas WABA", () => {
    assert.match(html, /id="meta-tpl-lab-portfolios"/);
    assert.match(html, /id="meta-tpl-lab-wabas"/);
    assert.match(html, /Marque os portfólios para ver as contas WABA/);
    assert.match(html, /function metaTplLabSelectedWabaTargets/);
    assert.match(html, /function metaTplMapGraphWabaItems/);
    assert.match(html, /wabaTargets,/);
    assert.doesNotMatch(html, /id="meta-tpl-lab-portfolio"/);
    assert.doesNotMatch(html, /cadastra o template em cada WABA/);
  });
});
