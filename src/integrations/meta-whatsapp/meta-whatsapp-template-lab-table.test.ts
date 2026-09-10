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

  it("filtra a lista pelos botões Hoje e Ontem", () => {
    assert.match(html, /id="meta-tpl-lab-day-today"/);
    assert.match(html, /id="meta-tpl-lab-day-yesterday"/);
    assert.match(html, />\s*Hoje\s*</);
    assert.match(html, />\s*Ontem\s*</);
    assert.match(html, /function metaTplLabSetCreatedDayFilter/);
    assert.match(html, /function metaTplLabMatchesCreatedDay/);
    assert.match(html, /function metaTplLabTemplateCreatedAt/);
    assert.match(html, /metaTplLabMatchesCreatedDay\(entry\.item, createdDayKey\)/);
    assert.match(html, /<th style="text-align:left; padding:8px;">Criado em<\/th>/);
    assert.doesNotMatch(
      html,
      /<th style="text-align:left; padding:8px;">Última sincronização<\/th>/,
    );
    assert.doesNotMatch(html, /metaTplLabTemplateCreatedAt\(item\) \|\| .*\.lastSyncedAt/);
  });

  it("limpa todos os filtros e limita a tabela a 10 linhas com rolagem", () => {
    assert.match(html, /id="meta-tpl-lab-clear-filters"/);
    assert.match(html, />\s*Limpar filtros\s*</);
    assert.match(html, /function metaTplLabClearFilters/);
    assert.match(html, /class="meta-tpl-lab-table-wrap"/);
    assert.match(html, /max-height: calc\(37px \+ \(10 \* 41px\)\)/);
  });
});
