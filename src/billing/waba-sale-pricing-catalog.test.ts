import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  applySalePricingCopyToHtml,
  buildPublicSalePricingCatalog,
  formatBrlFromCents,
} from "./waba-sale-pricing-catalog";
import {
  DISPAROS_ALTERNATIVA_SALE_PACKAGES,
  DISPAROS_BETS_OFICIAL_SALE_PACKAGES,
  DISPAROS_OFICIAL_SALE_PACKAGES,
} from "./waba-pricing.service";

describe("catálogo público de preço de venda", () => {
  it("formata centavos em reais pt-BR", () => {
    assert.equal(formatBrlFromCents(29), "R$ 0,29");
    assert.equal(formatBrlFromCents(36000), "R$ 360,00");
    assert.equal(formatBrlFromCents(1900000), "R$ 19.000,00");
  });

  it("White Oficial usa o menor unitário como 'a partir de' e o primeiro pacote como mínimo", () => {
    const catalog = buildPublicSalePricingCatalog();
    assert.equal(catalog.outros.oficial.packages.length, DISPAROS_OFICIAL_SALE_PACKAGES.length);
    assert.equal(catalog.outros.oficial.fromLabel, "R$ 0,28");
    assert.equal(catalog.outros.oficial.rangeLabel, "De R$ 0,28 a R$ 0,36");
    assert.equal(catalog.outros.oficial.minPackageLabel, "R$ 1.800,00");
    assert.deepEqual(
      catalog.outros.oficial.packages.map((pack) => [pack.shipments, pack.valueCents]),
      DISPAROS_OFICIAL_SALE_PACKAGES.map((pack) => [pack.shipments, pack.valueCents]),
    );
  });

  it("Black Oficial e Alternativa saem da mesma tabela", () => {
    const catalog = buildPublicSalePricingCatalog();
    assert.equal(catalog.bets.oficial.fromLabel, "R$ 0,38");
    assert.equal(catalog.bets.oficial.rangeLabel, "De R$ 0,38 a R$ 0,45");
    assert.equal(catalog.outros.alternativa.fromLabel, "R$ 0,13");
    assert.equal(catalog.outros.alternativa.minPackageLabel, "R$ 200,00");
    assert.equal(catalog.bets.oficial.packages.length, DISPAROS_BETS_OFICIAL_SALE_PACKAGES.length);
    assert.equal(catalog.outros.alternativa.packages.length, DISPAROS_ALTERNATIVA_SALE_PACKAGES.length);
  });

  it("injeta LP, modal e créditos a partir do catálogo", () => {
    const catalog = buildPublicSalePricingCatalog();
    const html = applySalePricingCopyToHtml(
      [
        '<span data-sale-price="outros-oficial-range">De R$ 0,00 a R$ 0,00</span>',
        '<strong data-sale-price="outros-oficial-min">R$ 0,00</strong>',
        '<span data-sale-price="bets-oficial-from">R$ 0,00</span>',
        '<p>A partir de R$ 0,00 por envio</p>',
      ].join(""),
      { segment: "outros", catalog },
    );
    assert.match(html, /De R\$ 0,28 a R\$ 0,36/);
    assert.match(html, /R\$ 1\.800,00/);
    assert.match(html, /a partir de R\$ 0,28/);
    assert.match(html, new RegExp(catalog.bets.oficial.fromLabel.replace("$", "\\$")));
  });

  it("não corrompe JavaScript que consulta data-sale-price", () => {
    const source = [
      "scope.querySelectorAll('[data-sale-price=\"alternativa-range\"]').forEach((el) => {",
      "  el.textContent = altRange;",
      "});",
      '<span data-sale-price="alternativa-range">R$ 0,00</span>',
    ].join("\n");
    const html = applySalePricingCopyToHtml(source, { segment: "outros" });
    assert.match(html, /forEach\(\(el\) => \{/);
    assert.doesNotMatch(html, /forEach\(\(el\) =>De R\$/);
    assert.match(html, /<span data-sale-price="alternativa-range">De R\$ 0,13 a R\$ 0,20<\/span>/);
  });

  it("tela de créditos e páginas públicas já têm âncoras da rotina", () => {
    const indexHtml = readFileSync(path.join(process.cwd(), "index.html"), "utf8");
    assert.match(indexHtml, /data-sale-price="outros-oficial-range"/);
    assert.match(indexHtml, /data-sale-price="bets-oficial-range"/);
    assert.match(indexHtml, /data-sale-price="outros-oficial-min"/);
    assert.match(indexHtml, /\/public\/pricing/);
    assert.match(indexHtml, /applyPublicPricingCatalog/);

    const vendas = readFileSync(path.join(process.cwd(), "public-pages/vendas.html"), "utf8");
    const bets = readFileSync(path.join(process.cwd(), "public-pages/bets.html"), "utf8");
    assert.match(vendas, /data-sale-price="outros-oficial-from"/);
    assert.match(bets, /data-sale-price="bets-oficial-from"/);
  });
});
