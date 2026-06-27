import type {
  VpsCpuAlert,
  VpsCpuChartRange,
  VpsCpuDashboardResponse,
  VpsCpuSample,
} from "./vps-cpu-monitor.types";
import { resolvePlaybookForServiceKey, resolveServiceKeyFromContainerName } from "./vps-cpu-playbooks";
import { VpsCpuMonitorRepository } from "./vps-cpu-monitor.repository";

const UI_REFRESH_SEC = 10;
const CHART_MAX_POINTS = 120;

const parseThresholdPct = (): number => {
  const raw = Number(process.env.WABA_VPS_CPU_ALERT_THRESHOLD_PCT ?? 65);
  if (!Number.isFinite(raw)) return 65;
  return Math.min(100, Math.max(40, raw));
};

const parseSustainedMinutes = (): number => {
  const raw = Number(process.env.WABA_VPS_CPU_SUSTAINED_MINUTES ?? 30);
  if (!Number.isFinite(raw)) return 30;
  return Math.min(120, Math.max(15, Math.round(raw)));
};

const parseSampleIntervalSec = (): number => {
  const raw = Number(process.env.WABA_VPS_CPU_SAMPLE_INTERVAL_SEC ?? 10);
  if (!Number.isFinite(raw)) return 10;
  return Math.min(300, Math.max(10, Math.round(raw)));
};

const avg = (values: number[]): number => {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

const parseChartRange = (raw: unknown): VpsCpuChartRange => {
  const value = String(raw ?? "1h").trim().toLowerCase();
  if (value === "24h" || value === "24hrs" || value === "24") return "24h";
  if (value === "all" || value === "todo" || value === "full") return "all";
  return "1h";
};

const rangeCutoffMs = (range: VpsCpuChartRange): number | null => {
  if (range === "1h") return 60 * 60 * 1000;
  if (range === "24h") return 24 * 60 * 60 * 1000;
  return null;
};

const filterSamplesByRange = (samples: VpsCpuSample[], range: VpsCpuChartRange): VpsCpuSample[] => {
  const windowMs = rangeCutoffMs(range);
  if (!windowMs || !samples.length) return samples;
  const cutoff = Date.now() - windowMs;
  return samples.filter((sample) => {
    const ts = Date.parse(String(sample.ts || ""));
    return Number.isFinite(ts) && ts >= cutoff;
  });
};

const downsampleForChart = (samples: VpsCpuSample[], maxPoints = CHART_MAX_POINTS): VpsCpuSample[] => {
  if (samples.length <= maxPoints) return samples;
  const out: VpsCpuSample[] = [];
  const step = samples.length / maxPoints;
  for (let i = 0; i < maxPoints; i += 1) {
    out.push(samples[Math.floor(i * step)]);
  }
  const last = samples[samples.length - 1];
  if (out[out.length - 1]?.ts !== last?.ts) out.push(last);
  return out;
};

const formatChartLabel = (iso: string, range: VpsCpuChartRange): string => {
  try {
    const d = new Date(iso);
    if (range === "all") {
      return d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    }
    if (range === "24h") {
      return d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    }
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return iso.slice(11, 16);
  }
};

const num = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const pickTopContainerAcrossSamples = (
  samples: VpsCpuSample[],
): { name: string; cpuPctAvg: number; serviceKey: string } => {
  const acc = new Map<string, number[]>();
  for (const sample of samples) {
    for (const c of sample.containers || []) {
      const name = String(c.name || "").trim();
      if (!name) continue;
      const list = acc.get(name) || [];
      list.push(num(c.cpuPct));
      acc.set(name, list);
    }
  }
  let bestName = "";
  let bestAvg = 0;
  for (const [name, values] of acc.entries()) {
    const m = avg(values);
    if (m > bestAvg) {
      bestAvg = m;
      bestName = name;
    }
  }
  const serviceKey = resolveServiceKeyFromContainerName(bestName);
  return { name: bestName, cpuPctAvg: Math.round(bestAvg * 100) / 100, serviceKey };
};

const buildAlert = (
  samples: VpsCpuSample[],
  thresholdPct: number,
  sustainedMinutes: number,
  intervalSec: number,
): VpsCpuAlert | null => {
  const needed = Math.max(1, Math.ceil((sustainedMinutes * 60) / intervalSec));
  if (samples.length < needed) return null;

  const window = samples.slice(-needed);
  const hostValues = window.map((s) => num(s.hostCpuPctEst));
  const hostAvg = avg(hostValues);
  const allAbove = hostValues.every((v) => v >= thresholdPct);
  if (!allAbove) return null;

  const culprit = pickTopContainerAcrossSamples(window);
  const culpritValues = window.flatMap((s) =>
    (s.containers || [])
      .filter((c) => c.name === culprit.name)
      .map((c) => num(c.cpuPct)),
  );
  const culpritAvg = culpritValues.length ? avg(culpritValues) : culprit.cpuPctAvg;

  return {
    active: true,
    since: window[0]?.ts ?? null,
    until: window[window.length - 1]?.ts ?? null,
    hostCpuAvg: Math.round(hostAvg * 100) / 100,
    thresholdPct,
    sustainedMinutes,
    culpritName: culprit.name || "desconhecido",
    culpritServiceKey: culprit.serviceKey,
    culpritCpuAvg: Math.round(culpritAvg * 100) / 100,
    playbook: resolvePlaybookForServiceKey(culprit.serviceKey),
  };
};

const buildCurrent = (last: VpsCpuSample | null): VpsCpuDashboardResponse["current"] => {
  if (!last) return null;
  return {
    hostCpuPctEst: num(last.hostCpuPctEst),
    hostLoad1m: num(last.hostLoad1m),
    hostLoad5m: num(last.hostLoad5m, num(last.hostLoad1m)),
    hostLoad15m: num(last.hostLoad15m, num(last.hostLoad1m)),
    cpuCores: num(last.cpuCores, 1),
    hostMemPct: num(last.hostMemPct),
    hostMemUsedBytes: num(last.hostMemUsedBytes),
    hostMemTotalBytes: num(last.hostMemTotalBytes),
    hostDiskPct: num(last.hostDiskPct),
    hostDiskUsedBytes: num(last.hostDiskUsedBytes),
    hostDiskTotalBytes: num(last.hostDiskTotalBytes),
    swarmServiceCount: num(last.swarmServiceCount),
  };
};

export class VpsCpuMonitorService {
  constructor(private readonly repo = new VpsCpuMonitorRepository()) {}

  isEnabled(): boolean {
    const raw = String(process.env.WABA_VPS_CPU_MONITOR_ENABLED ?? "").trim().toLowerCase();
    if (raw === "0" || raw === "false" || raw === "no") return false;
    const wabaEnv = String(process.env.WABA_ENV ?? "").trim().toLowerCase();
    if (wabaEnv === "production") return true;
    if (raw === "1" || raw === "true" || raw === "yes") return true;
    return wabaEnv !== "v01" && wabaEnv !== "v02";
  }

  async getDashboard(rangeInput: unknown = "1h"): Promise<VpsCpuDashboardResponse> {
    const range = parseChartRange(rangeInput);
    const thresholdPct = parseThresholdPct();
    const sustainedMinutes = parseSustainedMinutes();
    const sampleIntervalSec = parseSampleIntervalSec();
    const allSamples = await this.repo.listSamples(10_000);
    const status = await this.repo.getCollectorStatus();
    const last = allSamples.length ? allSamples[allSamples.length - 1] : null;

    const rangedSamples = filterSamplesByRange(allSamples, range);
    const chartSamples = downsampleForChart(rangedSamples);

    const topContainers = last
      ? [...(last.containers || [])]
          .sort((a, b) => num(b.cpuPct) - num(a.cpuPct))
          .slice(0, 8)
          .map((c) => ({
            name: c.name,
            cpuPctAvg: num(c.cpuPct),
            serviceKey: resolveServiceKeyFromContainerName(c.name),
          }))
      : [];

    const alert = buildAlert(allSamples, thresholdPct, sustainedMinutes, sampleIntervalSec);

    return {
      enabled: this.isEnabled(),
      collectorReady: status.ready,
      sampleCount: status.sampleCount,
      lastSampleAt: status.lastSampleAt,
      config: { thresholdPct, sustainedMinutes, sampleIntervalSec, uiRefreshSec: UI_REFRESH_SEC },
      chart: {
        range,
        labels: chartSamples.map((s) => formatChartLabel(s.ts, range)),
        hostCpuPct: chartSamples.map((s) => num(s.hostCpuPctEst)),
        hostMemPct: chartSamples.map((s) => num(s.hostMemPct)),
        hostDiskPct: chartSamples.map((s) => num(s.hostDiskPct)),
      },
      current: buildCurrent(last),
      topContainers,
      alert,
      setupSteps: status.ready ? [] : VpsCpuMonitorRepository.resolveSetupInstructions(),
    };
  }

  async getAlertStatus(): Promise<{ active: boolean; alert: VpsCpuAlert | null }> {
    if (!this.isEnabled()) return { active: false, alert: null };
    const samples = await this.repo.listSamples(10_000);
    const alert = buildAlert(
      samples,
      parseThresholdPct(),
      parseSustainedMinutes(),
      parseSampleIntervalSec(),
    );
    return { active: Boolean(alert?.active), alert };
  }
}
