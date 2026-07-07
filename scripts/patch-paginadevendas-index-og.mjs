#!/usr/bin/env node
/**
 * Injeta meta tags Open Graph no index.html da landing wabadisparos.com.br.
 * Uso: node scripts/patch-paginadevendas-index-og.mjs [caminho/index.html]
 */
import fs from "fs";
import path from "path";

const indexPath = process.argv[2] || path.join(process.cwd(), "paginadevendas-index-live.html");
const siteUrl = "https://wabadisparos.com.br";
const ogImage = process.env.OG_IMAGE || "https://waba.draxsistemas.com.br/media/OGwaba.jpg";
const ogImageType = process.env.OG_TYPE || "image/jpeg";
const ogWidth = process.env.OG_WIDTH || "1556";
const ogHeight = process.env.OG_HEIGHT || "1011";

const ogBlock = [
  `<meta property="og:image" content="${ogImage}"/>`,
  `<meta property="og:image:type" content="${ogImageType}"/>`,
  `<meta property="og:image:width" content="${ogWidth}"/>`,
  `<meta property="og:image:height" content="${ogHeight}"/>`,
  `<meta name="twitter:image" content="${ogImage}"/>`,
].join("");

let html = fs.readFileSync(indexPath, "utf8");
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
console.log(`OK: OG injetado em ${indexPath}`);
