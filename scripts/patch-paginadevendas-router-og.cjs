#!/usr/bin/env node
/**
 * Patch Open Graph no bundle SSR da landing wabadisparos.com.br.
 * Arquivo alvo: /app/.output/server/_ssr/router-aV5ItMUH.mjs
 *
 * Variáveis de ambiente:
 *   OG_IMAGE   — URL og:image (obrigatório)
 *   OG_TYPE    — og:image:type (default: image/jpg)
 *   OG_WIDTH   — og:image:width (default: 800)
 *   OG_HEIGHT  — og:image:height (default: 600)
 *   ROUTER     — caminho do router (opcional)
 */
const fs = require("fs");

const routerPath = process.env.ROUTER || "/app/.output/server/_ssr/router-aV5ItMUH.mjs";
const ogImage = process.env.OG_IMAGE || "https://waba.draxsistemas.com.br/media/OGwaba.jpg";
const ogImageType = process.env.OG_TYPE || "image/jpeg";
const ogWidth = process.env.OG_WIDTH || "1556";
const ogHeight = process.env.OG_HEIGHT || "1011";

if (!fs.existsSync(routerPath)) {
  console.error("ERRO: router não encontrado:", routerPath);
  process.exit(1);
}

let source = fs.readFileSync(routerPath, "utf8");
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
  console.log("OK: og:image atualizado");
  process.exit(0);
}

if (!source.includes(anchor)) {
  console.error("ERRO: âncora não encontrada no router");
  process.exit(1);
}

fs.copyFileSync(routerPath, `${routerPath}.bak-og`);
source = source.replace(anchor, ogBlock);
fs.writeFileSync(routerPath, source, "utf8");
console.log("OK: og:image inserido");
