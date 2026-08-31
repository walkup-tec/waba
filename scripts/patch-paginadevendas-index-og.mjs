#!/usr/bin/env node
/**
 * Injeta meta tags Open Graph no index.html da landing wabadisparos.com.br.
 * Uso: node scripts/patch-paginadevendas-index-og.mjs [caminho/index.html]
 */
import fs from "fs";
import path from "path";
import { WABADISPAROS_OG, WABADISPAROS_OG_LEGACY_URLS } from "./wabadisparos-og.config.mjs";

const indexPath = process.argv[2] || path.join(process.cwd(), "paginadevendas-index-live.html");
const siteUrl = "https://wabadisparos.com.br";
const ogImage = process.env.OG_IMAGE || WABADISPAROS_OG.image;
const ogImageType = process.env.OG_TYPE || WABADISPAROS_OG.type;
const ogWidth = process.env.OG_WIDTH || WABADISPAROS_OG.width;
const ogHeight = process.env.OG_HEIGHT || WABADISPAROS_OG.height;

const ogBlock = [
  `<meta property="og:image" content="${ogImage}"/>`,
  `<meta property="og:image:type" content="${ogImageType}"/>`,
  `<meta property="og:image:width" content="${ogWidth}"/>`,
  `<meta property="og:image:height" content="${ogHeight}"/>`,
  `<meta name="twitter:image" content="${ogImage}"/>`,
].join("");

let html = fs.readFileSync(indexPath, "utf8");

for (const legacyUrl of WABADISPAROS_OG_LEGACY_URLS) {
  html = html.split(legacyUrl).join(ogImage);
}

if (html.includes("og:image")) {
  html = html.replace(/<meta property="og:image"[^>]*\/?>/g, "");
  html = html.replace(/<meta property="og:image:[^"]+"[^>]*\/?>/g, "");
  html = html.replace(/<meta name="twitter:image"[^>]*\/?>/g, "");
}

html = html.replace(
  /<meta property="og:url" content="[^"]*"\/>/,
  `<meta property="og:url" content="${siteUrl}/"/>`,
);
html = html.replace(/<link rel="canonical" href="[^"]*"\/>/, `<link rel="canonical" href="${siteUrl}/"/>`);

if (!html.includes("og:image")) {
  html = html.replace(
    /<meta property="og:type" content="website"\/>/,
    `<meta property="og:type" content="website"/>${ogBlock}`,
  );
}

fs.writeFileSync(indexPath, html, "utf8");
console.log(`OK: OG injetado em ${indexPath} → ${ogImage}`);
