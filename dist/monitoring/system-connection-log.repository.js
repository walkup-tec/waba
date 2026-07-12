"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemConnectionLogRepository = exports.SystemConnectionLogRepository = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const data_path_1 = require("../data-path");
const LOG_REL = path_1.default.join("vps-infra", "system-connection-logs.jsonl");
const MAX_LINES = 20000;
class SystemConnectionLogRepository {
    filePath() {
        return (0, data_path_1.resolveDataFile)(LOG_REL);
    }
    async append(event) {
        const full = {
            ...event,
            id: event.id || (0, crypto_1.randomUUID)(),
        };
        const file = this.filePath();
        await fs_1.promises.mkdir(path_1.default.dirname(file), { recursive: true });
        await fs_1.promises.appendFile(file, `${JSON.stringify(full)}\n`, "utf-8");
        await this.trimIfNeeded(file);
        return full;
    }
    async appendMany(events) {
        if (!events.length)
            return [];
        const full = events.map((event) => ({
            ...event,
            id: event.id || (0, crypto_1.randomUUID)(),
        }));
        const file = this.filePath();
        await fs_1.promises.mkdir(path_1.default.dirname(file), { recursive: true });
        await fs_1.promises.appendFile(file, full.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf-8");
        await this.trimIfNeeded(file);
        return full;
    }
    async listAll() {
        const file = this.filePath();
        try {
            const raw = await fs_1.promises.readFile(file, "utf-8");
            const rows = [];
            for (const line of raw.split("\n")) {
                const trimmed = line.trim();
                if (!trimmed)
                    continue;
                try {
                    const parsed = JSON.parse(trimmed);
                    if (parsed?.ts && parsed?.status && parsed?.motivo)
                        rows.push(parsed);
                }
                catch {
                    // linha corrompida
                }
            }
            return rows;
        }
        catch {
            return [];
        }
    }
    async trimIfNeeded(file) {
        try {
            const raw = await fs_1.promises.readFile(file, "utf-8");
            const lines = raw.split("\n").filter((line) => line.trim());
            if (lines.length <= MAX_LINES)
                return;
            const kept = lines.slice(lines.length - MAX_LINES);
            const tmp = `${file}.tmp`;
            await fs_1.promises.writeFile(tmp, `${kept.join("\n")}\n`, "utf-8");
            await fs_1.promises.rename(tmp, file);
        }
        catch {
            // ignore trim errors
        }
    }
}
exports.SystemConnectionLogRepository = SystemConnectionLogRepository;
exports.systemConnectionLogRepository = new SystemConnectionLogRepository();
