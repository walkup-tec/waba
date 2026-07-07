#!/usr/bin/env node
/**
 * Patch Open Graph no bundle SSR da landing wabadisparos.com.br.
 * Arquivo alvo: /app/.output/server/_ssr/router-aV5ItMUH.mjs
 *
 * Variáveis de ambiente (opcionais — defaults em wabadisparos-og.config.mjs):
 *   OG_IMAGE  OG_TYPE  OG_WIDTH  OG_HEIGHT  ROUTER
 */
const fs = require("fs");

const DEFAULT_OG = {
  image: "https://waba.draxsistemas.com.br/media/OGwaba.jpg",
  type: "image/jpeg",
  width: "1556",
  height: "1011",
};

const LEGACY_OG_URLS = [
  "http://agenciadigitalcorban.com.br/img/imagem-face2.jpg",
  "https://agenciadigitalcorban.com.br/img/imagem-face2.jpg",
  "https://waba.draxsistemas.com.br/media/imagem-face2.jpg",
  "https://raw.githubusercontent.com/walkup-tec/waba/master/paginadevendas/public/wabadisparos-og.jpg",
  "https://wabadisparos.com.br/wabadisparos-og.jpg",
];

const routerPath = process.env.ROUTER || "/app/.output/server/_ssr/router-aV5ItMUH.mjs";
const ogImage = process.env.OG_IMAGE || DEFAULT_OG.image;
const ogImageType = process.env.OG_TYPE || DEFAULT_OG.type;
const ogWidth = process.env.OG_WIDTH || DEFAULT_OG.width;
const ogHeight = process.env.OG_HEIGHT || DEFAULT_OG.height;

if (!fs.existsSync(routerPath)) {
  console.error("ERRO: router não encontrado:", routerPath);
  process.exit(1);
}

let source = fs.readFileSync(routerPath, "utf8");

for (const legacyUrl of LEGACY_OG_URLS) {
  if (source.includes(legacyUrl)) {
    source = source.split(legacyUrl).join(ogImage);
    console.log("Substituído legado:", legacyUrl);
  }
}

const marker = 'property: "og:image", content:';
const anchor =
  '{ property: "og:type", content: "website" },\n      { name: "twitter:card"';

const ogBlock =
  '{ property: "og:type", content: "website" },\n' +
  `      { property: "og:image", content: "${ogImage}" },\n` +
  `      { property: "og:image:type", content: "${ogImageType}" },\n` +
  `      { property: "og:image:width", content: "${ogWidth}" },\n` +
  `      { property: "og:image:height", content: "${ogHeight}" },\n` +
  '      { name: "twitter:card"';

function stripOgImageMeta(text) {
  return text
    .replace(/\n\s*\{ property: "og:image", content: "[^"]*" \},/g, "")
    .replace(/\n\s*\{ property: "og:image:type", content: "[^"]*" \},/g, "")
    .replace(/\n\s*\{ property: "og:image:width", content: "[^"]*" \},/g, "")
    .replace(/\n\s*\{ property: "og:image:height", content: "[^"]*" \},/g, "");
}

if (source.includes(marker)) {
  source = stripOgImageMeta(source);
  if (!source.includes(anchor)) {
    console.error("ERRO: âncora twitter:card não encontrada após limpeza");
    process.exit(1);
  }
  fs.copyFileSync(routerPath, `${routerPath}.bak-og`);
  source = source.replace(anchor, ogBlock);
  fs.writeFileSync(routerPath, source, "utf8");
  console.log("OK: og:image atualizado →", ogImage);
  process.exit(0);
}

if (!source.includes(anchor)) {
  console.error("ERRO: âncora não encontrada no router");
  process.exit(1);
}

fs.copyFileSync(routerPath, `${routerPath}.bak-og`);
source = source.replace(anchor, ogBlock);
fs.writeFileSync(routerPath, source, "utf8");
console.log("OK: og:image inserido →", ogImage);
