const fs = require("fs");
const path = require("path");

const repo = "H:\\Meu Drive\\Drive Profissional\\Waba";
const indexFile = path.join(repo, "index.html");
let text = fs.readFileSync(indexFile, "utf8");

const patchRoot = "C:\\Users\\Usuario\\.cursor\\projects\\e-Waba\\patch-waba";

if (!text.includes("admin-uptime-diagnose-btn")) {
  const css = fs.readFileSync(path.join(patchRoot, "index-css-snippet.css"), "utf8");
  text = text.replace(
    /(#tab-admin-monitor-cpu \.panel\.col-12 \{[^}]+\})/,
    `$1\n${css}`,
  );
}

if (!text.includes("admin-uptime-diagnose-overlay")) {
  const html = fs.readFileSync(path.join(patchRoot, "index-html-modal-snippet.html"), "utf8");
  text = text.replace(/(id="tab-admin-push")/, `${html}\n$1`);
}

if (!text.includes("canRunUptimeDiagnosticUi")) {
  const js = fs.readFileSync(path.join(patchRoot, "index-js-snippet.js"), "utf8");
  const renderBlock = js
    .split("=== SUBSTITUIR função renderUptimeLights em index.html ===")[1]
    .split("=== ADICIONAR em initAdminMonitorCpuUi")[0]
    .trim();
  text = text.replace(/function renderUptimeLights\(lights\) \{[\s\S]*?\n \}/, renderBlock);

  const initSnippet = js
    .split("=== ADICIONAR em initAdminMonitorCpuUi")[1]
    .split("===", 2)[0]
    .trim();
  text = text.replace(
    /(\}\);\r?\n \}\r?\n\r?\n function initAdminChamadosUi)/,
    `${initSnippet}\n$1`,
  );
}

fs.writeFileSync(indexFile, text, "utf8");

const checks = [
  "canRunUptimeDiagnosticUi",
  "admin-uptime-diagnose-overlay",
  "admin-uptime-diagnose-btn",
];
for (const c of checks) {
  console.log(c, text.includes(c) ? "OK" : "MISSING");
}
