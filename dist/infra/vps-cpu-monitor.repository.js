"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VpsCpuMonitorRepository = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const data_path_1 = require("../data-path");
const SAMPLES_REL = path_1.default.join("vps-infra", "cpu-samples.jsonl");
const MAX_LINES = 10080;
class VpsCpuMonitorRepository {
    constructor() {
        this.samplesPath = (0, data_path_1.resolveDataFile)(SAMPLES_REL);
    }
    async appendSample(sample) {
        await fs_1.promises.mkdir(path_1.default.dirname(this.samplesPath), { recursive: true });
        const line = `${JSON.stringify(sample)}\n`;
        await fs_1.promises.appendFile(this.samplesPath, line, "utf-8");
        await this.trimIfNeeded();
    }
    async listSamples(limit = 480) {
        let raw = "";
        try {
            raw = await fs_1.promises.readFile(this.samplesPath, "utf-8");
        }
        catch {
            return [];
        }
        const lines = raw.split("\n").filter(Boolean);
        const slice = lines.slice(-Math.max(1, limit));
        const out = [];
        for (const line of slice) {
            try {
                const parsed = JSON.parse(line);
                if (parsed?.ts)
                    out.push(parsed);
            }
            catch {
                // skip corrupt line
            }
        }
        return out;
    }
    async getCollectorStatus() {
        const samples = await this.listSamples(10000);
        return {
            ready: samples.length > 0,
            sampleCount: samples.length,
            lastSampleAt: samples.length ? samples[samples.length - 1].ts : null,
        };
    }
    async trimIfNeeded() {
        let raw = "";
        try {
            raw = await fs_1.promises.readFile(this.samplesPath, "utf-8");
        }
        catch {
            return;
        }
        const lines = raw.split("\n").filter(Boolean);
        if (lines.length <= MAX_LINES)
            return;
        const kept = lines.slice(-MAX_LINES).join("\n") + "\n";
        const tmp = `${this.samplesPath}.tmp`;
        await fs_1.promises.writeFile(tmp, kept, "utf-8");
        await fs_1.promises.rename(tmp, this.samplesPath);
    }
    static resolveSetupInstructions() {
        return [
            "No VPS (root): instale o coletor que grava amostras em /app/data/vps-infra/",
            "curl -fsSL https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/infra/install-vps-monitor.sh -o /tmp/install-vps-monitor.sh",
            "sed -i 's/\\r$//' /tmp/install-vps-monitor.sh && chmod +x /tmp/install-vps-monitor.sh",
            "/tmp/install-vps-monitor.sh install",
            "Validar: systemctl status waba-infra-cpu-collector.timer",
        ];
    }
    static dataInfraDir() {
        return path_1.default.join((0, data_path_1.resolveDataDir)(), "vps-infra");
    }
}
exports.VpsCpuMonitorRepository = VpsCpuMonitorRepository;
