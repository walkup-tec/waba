"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VpsCpuMonitorService = void 0;
exports.startVpsCpuLocalSampler = startVpsCpuLocalSampler;
const os_1 = __importDefault(require("os"));
const vps_cpu_playbooks_1 = require("./vps-cpu-playbooks");
const vps_cpu_monitor_repository_1 = require("./vps-cpu-monitor.repository");
const UI_REFRESH_SEC = 60;
const COLLECTOR_INTERVAL_SEC = 60;
const CHART_MAX_POINTS = 120;
let localSamplerRunning = false;
let localSamplerTimer = null;
const parseThresholdPct = () => {
    const raw = Number(process.env.WABA_VPS_CPU_ALERT_THRESHOLD_PCT ?? 65);
    if (!Number.isFinite(raw))
        return 65;
    return Math.min(100, Math.max(40, raw));
};
const parseSustainedMinutes = () => {
    const raw = Number(process.env.WABA_VPS_CPU_SUSTAINED_MINUTES ?? 30);
    if (!Number.isFinite(raw))
        return 30;
    return Math.min(120, Math.max(15, Math.round(raw)));
};
const parseSampleIntervalSec = () => {
    const raw = Number(process.env.WABA_VPS_CPU_SAMPLE_INTERVAL_SEC ?? COLLECTOR_INTERVAL_SEC);
    if (!Number.isFinite(raw))
        return COLLECTOR_INTERVAL_SEC;
    return Math.min(300, Math.max(30, Math.round(raw)));
};
const parseUiRefreshSec = () => {
    const raw = Number(process.env.WABA_VPS_CPU_UI_REFRESH_SEC ?? UI_REFRESH_SEC);
    if (!Number.isFinite(raw))
        return UI_REFRESH_SEC;
    return Math.min(300, Math.max(30, Math.round(raw)));
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const cpuTimesTotal = () => {
    let idle = 0;
    let total = 0;
    for (const cpu of os_1.default.cpus()) {
        const t = cpu.times;
        idle += t.idle;
        total += t.user + t.nice + t.sys + t.idle + t.irq;
    }
    return { idle, total };
};
/** Amostra CPU do host local (duas leituras ~400ms). */
async function estimateLocalCpuPct() {
    const a = cpuTimesTotal();
    await sleep(400);
    const b = cpuTimesTotal();
    const idleDelta = b.idle - a.idle;
    const totalDelta = b.total - a.total;
    if (totalDelta <= 0)
        return 0;
    const busy = 1 - idleDelta / totalDelta;
    return Math.round(Math.min(100, Math.max(0, busy * 100)) * 10) / 10;
}
const avg = (values) => {
    if (!values.length)
        return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
};
const parseChartRange = (raw) => {
    const value = String(raw ?? "1h").trim().toLowerCase();
    if (value === "24h" || value === "24hrs" || value === "24")
        return "24h";
    if (value === "all" || value === "todo" || value === "full")
        return "all";
    return "1h";
};
const rangeCutoffMs = (range) => {
    if (range === "1h")
        return 60 * 60 * 1000;
    if (range === "24h")
        return 24 * 60 * 60 * 1000;
    return null;
};
const filterSamplesByRange = (samples, range) => {
    const windowMs = rangeCutoffMs(range);
    if (!windowMs || !samples.length)
        return samples;
    const cutoff = Date.now() - windowMs;
    return samples.filter((sample) => {
        const ts = Date.parse(String(sample.ts || ""));
        return Number.isFinite(ts) && ts >= cutoff;
    });
};
const downsampleForChart = (samples, maxPoints = CHART_MAX_POINTS) => {
    if (samples.length <= maxPoints)
        return samples;
    const out = [];
    const step = samples.length / maxPoints;
    for (let i = 0; i < maxPoints; i += 1) {
        out.push(samples[Math.floor(i * step)]);
    }
    const last = samples[samples.length - 1];
    if (out[out.length - 1]?.ts !== last?.ts)
        out.push(last);
    return out;
};
const formatChartLabel = (iso, range) => {
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
    }
    catch {
        return iso.slice(11, 16);
    }
};
const num = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};
const pickTopContainerAcrossSamples = (samples) => {
    const acc = new Map();
    for (const sample of samples) {
        for (const c of sample.containers || []) {
            const name = String(c.name || "").trim();
            if (!name)
                continue;
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
    const serviceKey = (0, vps_cpu_playbooks_1.resolveServiceKeyFromContainerName)(bestName);
    return { name: bestName, cpuPctAvg: Math.round(bestAvg * 100) / 100, serviceKey };
};
const buildAlert = (samples, thresholdPct, sustainedMinutes, intervalSec) => {
    const needed = Math.max(1, Math.ceil((sustainedMinutes * 60) / intervalSec));
    if (samples.length < needed)
        return null;
    const window = samples.slice(-needed);
    const hostValues = window.map((s) => num(s.hostCpuPctEst));
    const hostAvg = avg(hostValues);
    const allAbove = hostValues.every((v) => v >= thresholdPct);
    if (!allAbove)
        return null;
    const culprit = pickTopContainerAcrossSamples(window);
    const culpritValues = window.flatMap((s) => (s.containers || [])
        .filter((c) => c.name === culprit.name)
        .map((c) => num(c.cpuPct)));
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
        playbook: (0, vps_cpu_playbooks_1.resolvePlaybookForServiceKey)(culprit.serviceKey),
    };
};
const buildCurrent = (last) => {
    if (!last)
        return null;
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
class VpsCpuMonitorService {
    constructor(repo = new vps_cpu_monitor_repository_1.VpsCpuMonitorRepository()) {
        this.repo = repo;
    }
    isEnabled() {
        const raw = String(process.env.WABA_VPS_CPU_MONITOR_ENABLED ?? "").trim().toLowerCase();
        if (raw === "0" || raw === "false" || raw === "no")
            return false;
        const wabaEnv = String(process.env.WABA_ENV ?? "").trim().toLowerCase();
        if (wabaEnv === "production")
            return true;
        if (raw === "1" || raw === "true" || raw === "yes")
            return true;
        return wabaEnv !== "v01" && wabaEnv !== "v02";
    }
    /** Em v01/v02 não há coletor do VPS; sampler local popula o JSONL para a UI. */
    shouldRunLocalSampler() {
        if (!this.isEnabled())
            return false;
        const forced = String(process.env.WABA_VPS_CPU_LOCAL_SAMPLER ?? "").trim().toLowerCase();
        if (forced === "0" || forced === "false" || forced === "no")
            return false;
        if (forced === "1" || forced === "true" || forced === "yes")
            return true;
        const wabaEnv = String(process.env.WABA_ENV ?? "").trim().toLowerCase();
        return wabaEnv === "v01" || wabaEnv === "v02";
    }
    async collectLocalSample() {
        const cores = Math.max(1, os_1.default.cpus().length);
        const loads = os_1.default.loadavg();
        const hostCpuPctEst = await estimateLocalCpuPct();
        const totalMem = os_1.default.totalmem();
        const freeMem = os_1.default.freemem();
        const usedMem = Math.max(0, totalMem - freeMem);
        const hostMemPct = totalMem > 0 ? Math.round((usedMem / totalMem) * 1000) / 10 : 0;
        const rss = process.memoryUsage().rss;
        const sample = {
            ts: new Date().toISOString(),
            hostLoad1m: Number(loads[0] || 0),
            hostLoad5m: Number(loads[1] || 0),
            hostLoad15m: Number(loads[2] || 0),
            cpuCores: cores,
            hostCpuPctEst,
            hostMemPct,
            hostMemUsedBytes: usedMem,
            hostMemTotalBytes: totalMem,
            hostDiskPct: 0,
            hostDiskUsedBytes: 0,
            hostDiskTotalBytes: 0,
            containers: [
                {
                    name: `waba-local-${String(process.env.WABA_ENV || "dev").trim() || "dev"}`,
                    cpuPct: hostCpuPctEst,
                    mem: `${Math.round(rss / (1024 * 1024))}MiB`,
                },
            ],
            swarmServiceCount: 1,
        };
        await this.repo.appendSample(sample);
        return sample;
    }
    async getDashboard(rangeInput = "1h") {
        const range = parseChartRange(rangeInput);
        const thresholdPct = parseThresholdPct();
        const sustainedMinutes = parseSustainedMinutes();
        const sampleIntervalSec = parseSampleIntervalSec();
        const uiRefreshSec = parseUiRefreshSec();
        const allSamples = await this.repo.listSamples(10000);
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
                serviceKey: (0, vps_cpu_playbooks_1.resolveServiceKeyFromContainerName)(c.name),
            }))
            : [];
        const alert = buildAlert(allSamples, thresholdPct, sustainedMinutes, sampleIntervalSec);
        const localSampler = this.shouldRunLocalSampler();
        return {
            enabled: this.isEnabled(),
            collectorReady: status.ready,
            sampleCount: status.sampleCount,
            lastSampleAt: status.lastSampleAt,
            config: { thresholdPct, sustainedMinutes, sampleIntervalSec, uiRefreshSec },
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
            setupSteps: status.ready
                ? []
                : localSampler
                    ? [
                        "Sampler local ativo neste ambiente — aguarde a primeira amostra (~1 min) e clique em Atualizar.",
                        "Em produção as métricas vêm do coletor no VPS (scripts/infra/install-vps-monitor.sh).",
                    ]
                    : vps_cpu_monitor_repository_1.VpsCpuMonitorRepository.resolveSetupInstructions(),
        };
    }
    async getAlertStatus() {
        if (!this.isEnabled())
            return { active: false, alert: null };
        const samples = await this.repo.listSamples(10000);
        const alert = buildAlert(samples, parseThresholdPct(), parseSustainedMinutes(), parseSampleIntervalSec());
        return { active: Boolean(alert?.active), alert };
    }
}
exports.VpsCpuMonitorService = VpsCpuMonitorService;
function startVpsCpuLocalSampler(service = new VpsCpuMonitorService()) {
    if (localSamplerRunning)
        return;
    if (!service.shouldRunLocalSampler()) {
        console.log("[vps-cpu] sampler local desativado (produção usa coletor no VPS; ou WABA_VPS_CPU_MONITOR_ENABLED=false).");
        return;
    }
    localSamplerRunning = true;
    const intervalMs = parseSampleIntervalSec() * 1000;
    console.log(`[vps-cpu] sampler local ativo — amostra a cada ${Math.round(intervalMs / 1000)}s → data/*/vps-infra/cpu-samples.jsonl`);
    const tick = () => {
        void service.collectLocalSample().catch((error) => {
            console.warn("[vps-cpu] amostra local falhou:", error instanceof Error ? error.message : error);
        });
    };
    tick();
    localSamplerTimer = setInterval(tick, intervalMs);
    localSamplerTimer.unref?.();
}
