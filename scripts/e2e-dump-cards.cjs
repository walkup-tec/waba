/**
 * Diagnóstico: login + filtros mínimos + pesquisar + dump DOM dos cards.
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}
const parent = path.resolve(__dirname, "../..");
loadEnvFile(path.join(parent, ".env.v02"));

(async () => {
  const email = process.env.CASADOSDADOS_EMAIL;
  const password = process.env.CASADOSDADOS_PASSWORD;
  const browser = await chromium.launch({ headless: false, slowMo: 20 });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("https://portal.casadosdados.com.br/entrar", { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="senha"]').fill(password);
  await page.locator('button:has-text("Acessar")').click();
  await page.waitForTimeout(2000);
  await page.goto("https://portal.casadosdados.com.br/plataforma/pesquisa", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(1500);

  // CNAE quick via evaluate (same as adapter)
  await page.evaluate(() => {
    const lab = Array.from(document.querySelectorAll("label")).find((el) =>
      /Atividade\s+Principal\s*\(CNAE\)/i.test(String(el.textContent || "")),
    );
    lab?.click();
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input"));
    const target = inputs.find((el) => {
      const ph = String(el.placeholder || "").toLowerCase();
      return el.type === "search" || /atividade|cnae/.test(ph);
    });
    if (!target) return;
    const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    proto?.set?.call(target, "6619302");
    target.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const box = Array.from(document.querySelectorAll('input[type="checkbox"]')).find((b) =>
      String(b.id || "").includes("6619302") ||
      String(b.closest("label")?.textContent || "").includes("6619302"),
    );
    if (box && !box.checked) box.click();
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      /^Fechar$/i.test(String(b.textContent || "").trim()),
    );
    btn?.click();
  });
  await page.waitForTimeout(500);

  // Scroll Pesquisar into view and click
  await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll("a,button")).find((el) =>
      /^Pesquisar$/i.test(String(el.textContent || "").trim()),
    );
    a?.scrollIntoView({ block: "center" });
    a?.click();
  });
  await page.waitForTimeout(8000);

  const dump = await page.evaluate(() => {
    const root = document.querySelector("main") || document.body;
    const sample = String(root.innerText || "").slice(0, 3000);
    const cnpjRe = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/;
    const hits = [];
    for (const el of Array.from(root.querySelectorAll("*")).slice(0, 4000)) {
      const t = String(el.textContent || "").replace(/\s+/g, " ").trim();
      if (t.length < 14 || t.length > 200) continue;
      if (!cnpjRe.test(t)) continue;
      hits.push({
        tag: el.tagName,
        cls: typeof el.className === "string" ? el.className.slice(0, 80) : "",
        text: t.slice(0, 160),
      });
      if (hits.length >= 15) break;
    }
    const nav = Boolean(document.querySelector('nav[data-oruga="pagination"]'));
    return { nav, hits, sample };
  });

  fs.writeFileSync(
    path.join(parent, ".tmp-e2e-cards-dump.json"),
    JSON.stringify(dump, null, 2),
    "utf8",
  );
  console.log(JSON.stringify({ nav: dump.nav, hits: dump.hits.length, first: dump.hits[0] }, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
