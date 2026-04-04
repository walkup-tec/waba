/**
 * Injeta a logo PNG em data-URI em dist/index.html após o copy-index-html.
 * Evita falhas quando /media/* não chega ao Node (proxy, cache, imagem em falta).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pngPath = path.join(root, "media", "Drax-logo-footer.png");
const distHtml = path.join(root, "dist", "index.html");

if (!fs.existsSync(pngPath)) {
  console.warn("[inline-brand-logo] skip: media/Drax-logo-footer.png ausente");
  process.exit(0);
}
if (!fs.existsSync(distHtml)) {
  console.error("[inline-brand-logo] dist/index.html ausente — rode o build antes");
  process.exit(1);
}

const b64 = fs.readFileSync(pngPath).toString("base64");
const dataUri = `data:image/png;base64,${b64}`;
let html = fs.readFileSync(distHtml, "utf8");
const before = html;
html = html.replace(/src="\/media\/Drax-logo-footer\.png"/g, `src="${dataUri}"`);
html = html.replace(/href="\/media\/Drax-logo-footer\.png"/g, `href="${dataUri}"`);

if (html === before) {
  console.warn("[inline-brand-logo] nenhum placeholder /media/Drax-logo-footer.png em dist/index.html");
} else {
  fs.writeFileSync(distHtml, html);
  console.log("[inline-brand-logo] dist/index.html: logo + favicon inlined (PNG)");
}
