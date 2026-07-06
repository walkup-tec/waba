/**
 * Smoke test: POST multipart /disparos/campanhas/intake (sem sessão → 401).
 * Uso: node agent-tools/test-intake-multipart.mjs [baseUrl]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";

const base = (process.argv[2] || "http://127.0.0.1:3012/version-02").replace(/\/$/, "");
const tmpDir = join(process.cwd(), "agent-tools", ".tmp-intake");
mkdirSync(tmpDir, { recursive: true });

const xlsxPath = join(tmpDir, "leads.xlsx");
const wb = XLSX.utils.book_new();
const sheet = XLSX.utils.json_to_sheet([
  { nome: "Teste", telefone: "5511999999999" },
  { nome: "Teste 2", telefone: "5511888888888" },
]);
XLSX.utils.book_append_sheet(wb, sheet, "Leads");
writeFileSync(xlsxPath, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

const pngPath = join(tmpDir, "img.png");
const png1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
writeFileSync(pngPath, png1x1);

const form = new FormData();
form.append("campaignName", "Teste intake multipart");
form.append("regionDdd", "11");
form.append("textOption1", "Texto opcao um teste");
form.append("textOption2", "Texto opcao dois teste");
form.append("textOption3", "Texto opcao tres teste");
form.append("responseLink", "https://example.com/resposta");
form.append("apiKind", "oficial");
form.append("plannedSendCount", "2");
form.append("image", new Blob([readFileSync(pngPath)], { type: "image/png" }), "img.png");
form.append(
  "spreadsheet",
  new Blob([readFileSync(xlsxPath)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }),
  "leads.xlsx",
);

const url = `${base}/disparos/campanhas/intake`;
console.log("POST", url);
const response = await fetch(url, { method: "POST", body: form });
const text = await response.text();
console.log("status:", response.status);
console.log("body:", text.slice(0, 500));
