/**
 * Gera src/generated-brand-logo.ts a partir de media/Drax-logo-footer.png
 * para a logo ir dentro de dist/index.js (sem depender de /app/media no runtime).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pngPath = path.join(root, "media", "Drax-logo-footer.png");
const outPath = path.join(root, "src", "generated-brand-logo.ts");

const header = `/**
 * Gerado por scripts/generate-brand-logo-module.mjs — não editar à mão.
 * Rode \`npm run build\` após alterar media/Drax-logo-footer.png
 */
`;

if (!fs.existsSync(pngPath)) {
  fs.writeFileSync(outPath, `${header}export const DRAX_LOGO_PNG_BASE64 = "";\n`);
  console.warn("[generate-brand-logo] media/Drax-logo-footer.png ausente → export vazio");
  process.exit(0);
}

const b64 = fs.readFileSync(pngPath).toString("base64");
const chunkSize = 100;
const lines = [];
for (let i = 0; i < b64.length; i += chunkSize) {
  lines.push(`  "${b64.slice(i, i + chunkSize)}",`);
}
const body = `export const DRAX_LOGO_PNG_BASE64 = [\n${lines.join("\n")}\n].join("");\n`;
fs.writeFileSync(outPath, header + body);
console.log("[generate-brand-logo] src/generated-brand-logo.ts OK (%s bytes PNG)", fs.statSync(pngPath).size);
