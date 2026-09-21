import { computeCampaignPerformanceMetrics } from "./waba-campaign-performance-metrics";
import {
  collectIntakeReportTimeline,
  formatCampaignReportDateTime,
  META_REPORT_COLLECTION_NOTE,
  type SubscriberReportTimeline,
} from "./waba-campaign-report-timeline";
import { applyCampaignReportReadOverride, campaignReportShowsClicks } from "./waba-campaign-report-read-overrides";
import { campaignAttendedByLaboratorioStaff } from "./waba-campaign-laboratorio-attended";
import type { WabaCampaignIntake } from "./waba-campaign-intake.repository";
import { findBroadcastByIntakeCampaignId } from "../integrations/meta-whatsapp/meta-whatsapp-broadcast.store";
import { extraSlugsForIntake, resolveBoundCampaignClicks } from "../integrations/meta-whatsapp/meta-whatsapp-broadcast-short-link";
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
  reportSource?: string;
};

const TIMEZONE = "America/Sao_Paulo";

const escapeHtml = (value: string): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const formatNumber = (value: number): string =>
  Math.max(0, Math.round(Number(value) || 0)).toLocaleString("pt-BR");

const formatPercent = (value: number): string => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "0,00%";
  return `${parsed.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
};

type PieSegment = { label: string; value: number; pct: number; color: string };

function buildCampaignPieGradient(segments: PieSegment[], totalLeads: number): string {
  const base = Math.max(totalLeads, 1);
  let accPct = 0;
  const stops: string[] = [];
  for (const segment of segments) {
    const value = Math.max(0, Math.round(Number(segment.value) || 0));
    if (value < 1) continue;
    const pct = (value / base) * 100;
    const startDeg = accPct * 3.6;
    accPct += pct;
    const endDeg = accPct * 3.6;
    stops.push(`${segment.color} ${startDeg}deg ${endDeg}deg`);
  }
  if (!stops.length) return "conic-gradient(#64748b 0deg 360deg)";
  return `conic-gradient(${stops.join(", ")})`;
}

function formatTimelineWhen(item: { display?: string; at?: string | null }): {
  iso: string;
  full: string;
  date: string;
  time: string;
} {
  const full = String(item?.display || "").trim();
  const iso = String(item?.at || "").trim();
  if (iso) {
    const date = new Date(iso);
    if (!Number.isNaN(date.getTime())) {
      return {
        iso,
        full: full || iso,
        date: date.toLocaleDateString("pt-BR", {
          timeZone: TIMEZONE,
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        time: date.toLocaleTimeString("pt-BR", {
          timeZone: TIMEZONE,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
      };
    }
  }
  const idx = full.lastIndexOf(" - ");
  if (idx === -1) return { iso: "", full, date: full, time: "" };
  return { iso: "", full, date: full.slice(0, idx).trim(), time: full.slice(idx + 3).trim() };
}

function buildSubscriberCampaignTimelineHtml(timeline: SubscriberReportTimeline): string {
  const items = (timeline?.items || []).filter((item) => {
    const display = String(item.display || formatCampaignReportDateTime(item.at)).trim();
    return display && display !== "—";
  });
  const note = escapeHtml(String(timeline?.metaCollectionNote || "").trim() || META_REPORT_COLLECTION_NOTE);
  const lastIndex = items.length - 1;
  const steps = items
    .map((item, index) => {
      const label = escapeHtml(String(item.label || ""));
      const when = formatTimelineWhen({
        display: item.display || formatCampaignReportDateTime(item.at),
        at: item.at,
      });
      const full = escapeHtml(when.full);
      const date = escapeHtml(when.date);
      const time = escapeHtml(when.time);
      const isoAttr = when.iso ? ` datetime="${escapeHtml(when.iso)}"` : "";
      const latestClass = index === lastIndex ? " is-latest" : "";
      const timeHtml = time ? `<span class="camp-report-timeline-step-time">${time}</span>` : "";
      return `<li class="camp-report-timeline-step is-done${latestClass}" title="${full}">
              <span class="camp-report-timeline-marker" aria-hidden="true"></span>
              <span class="camp-report-timeline-step-label">${label}</span>
              <time class="camp-report-timeline-step-when"${isoAttr}>
                <span class="camp-report-timeline-sr">${full}</span>
                <span class="camp-report-timeline-step-date">${date}</span>
                ${timeHtml}
              </time>
            </li>`;
    })
    .join("");
  return `
          <section class="camp-report-timeline" aria-label="Linha do tempo da campanha">
            ${
              items.length
                ? `<h4 class="camp-report-timeline-title">Linha do tempo</h4>
            <ol class="camp-report-timeline-track" style="--steps: ${items.length}">${steps}</ol>`
                : ""
            }
            <p class="camp-report-meta-delay-note">${note}</p>
          </section>
        `;
}

function buildCampaignPerformanceDashboardHtml(input: CampaignReportSnapshotInput): string {
  const metrics = computeCampaignPerformanceMetrics({
    totalLeads: input.totalLeads,
    sent: input.sent,
    delivered: input.delivered,
    read: input.read,
    failed: input.failed,
    clicks: input.showClicks ? input.clicks : 0,
  });
  const showClicks = input.showClicks === true;
  const reportSource = String(input.reportSource || "").trim();
  const campaignName = String(input.campaignName || "").trim();
  const pieBase = Math.max(metrics.totalLeads, 1);
  const pieLegend: PieSegment[] = [
    {
      label: "Entregues",
      value: metrics.delivered,
      pct: (metrics.delivered / pieBase) * 100,
      color: "#fb923c",
    },
    {
      label: "Falhados",
      value: metrics.failed,
      pct: (metrics.failed / pieBase) * 100,
      color: "#f87171",
    },
  ];
  if (metrics.bonusShipments > 0) {
    pieLegend.push({
      label: "Créditos bonificados",
      value: metrics.bonusShipments,
      pct: (metrics.bonusShipments / pieBase) * 100,
      color: "#38bdf8",
    });
  }
  if (metrics.pendingSent > 0) {
    pieLegend.push({
      label: "Enviados (pendentes)",
      value: metrics.pendingSent,
      pct: (metrics.pendingSent / pieBase) * 100,
      color: "#64748b",
    });
  }
  const pieGradient = buildCampaignPieGradient(pieLegend, metrics.totalLeads);
  const subtitle = campaignName
    ? `<p class="confirm-text" style="margin:0 0 4px">${escapeHtml(campaignName)}</p>`
    : "";
  const pieLegendHtml = pieLegend
    .map(
      (item) => `
              <li>
                <span>
                  <span class="camp-report-swatch" style="background:${item.color}"></span>
                  ${escapeHtml(item.label)}
                </span>
                <strong>${formatNumber(item.value)} (${formatPercent(item.pct)})</strong>
              </li>
            `,
    )
    .join("");
  const finalizedLegend =
    reportSource === "meta_lab"
      ? "Progresso = 100% (relatório gerado com dados da Meta)."
      : "Progresso = 100% (campanha finalizada pelo operacional).";
  const clickFormula = showClicks ? " · Taxa de cliques = Cliques ÷ Entregues × 100" : "";
  const formulaLegend = `${finalizedLegend} Taxa de entrega = Entregues ÷ Enviados × 100 · Taxa de leitura = Lidos ÷ Entregues × 100 · Taxa de falha = Falhados ÷ Total de Leads × 100${clickFormula} · Créditos bonificados = Total de Leads − Enviados (creditados na próxima compra).`;
  const clicksCard = showClicks
    ? `
              <article class="camp-report-metric camp-report-metric--clicks">
                <span class="camp-report-metric-label">Cliques</span>
                <span class="camp-report-metric-value">${formatNumber(metrics.clicks)}</span>
              </article>`
    : "";
  const clickRateCard = showClicks
    ? `
                <article class="camp-report-rate camp-report-rate--click">
                  <span class="camp-report-rate-label">Taxa de Cliques</span>
                  <span class="camp-report-rate-value">${formatPercent(metrics.clickRate)}</span>
                </article>`
    : "";

  return `
          ${subtitle}
          <section class="camp-report-block">
            <div class="camp-report-progress-head">
              <h4 class="camp-report-block-title" style="margin:0">Progresso</h4>
              <span class="camp-report-progress-value">${formatPercent(100)}</span>
            </div>
            <div class="camp-report-progress-track" aria-hidden="true">
              <div class="camp-report-progress-bar" style="width:100%"></div>
            </div>
          </section>
          <section class="camp-report-block">
            <h4 class="camp-report-block-title">Contagem de Mensagens</h4>
            <div class="camp-report-metrics-row${showClicks ? " camp-report-metrics-row--clicks" : ""}">
              <article class="camp-report-metric camp-report-metric--leads">
                <span class="camp-report-metric-label">Total de Leads</span>
                <span class="camp-report-metric-value">${formatNumber(metrics.totalLeads)}</span>
              </article>
              <article class="camp-report-metric camp-report-metric--sent">
                <span class="camp-report-metric-label">Enviados</span>
                <span class="camp-report-metric-value">${formatNumber(metrics.sent)}</span>
              </article>
              <article class="camp-report-metric camp-report-metric--delivered">
                <span class="camp-report-metric-label">Entregues</span>
                <span class="camp-report-metric-value">${formatNumber(metrics.delivered)}</span>
              </article>
              <article class="camp-report-metric camp-report-metric--read">
                <span class="camp-report-metric-label">Lidos</span>
                <span class="camp-report-metric-value">${formatNumber(metrics.read)}</span>
              </article>
              <article class="camp-report-metric camp-report-metric--failed">
                <span class="camp-report-metric-label">Falhados</span>
                <span class="camp-report-metric-value">${formatNumber(metrics.failed)}</span>
              </article>
              ${clicksCard}
            </div>
          </section>
          ${
            metrics.bonusShipments > 0
              ? `
                <div class="camp-report-reimbursement">
                  <strong>Créditos bonificados: ${formatNumber(metrics.bonusShipments)} envio(s)</strong>
                  <span class="camp-report-reimbursement-detail">
                    Envios contratados (${formatNumber(metrics.totalLeads)}) − enviados (${formatNumber(metrics.sent)}) = créditos bonificados, creditados na próxima compra de envios.
                  </span>
                </div>
              `
              : ""
          }
          <div class="camp-report-main-grid">
            <section class="camp-report-pie-card">
              <h4 class="camp-report-block-title">Distribuição (Total de Leads)</h4>
              <div class="camp-report-pie-wrap">
                <div class="camp-report-pie" style="background:${pieGradient}" role="img" aria-label="Gráfico de pizza da distribuição de leads"></div>
                <ul class="camp-report-pie-legend">${pieLegendHtml}</ul>
              </div>
            </section>
            <section class="camp-report-rates-card">
              <h4 class="camp-report-block-title">Taxas de Performance</h4>
              <div class="camp-report-rates-grid${showClicks ? " camp-report-rates-grid--clicks" : ""}">
                <article class="camp-report-rate camp-report-rate--delivery">
                  <span class="camp-report-rate-label">Taxa de Entrega</span>
                  <span class="camp-report-rate-value">${formatPercent(metrics.deliveryRate)}</span>
                </article>
                <article class="camp-report-rate camp-report-rate--read">
                  <span class="camp-report-rate-label">Taxa de Leitura</span>
                  <span class="camp-report-rate-value">${formatPercent(metrics.readRate)}</span>
                </article>
                <article class="camp-report-rate camp-report-rate--failure">
                  <span class="camp-report-rate-label">Taxa de Falha</span>
                  <span class="camp-report-rate-value">${formatPercent(metrics.failureRate)}</span>
                </article>
                ${clickRateCard}
              </div>
            </section>
          </div>
          <p class="camp-report-formula-legend">${formulaLegend}</p>
        `;
}

const SUBSCRIBER_REPORT_CSS = `
    html, body { margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: rgba(2, 6, 23, 0.68);
      color: #e2e8f0;
    }
    .confirm-overlay {
      min-height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      box-sizing: border-box;
    }
    .confirm-modal {
      background: rgba(15, 23, 42, 0.98);
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 12px;
      text-align: center;
      margin: auto;
      box-sizing: border-box;
    }
    .camp-report-modal {
      width: 1120px;
      max-width: 1120px;
      padding: 24px 28px;
    }
    .confirm-title {
      font-size: 1rem;
      font-weight: 700;
      color: #f8fafc;
      margin-bottom: 8px;
      text-align: center;
    }
    .confirm-text {
      font-size: 0.84rem;
      color: #cbd5e1;
      margin-bottom: 10px;
      text-align: center;
    }
    .camp-report-dashboard {
      display: grid;
      gap: 18px;
      margin-top: 0;
      width: 100%;
      min-width: 0;
      text-align: left;
    }
    .camp-report-block-title {
      margin: 0 0 10px;
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #94a3b8;
    }
    .camp-report-progress-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
    }
    .camp-report-progress-value { font-size: 1.35rem; font-weight: 800; color: #fb923c; }
    .camp-report-progress-track {
      height: 12px;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.18);
      overflow: hidden;
    }
    .camp-report-progress-bar {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #f97316, #fb923c);
    }
    .camp-report-metrics-row {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
    }
    .camp-report-metrics-row--clicks { grid-template-columns: repeat(6, minmax(0, 1fr)); }
    .camp-report-metric {
      border-radius: 12px;
      padding: 14px 12px;
      background: rgba(15, 23, 42, 0.72);
      border: 1px solid rgba(148, 163, 184, 0.2);
      display: grid;
      gap: 6px;
      min-height: 78px;
      min-width: 0;
    }
    .camp-report-metric-label {
      font-size: 0.72rem;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .camp-report-metric-value { font-size: 1.55rem; font-weight: 800; line-height: 1.1; }
    .camp-report-metric--leads .camp-report-metric-value { color: #93c5fd; }
    .camp-report-metric--sent .camp-report-metric-value { color: #f8fafc; }
    .camp-report-metric--delivered .camp-report-metric-value { color: #fb923c; }
    .camp-report-metric--read .camp-report-metric-value { color: #c084fc; }
    .camp-report-metric--failed .camp-report-metric-value { color: #f87171; }
    .camp-report-metric--clicks .camp-report-metric-value { color: #34d399; }
    .camp-report-main-grid {
      display: grid;
      grid-template-columns: minmax(0, 280px) minmax(0, 1fr);
      gap: 16px;
      align-items: stretch;
    }
    .camp-report-pie-card, .camp-report-rates-card {
      border-radius: 14px;
      padding: 16px;
      background: rgba(15, 23, 42, 0.55);
      border: 1px solid rgba(148, 163, 184, 0.18);
      min-width: 0;
      box-sizing: border-box;
    }
    .camp-report-pie-wrap { display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .camp-report-pie {
      width: 180px;
      height: 180px;
      border-radius: 50%;
      border: 4px solid rgba(148, 163, 184, 0.15);
      box-shadow: inset 0 0 0 6px rgba(2, 6, 23, 0.35);
    }
    .camp-report-pie-legend {
      list-style: none; margin: 0; padding: 0; width: 100%;
      display: grid; gap: 6px; font-size: 0.78rem; color: #cbd5e1;
    }
    .camp-report-pie-legend li {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;
    }
    .camp-report-pie-legend span:first-child { display: inline-flex; align-items: center; gap: 6px; }
    .camp-report-swatch { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
    .camp-report-rates-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .camp-report-rates-grid--clicks { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .camp-report-rate {
      border-radius: 12px;
      padding: 14px 12px;
      background: rgba(2, 6, 23, 0.35);
      border: 1px solid rgba(148, 163, 184, 0.16);
      display: grid;
      gap: 8px;
      min-height: 88px;
      min-width: 0;
      box-sizing: border-box;
    }
    .camp-report-rate-label {
      font-size: 0.74rem; font-weight: 600; color: #94a3b8;
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .camp-report-rate-value { font-size: 1.75rem; font-weight: 800; line-height: 1.05; }
    .camp-report-rate--delivery .camp-report-rate-value { color: #fb923c; }
    .camp-report-rate--read .camp-report-rate-value { color: #c084fc; }
    .camp-report-rate--failure .camp-report-rate-value { color: #f87171; }
    .camp-report-rate--click .camp-report-rate-value { color: #34d399; }
    .camp-report-formula-legend {
      margin: 0; padding-top: 4px; font-size: 0.72rem; line-height: 1.55;
      color: rgba(148, 163, 184, 0.72);
    }
    .camp-report-reimbursement {
      display: grid; gap: 4px; padding: 12px 14px; border-radius: 12px;
      border: 1px solid rgba(56, 189, 248, 0.28);
      background: rgba(56, 189, 248, 0.08);
      font-size: 0.86rem; color: #e2e8f0;
    }
    .camp-report-reimbursement strong { color: #7dd3fc; font-size: 0.95rem; }
    .camp-report-reimbursement-detail { font-size: 0.76rem; color: rgba(148, 163, 184, 0.88); }
    .camp-report-timeline {
      display: grid; gap: 14px; margin: 0 0 16px; padding: 16px 16px 14px;
      border-radius: 14px; border: 1px solid rgba(148, 163, 184, 0.22);
      background: rgba(15, 23, 42, 0.4);
    }
    .camp-report-timeline-title {
      margin: 0; font-size: 0.82rem; font-weight: 700;
      letter-spacing: 0.06em; text-transform: uppercase; color: #94a3b8;
    }
    .camp-report-timeline-track {
      --camp-timeline-dot: 16px;
      --camp-timeline-accent: #34d399;
      --steps: 5;
      list-style: none; margin: 0; padding: 4px 0 0;
      display: grid;
      grid-template-columns: repeat(var(--steps), minmax(0, 1fr));
      gap: 0;
    }
    .camp-report-timeline-step {
      position: relative;
      display: grid;
      grid-template-columns: 1fr;
      grid-template-areas: "dot" "label" "when";
      justify-items: center;
      text-align: center;
      gap: 6px;
      min-width: 0;
      padding: 0 8px;
    }
    .camp-report-timeline-marker {
      grid-area: dot;
      width: var(--camp-timeline-dot);
      height: var(--camp-timeline-dot);
      border-radius: 50%;
      background: var(--camp-timeline-accent);
      box-shadow: 0 0 0 4px rgba(52, 211, 153, 0.16);
      z-index: 1;
    }
    .camp-report-timeline-step.is-latest .camp-report-timeline-marker {
      box-shadow: 0 0 0 5px rgba(52, 211, 153, 0.28);
      outline: 2px solid #6ee7b7;
      outline-offset: 1px;
    }
    .camp-report-timeline-step-label {
      grid-area: label;
      font-size: 0.78rem; font-weight: 700; line-height: 1.3; color: #e2e8f0;
    }
    .camp-report-timeline-step-when { grid-area: when; display: grid; gap: 2px; min-width: 0; }
    .camp-report-timeline-step-date { font-size: 0.72rem; line-height: 1.35; color: #94a3b8; }
    .camp-report-timeline-step-time {
      font-size: 0.92rem; font-weight: 700; line-height: 1.2; color: #f8fafc;
      font-variant-numeric: tabular-nums;
    }
    .camp-report-timeline-sr {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
    }
    .camp-report-timeline-step:not(:last-child)::before {
      content: "";
      position: absolute;
      top: calc(var(--camp-timeline-dot) / 2 - 1px);
      left: calc(50% + 12px);
      right: calc(-50% + 12px);
      height: 2px;
      background: linear-gradient(90deg, var(--camp-timeline-accent), rgba(52, 211, 153, 0.28));
    }
    .camp-report-meta-delay-note {
      margin: 2px 0 0; font-size: 0.82rem; line-height: 1.5; color: #fde68a;
    }
    .confirm-actions {
      margin-top: 18px;
      padding-top: 14px;
      border-top: 1px solid rgba(148, 163, 184, 0.14);
      display: flex;
      justify-content: center;
    }
    .instance-action-btn {
      border: 1px solid rgba(148, 163, 184, 0.35);
      background: rgba(15, 23, 42, 0.45);
      color: #cbd5e1;
      border-radius: 8px;
      padding: 4px 8px;
      font-size: 0.72rem;
      font-weight: 700;
    }
    .instance-action-btn.btn-qrcode.enabled {
      background: rgba(22, 101, 52, 0.85);
      border-color: rgba(110, 255, 200, 0.6);
      color: #f8fafc;
    }
`;

export function buildCampaignReportSnapshotModel(
  intake: WabaCampaignIntake,
): CampaignReportSnapshotInput {
  const report = applyCampaignReportReadOverride(
    intake.campaignName,
    intake.createdAt,
    intake.performanceReport,
  );
  const laboratorioAttended = campaignAttendedByLaboratorioStaff(intake);
  const broadcast = laboratorioAttended ? findBroadcastByIntakeCampaignId(intake.id) : null;
  const boundClicks = broadcast
    ? resolveBoundCampaignClicks({
        campaign: broadcast,
        extraSlugs: extraSlugsForIntake(intake),
      })
    : 0;
  const showClicks =
    campaignReportShowsClicks(intake.campaignName, intake.createdAt, report) ||
    (laboratorioAttended && report?.source === "meta_lab");
  return {
    campaignName: intake.campaignName,
    timeline: collectIntakeReportTimeline(intake),
    totalLeads: Math.max(0, Math.round(Number(report?.totalLeads ?? intake.plannedSendCount ?? 0))),
    sent: Math.max(0, Math.round(Number(report?.sent ?? 0))),
    delivered: Math.max(0, Math.round(Number(report?.delivered ?? 0))),
    read: Math.max(0, Math.round(Number(report?.read ?? 0))),
    failed: Math.max(0, Math.round(Number(report?.failed ?? 0))),
    clicks: Math.max(0, Math.round(Number(report?.clicks ?? 0)), boundClicks),
    showClicks,
    reportSource: String(report?.source || "").trim(),
  };
}

export function buildCampaignReportSnapshotHtml(input: CampaignReportSnapshotInput): string {
  const campaignName = String(input.campaignName || "Campanha").trim() || "Campanha";
  const body =
    buildSubscriberCampaignTimelineHtml(input.timeline) + buildCampaignPerformanceDashboardHtml(input);
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <style>${SUBSCRIBER_REPORT_CSS}</style>
</head>
<body>
  <div class="confirm-overlay open" id="dis-campaign-report-overlay">
    <div class="confirm-modal camp-report-modal" role="dialog" aria-modal="true">
      <div class="confirm-title" id="dis-campaign-report-title">Relatório — ${escapeHtml(campaignName)}</div>
      <div id="dis-campaign-report-body" class="camp-report-dashboard">${body}</div>
      <div class="confirm-actions">
        <button type="button" class="instance-action-btn btn-qrcode enabled">Fechar</button>
      </div>
    </div>
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
      viewport: { width: 1200, height: 1600 },
      deviceScaleFactor: 2,
    });
    await page.setContent(html, { waitUntil: "networkidle" });
    const modal = page.locator(".camp-report-modal");
    const png = await modal.screenshot({ type: "png" });
    return Buffer.from(png);
  } finally {
    await browser.close();
  }
}
