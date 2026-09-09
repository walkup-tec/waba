import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const html = readFileSync(path.join(__dirname, "../../../index.html"), "utf8");

describe("tabela de templates: coluna WABA no lugar de Qualidade", () => {
  it("lista a conta WABA de cada template", () => {
    assert.match(html, /<th style="text-align:left; padding:8px;">WABA<\/th>/);
    assert.match(html, /function metaTplLabWabaLabel/);
    assert.match(html, /function metaTplLabHydrateWabaNames/);
    assert.match(html, /const waba = escapeAdminHtml\(metaTplLabWabaLabel\(item\)\)/);
    assert.doesNotMatch(html, /<th style="text-align:left; padding:8px;">Qualidade<\/th>/);
    assert.doesNotMatch(html, /function metaTplLabQualityLabel/);
  });
});
