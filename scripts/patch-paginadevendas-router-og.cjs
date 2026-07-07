#!/usr/bin/env node
/**
 * Patch Open Graph no bundle SSR da landing wabadisparos.com.br.
 * Arquivo alvo: /app/.output/server/_ssr/router-aV5ItMUH.mjs
 *
 * Aplica APENAS na landing wabadisparos (não toca no app waba.draxsistemas).
 * Variáveis de ambiente (opcionais — defaults abaixo):
 *   OG_IMAGE OG_TYPE OG_WIDTH OG_HEIGHT OG_TITLE OG_DESCRIPTION TW_DESCRIPTION ROUTER
 */
const fs = require("fs");

const DEFAULT_OG = {
  image: "https://waba.draxsistemas.com.br/media/OGwaba.jpg",
  type: "image/jpeg",
  width: "1200",
  height: "630",
  title: "DRAX WABA - Plataforma Oficial de Disparos WhatsApp",
  description:
    "Envie mensagens em massa pelo WhatsApp utilizando API Oficial e API Alternativa. Plataforma completa para automação, aquecimento de números e gestão de campanhas.",
  twitterDescription:
    "Envie mensagens em massa pelo WhatsApp utilizando API Oficial e API Alternativa.",
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
const ogTitle = process.env.OG_TITLE || DEFAULT_OG.title;
const ogDescription = process.env.OG_DESCRIPTION || DEFAULT_OG.description;
const twDescription = process.env.TW_DESCRIPTION || DEFAULT_OG.twitterDescription;

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

function esc(value) {
  return value.replace(/"/g, '\\"');
}

/** Atualiza content de uma meta { property|name: "<key>", content: "..." } se existir. */
function updateMetaContent(text, keyKind, key, value) {
  const re = new RegExp(
    `(\\{ ${keyKind}: "${key}", content: ")(?:[^"\\\\]|\\\\.)*(" \\})`,
  );
  if (re.test(text)) {
    console.log(`Atualizado ${key}`);
    return text.replace(re, `$1${esc(value)}$2`);
  }
  return text;
}

// og:image (insere/atualiza bloco)
if (source.includes(marker)) {
  source = stripOgImageMeta(source);
  if (!source.includes(anchor)) {
    console.error("ERRO: âncora twitter:card não encontrada após limpeza");
    process.exit(1);
  }
  fs.copyFileSync(routerPath, `${routerPath}.bak-og`);
  source = source.replace(anchor, ogBlock);
} else {
  if (!source.includes(anchor)) {
    console.error("ERRO: âncora não encontrada no router");
    process.exit(1);
  }
  fs.copyFileSync(routerPath, `${routerPath}.bak-og`);
  source = source.replace(anchor, ogBlock);
}

// título / descrição (só se as chaves já existirem — não quebra estrutura)
source = updateMetaContent(source, "property", "og:title", ogTitle);
source = updateMetaContent(source, "property", "og:description", ogDescription);
source = updateMetaContent(source, "name", "twitter:title", ogTitle);
source = updateMetaContent(source, "name", "twitter:description", twDescription);

fs.writeFileSync(routerPath, source, "utf8");
console.log("OK: OG wabadisparos aplicado →", ogImage);
