export type VpsCpuContainerSample = {
  name: string;
  cpuPct: number;
  mem?: string;
};

export type VpsCpuSample = {
  ts: string;
  hostLoad1m: number;
  hostLoad5m?: number;
  hostLoad15m?: number;
  cpuCores: number;
  hostCpuPctEst: number;
  hostMemPct?: number;
  hostMemUsedBytes?: number;
  hostMemTotalBytes?: number;
  hostDiskPct?: number;
  hostDiskUsedBytes?: number;
  hostDiskTotalBytes?: number;
  containers: VpsCpuContainerSample[];
  swarmServiceCount?: number;
};

export type VpsCpuChartRange = "1h" | "24h" | "all";

export type VpsCpuPlaybookStep = {
  order: number;
  title: string;
  command: string;
  note?: string;
};

export type VpsCpuPlaybook = {
  id: string;
  label: string;
  summary: string;
  steps: VpsCpuPlaybookStep[];
};

export type VpsCpuAlert = {
  active: boolean;
  since: string | null;
  until: string | null;
  hostCpuAvg: number;
  thresholdPct: number;
  sustainedMinutes: number;
  culpritName: string;
  culpritServiceKey: string;
  culpritCpuAvg: number;
  playbook: VpsCpuPlaybook;
};

export type VpsCpuDashboardResponse = {
  enabled: boolean;
  collectorReady: boolean;
  sampleCount: number;
  lastSampleAt: string | null;
  config: {
    thresholdPct: number;
    sustainedMinutes: number;
    sampleIntervalSec: number;
    uiRefreshSec: number;
  };
  chart: {
    range: VpsCpuChartRange;
    labels: string[];
    hostCpuPct: number[];
    hostMemPct: number[];
    hostDiskPct: number[];
  };
  current: {
    hostCpuPctEst: number;
    hostLoad1m: number;
    hostLoad5m: number;
    hostLoad15m: number;
    cpuCores: number;
    hostMemPct: number;
    hostMemUsedBytes: number;
    hostMemTotalBytes: number;
    hostDiskPct: number;
    hostDiskUsedBytes: number;
    hostDiskTotalBytes: number;
    swarmServiceCount: number;
  } | null;
  topContainers: Array<{
    name: string;
    cpuPctAvg: number;
    serviceKey: string;
  }>;
  alert: VpsCpuAlert | null;
  setupSteps: string[];
};
