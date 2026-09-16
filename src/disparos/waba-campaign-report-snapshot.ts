import { computeCampaignPerformanceMetrics } from "./waba-campaign-performance-metrics";
import {
  collectIntakeReportTimeline,
  formatCampaignReportDateTime,
  type SubscriberReportTimeline,
} from "./waba-campaign-report-timeline";
import { applyCampaignReportReadOverride, campaignReportShowsClicks } from "./waba-campaign-report-read-overrides";
import { campaignAttendedByLaboratorioStaff } from "./waba-campaign-laboratorio-attended";
import type { WabaCampaignIntake } from "./waba-campaign-intake.repository";
import { buildChromiumLaunchArgs } from "../marketing/leads-cnpj/waba-leads-cnpj-browser-runtime";

export type CampaignReportSnapshotInput = {
  campaignName: string;
  timeline: SubscriberReportTimeline;
  totalLeads: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  clicks?: number;
  showClicks?: boolean;
};

const escapeHtml = (value: string): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const formatNumber = (value: number): string =>
  Math.max(0, Math.round(Number(value) || 0)).toLocaleString("pt-BR");

const formatPercent = (value: number): string => `${value.toFixed(2).replace(".", ",")}%`;

export function buildCampaignReportSnapshotModel(
  intake: WabaCampaignIntake,
): CampaignReportSnapshotInput {
  const report = applyCampaignReportReadOverride(
    intake.campaignName,
    intake.createdAt,
    intake.performanceReport,
  );
  const showClicks =
    campaignReportShowsClicks(intake.campaignName, intake.createdAt, report) ||
    (campaignAttendedByLaboratorioStaff(intake) && report?.source === "meta_lab");
  return {
    campaignName: intake.campaignName,
    timeline: collectIntakeReportTimeline(intake),
    totalLeads: Math.max(0, Math.round(Number(report?.totalLeads ?? intake.plannedSendCount ?? 0))),
    sent: Math.max(0, Math.round(Number(report?.sent ?? 0))),
    delivered: Math.max(0, Math.round(Number(report?.delivered ?? 0))),
    read: Math.max(0, Math.round(Number(report?.read ?? 0))),
    failed: Math.max(0, Math.round(Number(report?.failed ?? 0))),
    clicks: Math.max(0, Math.round(Number(report?.clicks ?? 0))),
    showClicks,
  };
}

export function buildCampaignReportSnapshotHtml(input: CampaignReportSnapshotInput): string {
  const metrics = computeCampaignPerformanceMetrics({
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
      const display = String(item.display || formatCampaignReportDateTime(item.at)).trim();
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

export async function renderCampaignReportSnapshotPng(
  input: CampaignReportSnapshotInput,
): Promise<Buffer> {
  const html = buildCampaignReportSnapshotHtml(input);
  const pw = await import("playwright");
  const browser = await pw.chromium.launch({
    headless: true,
    args: buildChromiumLaunchArgs({ headless: true, hasXvfb: false }),
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
  } finally {
    await browser.close();
  }
}
