import type {
  VpsCpuAlert,
  VpsCpuDashboardResponse,
  VpsCpuSample,
} from "./vps-cpu-monitor.types";
import { resolvePlaybookForServiceKey, resolveServiceKeyFromContainerName } from "./vps-cpu-playbooks";
import { VpsCpuMonitorRepository } from "./vps-cpu-monitor.repository";

const parseThresholdPct = (): number => {
  const raw = Number(process.env.WABA_VPS_CPU_ALERT_THRESHOLD_PCT ?? 65);
  if (!Number.isFinite(raw)) return 65;
  return Math.min(100, Math.max(40, raw));
};

const parseSustainedMinutes = (): number => {
  const raw = Number(process.env.WABA_VPS_CPU_SUSTAINED_MINUTES ?? 10);
  if (!Number.isFinite(raw)) return 10;
  return Math.min(120, Math.max(3, Math.round(raw)));
};

const parseSampleIntervalSec = (): number => {
  const raw = Number(process.env.WABA_VPS_CPU_SAMPLE_INTERVAL_SEC ?? 60);
  if (!Number.isFinite(raw)) return 60;
  return Math.min(300, Math.max(30, Math.round(raw)));
};

const avg = (values: number[]): number => {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

const formatChartLabel = (iso: string): string => {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return iso.slice(11, 16);
  }
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
      list.push(Number(c.cpuPct) || 0);
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
  const hostValues = window.map((s) => Number(s.hostCpuPctEst) || 0);
  const hostAvg = avg(hostValues);
  const allAbove = hostValues.every((v) => v >= thresholdPct);
  if (!allAbove) return null;

  const culprit = pickTopContainerAcrossSamples(window);
  const culpritValues = window.flatMap((s) =>
    (s.containers || [])
      .filter((c) => c.name === culprit.name)
      .map((c) => Number(c.cpuPct) || 0),
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

  async getDashboard(limit = 120): Promise<VpsCpuDashboardResponse> {
    const thresholdPct = parseThresholdPct();
    const sustainedMinutes = parseSustainedMinutes();
    const sampleIntervalSec = parseSampleIntervalSec();
    const samples = await this.repo.listSamples(Math.max(limit, 480));
    const status = await this.repo.getCollectorStatus();
    const last = samples.length ? samples[samples.length - 1] : null;

    const chartSamples = samples.slice(-Math.min(limit, 120));
    let topName: string | null = null;
    if (last?.containers?.length) {
      topName = [...last.containers].sort((a, b) => (b.cpuPct || 0) - (a.cpuPct || 0))[0]?.name ?? null;
    }

    const topContainers = last
      ? [...(last.containers || [])]
          .sort((a, b) => (b.cpuPct || 0) - (a.cpuPct || 0))
          .slice(0, 8)
          .map((c) => ({
            name: c.name,
            cpuPctAvg: c.cpuPct,
            serviceKey: resolveServiceKeyFromContainerName(c.name),
          }))
      : [];

    const alert = buildAlert(samples, thresholdPct, sustainedMinutes, sampleIntervalSec);

    return {
      enabled: this.isEnabled(),
      collectorReady: status.ready,
      sampleCount: status.sampleCount,
      lastSampleAt: status.lastSampleAt,
      config: { thresholdPct, sustainedMinutes, sampleIntervalSec },
      chart: {
        labels: chartSamples.map((s) => formatChartLabel(s.ts)),
        hostCpuPct: chartSamples.map((s) => Number(s.hostCpuPctEst) || 0),
        topContainerCpuPct: chartSamples.map((s) => {
          if (!topName) return 0;
          const hit = (s.containers || []).find((c) => c.name === topName);
          return hit ? Number(hit.cpuPct) || 0 : 0;
        }),
        topContainerName: topName,
      },
      current: last
        ? {
            hostCpuPctEst: last.hostCpuPctEst,
            hostLoad1m: last.hostLoad1m,
            cpuCores: last.cpuCores,
            swarmServiceCount: last.swarmServiceCount ?? 0,
          }
        : null,
      topContainers,
      alert,
      setupSteps: status.ready ? [] : VpsCpuMonitorRepository.resolveSetupInstructions(),
    };
  }
}
