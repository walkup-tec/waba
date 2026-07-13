const fs = require("fs");
const p = "H:\\Meu Drive\\Drive Profissional\\Waba\\index.html";
const t = fs.readFileSync(p, "utf8");
const keys = [
  "canRunUptimeDiagnosticUi",
  "admin-uptime-diagnose-overlay",
  "admin-uptime-diagnose-btn",
  "runAdminUptimeDiagnose",
];
const out = keys.map((k) => `${k}: ${t.includes(k)}`).join("\n");
const idx = t.indexOf("function renderUptimeLights");
out += `\nrenderUptimeLights at: ${idx}`;
out += `\ninitAdminMonitorCpuUi at: ${t.indexOf("function initAdminMonitorCpuUi")}`;
fs.writeFileSync("H:\\Meu Drive\\Drive Profissional\\Waba\\scripts\\index-check.txt", out);
