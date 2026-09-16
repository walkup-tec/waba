"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCampaignReportSnapshotModel = buildCampaignReportSnapshotModel;
exports.buildCampaignReportSnapshotHtml = buildCampaignReportSnapshotHtml;
exports.renderCampaignReportSnapshotPng = renderCampaignReportSnapshotPng;
const waba_campaign_performance_metrics_1 = require("./waba-campaign-performance-metrics");
const waba_campaign_report_timeline_1 = require("./waba-campaign-report-timeline");
const waba_campaign_report_read_overrides_1 = require("./waba-campaign-report-read-overrides");
const waba_campaign_laboratorio_attended_1 = require("./waba-campaign-laboratorio-attended");
const waba_leads_cnpj_browser_runtime_1 = require("../marketing/leads-cnpj/waba-leads-cnpj-browser-runtime");
const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const formatNumber = (value) => Math.max(0, Math.round(Number(value) || 0)).toLocaleString("pt-BR");
const formatPercent = (value) => `${value.toFixed(2).replace(".", ",")}%`;
function buildCampaignReportSnapshotModel(intake) {
    const report = (0, waba_campaign_report_read_overrides_1.applyCampaignReportReadOverride)(intake.campaignName, intake.createdAt, intake.performanceReport);
    const showClicks = (0, waba_campaign_report_read_overrides_1.campaignReportShowsClicks)(intake.campaignName, intake.createdAt, report) ||
        ((0, waba_campaign_laboratorio_attended_1.campaignAttendedByLaboratorioStaff)(intake) && report?.source === "meta_lab");
    return {
        campaignName: intake.campaignName,
        timeline: (0, waba_campaign_report_timeline_1.collectIntakeReportTimeline)(intake),
        totalLeads: Math.max(0, Math.round(Number(report?.totalLeads ?? intake.plannedSendCount ?? 0))),
        sent: Math.max(0, Math.round(Number(report?.sent ?? 0))),
        delivered: Math.max(0, Math.round(Number(report?.delivered ?? 0))),
        read: Math.max(0, Math.round(Number(report?.read ?? 0))),
        failed: Math.max(0, Math.round(Number(report?.failed ?? 0))),
        clicks: Math.max(0, Math.round(Number(report?.clicks ?? 0))),
        showClicks,
    };
}
function buildCampaignReportSnapshotHtml(input) {
    const metrics = (0, waba_campaign_performance_metrics_1.computeCampaignPerformanceMetrics)({
        totalLeads: input.totalLeads,
        sent: input.sent,
        delivered: input.delivered,
        read: input.read,
        failed: input.failed,
        clicks: input.showClicks ? input.clicks : 0,
    });
    const steps = (input.timeline?.items || [])
        .filter((item) => String(item.display || "").trim() && item.display !== "—")
        .map((item) => {
        const display = String(item.display || (0, waba_campaign_report_timeline_1.formatCampaignReportDateTime)(item.at)).trim();
        return `<li>
        <strong>${escapeHtml(item.label)}</strong>
        <span>${escapeHtml(display)}</span>
      </li>`;
    })
        .join("");
    const clickCards = input.showClicks
        ? `<article><span>Cliques</span><strong>${formatNumber(metrics.clicks)}</strong></article>
       <article class="rate"><span>Taxa de Cliques</span><strong>${formatPercent(metrics.clickRate)}</strong></article>`
        : "";
    return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <style>
    html, body { margin: 0; padding: 0; background: #0f172a; }
    body { font-family: Arial, Helvetica, sans-serif; color: #e2e8f0; }
    .sheet { width: 980px; padding: 28px 32px 32px; box-sizing: border-box; }
    h1 { margin: 0 0 6px; font-size: 26px; color: #fff; }
    .sub { margin: 0 0 18px; color: #94a3b8; font-size: 14px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 0 0 18px; }
    article { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 14px 16px; }
    article span { display: block; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.02em; margin-bottom: 6px; }
    article strong { font-size: 28px; color: #fff; }
    article.rate strong { color: #38bdf8; }
    .timeline { margin: 0 0 18px; padding: 0; list-style: none; }
    .timeline li { display: flex; justify-content: space-between; gap: 16px; padding: 8px 0; border-bottom: 1px solid #1e293b; }
    .timeline strong { color: #cbd5e1; }
    .timeline span { color: #94a3b8; text-align: right; }
    .brand { margin-top: 18px; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="sheet">
    <h1>${escapeHtml(input.campaignName || "Relatório da campanha")}</h1>
    <p class="sub">Campanha finalizada · relatório de desempenho</p>
    ${steps ? `<ol class="timeline">${steps}</ol>` : ""}
    <div class="kpis">
      <article><span>Enviados</span><strong>${formatNumber(metrics.sent)}</strong></article>
      <article><span>Entregues</span><strong>${formatNumber(metrics.delivered)}</strong></article>
      <article><span>Lidos</span><strong>${formatNumber(metrics.read)}</strong></article>
      <article><span>Falhados</span><strong>${formatNumber(metrics.failed)}</strong></article>
      <article class="rate"><span>Taxa de Entrega</span><strong>${formatPercent(metrics.deliveryRate)}</strong></article>
      <article class="rate"><span>Taxa de Leitura</span><strong>${formatPercent(metrics.readRate)}</strong></article>
      <article class="rate"><span>Taxa de Falha</span><strong>${formatPercent(metrics.failureRate)}</strong></article>
      ${clickCards}
    </div>
    <p class="brand">WABA · Drax Sistemas</p>
  </div>
</body>
</html>`;
}
async function renderCampaignReportSnapshotPng(input) {
    const html = buildCampaignReportSnapshotHtml(input);
    const pw = await Promise.resolve().then(() => __importStar(require("playwright")));
    const browser = await pw.chromium.launch({
        headless: true,
        args: (0, waba_leads_cnpj_browser_runtime_1.buildChromiumLaunchArgs)({ headless: true, hasXvfb: false }),
    });
    try {
        const page = await browser.newPage({
            viewport: { width: 1024, height: 1280 },
            deviceScaleFactor: 2,
        });
        await page.setContent(html, { waitUntil: "networkidle" });
        const sheet = page.locator(".sheet");
        const png = await sheet.screenshot({ type: "png" });
        return Buffer.from(png);
    }
    finally {
        await browser.close();
    }
}
