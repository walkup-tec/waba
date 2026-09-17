#!/usr/bin/env node
/**
 * Propaga a tabela única de venda para fallbacks de LP / créditos.
 *
 * Fonte: DISPAROS_*_SALE_PACKAGES em src/billing/waba-pricing.service.ts
 * Uso:   npm run sync:pricing
 *
 * Em produção o WABA já injeta o catálogo ao servir o HTML e as LPs
 * buscam GET /public/pricing. Este script só atualiza o texto-base
 * (SEO / first paint) nos arquivos estáticos.
 */
const fs = require("fs");
const path = require("path");

require("ts-node/register/transpile-only");

const { buildPublicSalePricingCatalog } = require("../src/billing/waba-sale-pricing-catalog");

const ROOT = path.join(__dirname, "..");
const catalog = buildPublicSalePricingCatalog();
const outrosFrom = catalog.outros.oficial.fromLabel;
const betsFrom = catalog.bets.oficial.fromLabel;

const replaceAll = (text, from, to) => {
  if (!from || from === to) return text;
  return text.split(from).join(to);
};

const patchFile = (filePath, mutator) => {
  if (!fs.existsSync(filePath)) {
    console.warn(`skip (ausente): ${filePath}`);
    return;
  }
  const before = fs.readFileSync(filePath, "utf8");
  const after = mutator(before);
  if (after === before) {
    console.log(`ok (sem mudança): ${path.relative(ROOT, filePath)}`);
    return;
  }
  fs.writeFileSync(filePath, after);
  console.log(`atualizado: ${path.relative(ROOT, filePath)}`);
};

const replaceFromPrice = (text, previousNeedle, nextLabel) => {
  let out = text;
  const needles = [previousNeedle, "R$ 0,29", "R$ 0,25", "R$ 0,30"].filter(
    (value, index, all) => value && all.indexOf(value) === index,
  );
  for (const needle of needles) {
    if (needle === nextLabel) continue;
    out = replaceAll(out, needle, nextLabel);
  }
  return out;
};

const replaceBetsFromPrice = (text, nextLabel) => {
  let out = text;
  for (const needle of ["R$ 0,38", "R$ 0,33"]) {
    if (needle === nextLabel) continue;
    out = replaceAll(out, needle, nextLabel);
  }
  return out;
};

patchFile(path.join(ROOT, "public-pages/vendas.html"), (html) => replaceFromPrice(html, outrosFrom, outrosFrom));
patchFile(path.join(ROOT, "public-pages/cadastro.html"), (html) => replaceFromPrice(html, outrosFrom, outrosFrom));
patchFile(path.join(ROOT, "public-pages/bets.html"), (html) => replaceBetsFromPrice(html, betsFrom));

const siblingOutros = [
  path.join(ROOT, "..", "pv-waba-disparador", "src/lib/waba-public-pricing.ts"),
  path.join(ROOT, "..", "pv-waba-disparador", "src/routes/index.tsx"),
  path.join(ROOT, "..", "pv-waba-disparador", "src/routes/__root.tsx"),
];
const siblingBets = [
  path.join(ROOT, "..", "betwaba-connect", "src/lib/waba-public-pricing.ts"),
  path.join(ROOT, "..", "betwaba-connect", "src/routes/index.tsx"),
  path.join(ROOT, "..", "betwaba-connect", "src/routes/cadastro.tsx"),
];

for (const filePath of siblingOutros) {
  patchFile(filePath, (text) => replaceFromPrice(text, "R$ 0,29", outrosFrom));
}
for (const filePath of siblingBets) {
  patchFile(filePath, (text) => replaceBetsFromPrice(text, betsFrom));
}

console.log("");
console.log(`Outros Oficial a partir de ${outrosFrom} · ${catalog.outros.oficial.rangeLabel}`);
console.log(`Bets Oficial a partir de ${betsFrom} · ${catalog.bets.oficial.rangeLabel}`);
console.log("Próximo passo: publicar o WABA e Redeploy do waba_disparador.");
