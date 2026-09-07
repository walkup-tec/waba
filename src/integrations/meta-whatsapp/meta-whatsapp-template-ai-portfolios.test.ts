import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const html = readFileSync(path.join(__dirname, "../../../index.html"), "utf8");

describe("criação de template com vários portfólios", () => {
  it("o passo 1 usa seleção múltipla de WABA, não um select único", () => {
    assert.match(html, /id="meta-tpl-lab-portfolios"/);
    assert.match(html, /cadastra o template em cada WABA/);
    assert.doesNotMatch(
      html,
      /<select id="meta-tpl-lab-portfolio">[\s\S]*Selecione um portfólio/,
    );
    assert.match(html, /function metaTplLabSelectedConnectionIds/);
    assert.match(html, /connectionIds,/);
  });
});
