export type VpsCpuContainerSample = {
  name: string;
  cpuPct: number;
  mem?: string;
};

export type VpsCpuSample = {
  ts: string;
  hostLoad1m: number;
  cpuCores: number;
  hostCpuPctEst: number;
  containers: VpsCpuContainerSample[];
  swarmServiceCount?: number;
};

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
  };
  chart: {
    labels: string[];
    hostCpuPct: number[];
    topContainerCpuPct: number[];
    topContainerName: string | null;
  };
  current: {
    hostCpuPctEst: number;
    hostLoad1m: number;
    cpuCores: number;
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
