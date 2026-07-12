/**
 * Move Logs Sistema para dentro do tab Monitor CPU (divisão de páginas).
 * Remove menu lateral / tab separado admin-logs-sistema.
 */
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "index.html");
let html = fs.readFileSync(file, "utf8");

function must(cond, msg) {
  if (!cond) {
    console.error(msg);
    process.exit(1);
  }
}

// 1) Remove desktop sidebar button
{
  const re =
    /\n\s*<button\s+id="tab-btn-admin-logs-sistema"[\s\S]*?<span class="tab-label">Logs Sistema<\/span>\s*<\/button>/;
  must(re.test(html), "desktop logs button not found");
  html = html.replace(re, "");
}

// 2) Remove mobile button
{
  const re =
    /\n\s*<button\s+class="tab-button admin-tab-button admin-master-only"\s+type="button"\s+data-tab="admin-logs-sistema"[\s\S]*?<span>Logs Sistema<\/span>\s*<\/button>/;
  must(re.test(html), "mobile logs button not found");
  html = html.replace(re, "");
}

// 3) Remove CSS for separate tab
html = html.replace(
  /\n\s*body\.admin-section-active #waba-main > #tab-admin-logs-sistema:not\(\.tab-hidden\),\n\s*body\.suporte-section-active #waba-main > #tab-admin-logs-sistema:not\(\.tab-hidden\),/g,
  "",
);

// 4) Extract logs aquecedor body from separate panel, then remove panel
{
  const start = html.indexOf('<div id="tab-admin-logs-sistema"');
  must(start >= 0, "logs tab panel start not found");
  const end = html.indexOf('<div id="admin-uptime-diagnose-overlay"', start);
  must(end > start, "diagnose overlay after logs not found");
  const panel = html.slice(start, end);
  const aqStart = panel.indexOf('<div class="aquecedor-section">');
  must(aqStart >= 0, "logs aquecedor-section not found");
  // content inside aquecedor-section (without wrapper)
  const innerStart = aqStart + '<div class="aquecedor-section">'.length;
  // last </div> before </section>
  const sectionClose = panel.lastIndexOf("</section>");
  must(sectionClose > innerStart, "logs section close not found");
  let inner = panel.slice(innerStart, sectionClose);
  // trim trailing closing divs of aquecedor / row wrappers that belong outside
  inner = inner.replace(/\s*<\/div>\s*$/, "");
  html = html.slice(0, start) + html.slice(end);

  const switcher = `
              <div class="admin-monitor-pages admin-campanhas-buckets" id="admin-monitor-pages" role="tablist" aria-label="Páginas do Monitor CPU" style="margin:0 0 14px">
                <button type="button" class="admin-campanhas-bucket-btn is-active" data-monitor-page="cpu" role="tab" aria-selected="true">Monitor CPU</button>
                <button type="button" class="admin-campanhas-bucket-btn" data-monitor-page="logs" role="tab" aria-selected="false">Logs Sistema</button>
              </div>
`;

  const tabStart = html.indexOf('id="tab-admin-monitor-cpu"');
  must(tabStart >= 0, "monitor cpu tab not found");
  const aq = html.indexOf('<div class="aquecedor-section">', tabStart);
  must(aq >= 0, "monitor cpu aquecedor not found");

  const playbookNeedle =
    '<div id="admin-monitor-cpu-playbook" class="admin-monitor-cpu-playbook" hidden></div>';
  const playbookAt = html.indexOf(playbookNeedle, aq);
  must(playbookAt >= 0, "playbook needle not found");
  // aquecedor closes right after playbook
  const afterPlaybook = playbookAt + playbookNeedle.length;
  // expect "\n              </div>" closing aquecedor
  const aqClose = html.indexOf("\n              </div>", afterPlaybook);
  must(aqClose > afterPlaybook, "aquecedor close not found");

  const cpuOpen = `${switcher}\n              <div id="admin-monitor-cpu-page" class="admin-monitor-page" data-monitor-page-panel="cpu">\n`;
  const afterCpu =
    `\n              </div>\n` +
    `              <div id="admin-logs-sistema-page" class="admin-monitor-page" data-monitor-page-panel="logs" hidden>\n` +
    `                <div class="aquecedor-section">\n` +
    `${inner}\n` +
    `                </div>\n` +
    `              </div>`;

  html =
    html.slice(0, aq) +
    cpuOpen +
    html.slice(aq, aqClose) +
    afterCpu +
    html.slice(aqClose);
}

// 5) JS: suporte tab list / master gate
html = html.replace(
  'return tabName === "admin-chamados" || tabName === "admin-monitor-cpu" || tabName === "admin-logs-sistema" || tabName === "admin-push";',
  'return tabName === "admin-chamados" || tabName === "admin-monitor-cpu" || tabName === "admin-push";',
);
html = html.replace(
  'if (tabName === "admin-monitor-cpu" || tabName === "admin-logs-sistema") return !hasMasterAccess();',
  'if (tabName === "admin-monitor-cpu") return !hasMasterAccess();',
);

// 6) Remove separate tab activation branch
html = html.replace(
  /\s*} else if \(nextTab === "admin-logs-sistema"\) \{[\s\S]*?void loadAdminLogsSistema\(\);\n\s*\} else if \(nextTab === "admin-push"\) \{/,
  `\n        } else if (nextTab === "admin-push") {`,
);

// 7) On monitor cpu tab, keep page state + load logs when on logs page
html = html.replace(
  `        } else if (nextTab === "admin-monitor-cpu") {
          stopAquecedorEnviosPolling();
          stopDisparosCampaignsPolling();
          stopDisparosDashboardPolling();
          stopAdminCampanhasPolling();
          void loadAdminMonitorCpu();
          startAdminMonitorCpuPolling();
        } else if (nextTab === "admin-push") {`,
  `        } else if (nextTab === "admin-monitor-cpu") {
          stopAquecedorEnviosPolling();
          stopDisparosCampaignsPolling();
          stopDisparosDashboardPolling();
          stopAdminCampanhasPolling();
          syncAdminMonitorPage();
          if (adminMonitorPage === "logs") {
            stopAdminMonitorCpuPolling();
            void loadAdminLogsSistema();
          } else {
            void loadAdminMonitorCpu();
            startAdminMonitorCpuPolling();
          }
        } else if (nextTab === "admin-push") {`,
);

// 8) Add page switcher helpers near logs UI state
if (!html.includes("let adminMonitorPage")) {
  html = html.replace(
    "let adminLogsSistemaPreset = \"month\";\n      let adminLogsSistemaUiBound = false;",
    `let adminLogsSistemaPreset = "month";
      let adminLogsSistemaUiBound = false;
      let adminMonitorPage = "cpu";

      function syncAdminMonitorPage() {
        const cpuPage = document.getElementById("admin-monitor-cpu-page");
        const logsPage = document.getElementById("admin-logs-sistema-page");
        const summary = document.getElementById("admin-monitor-cpu-summary");
        document.querySelectorAll("#admin-monitor-pages [data-monitor-page]").forEach((btn) => {
          const active = btn.getAttribute("data-monitor-page") === adminMonitorPage;
          btn.classList.toggle("is-active", active);
          btn.setAttribute("aria-selected", active ? "true" : "false");
        });
        if (cpuPage) cpuPage.hidden = adminMonitorPage !== "cpu";
        if (logsPage) logsPage.hidden = adminMonitorPage !== "logs";
        if (summary) {
          summary.textContent =
            adminMonitorPage === "logs"
              ? "Histórico de conexão/desconexão e causas (Traefik, Yaml, Docker, Servidor)."
              : "Consumo da VPS em tempo quase real — alerta quando a CPU permanece alta por período sustentado.";
        }
      }

      function setAdminMonitorPage(page) {
        adminMonitorPage = page === "logs" ? "logs" : "cpu";
        syncAdminMonitorPage();
        if (adminMonitorPage === "logs") {
          stopAdminMonitorCpuPolling();
          void loadAdminLogsSistema();
        } else {
          void loadAdminMonitorCpu();
          startAdminMonitorCpuPolling();
        }
      }`,
  );
}

// 9) Bind page buttons in initAdminLogsSistemaUi / monitor init
if (!html.includes("data-monitor-page\"]")) {
  html = html.replace(
    "function initAdminLogsSistemaUi() {\n        if (adminLogsSistemaUiBound) return;\n        adminLogsSistemaUiBound = true;",
    `function initAdminLogsSistemaUi() {
        if (adminLogsSistemaUiBound) return;
        adminLogsSistemaUiBound = true;
        document.getElementById("admin-monitor-pages")?.addEventListener("click", (event) => {
          const btn = event.target.closest("[data-monitor-page]");
          if (!btn) return;
          setAdminMonitorPage(btn.getAttribute("data-monitor-page"));
        });
        syncAdminMonitorPage();`,
  );
}

// 10) Improve empty/error render for KPIs
html = html.replace(
  `        } catch (error) {
          if (statusEl) {
            statusEl.textContent =
              error instanceof Error ? error.message : "Falha ao carregar Logs Sistema.";
          }
        }
      }

      async function exportAdminLogsSistemaExcel() {`,
  `        } catch (error) {
          renderAdminLogsSistemaDashboard({
            kpis: {
              eventsPerDay: { conexao: 0, desconexao: 0 },
              hoursPerDay: { conexao: 0, desconexao: 0 },
              daysInRange: 1,
            },
            appsFailDay: [],
            appsFailWeek: [],
            appsFailMonth: [],
            events: [],
            generatedAt: new Date().toISOString(),
          });
          if (statusEl) {
            statusEl.textContent =
              error instanceof Error ? error.message : "Falha ao carregar Logs Sistema.";
          }
        }
      }

      async function exportAdminLogsSistemaExcel() {`,
);

fs.writeFileSync(file, html);
console.log("OK", {
  pages: html.includes("admin-monitor-pages"),
  logsPage: html.includes("admin-logs-sistema-page"),
  noSeparateTab: !html.includes('id="tab-admin-logs-sistema"'),
  noMenuBtn: !html.includes("tab-btn-admin-logs-sistema"),
  setPage: html.includes("setAdminMonitorPage"),
});
