import { promises as fs } from "fs";
import path from "path";
import { resolveDataDir, resolveDataFile } from "../data-path";
import type { VpsCpuSample } from "./vps-cpu-monitor.types";

const SAMPLES_REL = path.join("vps-infra", "cpu-samples.jsonl");
const MAX_LINES = 10_000;

export class VpsCpuMonitorRepository {
  private samplesPath = resolveDataFile(SAMPLES_REL);

  async appendSample(sample: VpsCpuSample): Promise<void> {
    await fs.mkdir(path.dirname(this.samplesPath), { recursive: true });
    const line = `${JSON.stringify(sample)}\n`;
    await fs.appendFile(this.samplesPath, line, "utf-8");
    await this.trimIfNeeded();
  }

  async listSamples(limit = 480): Promise<VpsCpuSample[]> {
    let raw = "";
    try {
      raw = await fs.readFile(this.samplesPath, "utf-8");
    } catch {
      return [];
    }
    const lines = raw.split("\n").filter(Boolean);
    const slice = lines.slice(-Math.max(1, limit));
    const out: VpsCpuSample[] = [];
    for (const line of slice) {
      try {
        const parsed = JSON.parse(line) as VpsCpuSample;
        if (parsed?.ts) out.push(parsed);
      } catch {
        // skip corrupt line
      }
    }
    return out;
  }

  async getCollectorStatus(): Promise<{ ready: boolean; sampleCount: number; lastSampleAt: string | null }> {
    const samples = await this.listSamples(10_000);
    return {
      ready: samples.length > 0,
      sampleCount: samples.length,
      lastSampleAt: samples.length ? samples[samples.length - 1].ts : null,
    };
  }

  private async trimIfNeeded(): Promise<void> {
    let raw = "";
    try {
      raw = await fs.readFile(this.samplesPath, "utf-8");
    } catch {
      return;
    }
    const lines = raw.split("\n").filter(Boolean);
    if (lines.length <= MAX_LINES) return;
    const kept = lines.slice(-MAX_LINES).join("\n") + "\n";
    const tmp = `${this.samplesPath}.tmp`;
    await fs.writeFile(tmp, kept, "utf-8");
    await fs.rename(tmp, this.samplesPath);
  }

  static resolveSetupInstructions(): string[] {
    return [
      "No VPS (root): instale/atualize o coletor v3 (CPU via /proc/stat, memória via MemAvailable)",
      "curl -fsSL https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/infra/install-vps-monitor.sh -o /tmp/install-vps-monitor.sh",
      "sed -i 's/\\r$//' /tmp/install-vps-monitor.sh && chmod +x /tmp/install-vps-monitor.sh",
      "/tmp/install-vps-monitor.sh install",
      "bash /root/waba-infra/collect-vps-cpu-metrics-for-waba.sh  # teste: deve mostrar cpu~40% mem~16% disk~18%",
      "Validar: systemctl status waba-infra-cpu-collector.timer",
      "Opcional: limpar histórico legado — docker exec $(docker ps -q -f name=waba_waba_disparador | head -1) sh -c ':> /app/data/vps-infra/cpu-samples.jsonl'",
    ];
  }

  static dataInfraDir(): string {
    return path.join(resolveDataDir(), "vps-infra");
  }
}
