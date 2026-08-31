import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { resolveDataFile } from "../data-path";
import type { SystemConnectionLogEvent } from "./system-connection-log.types";

const LOG_REL = path.join("vps-infra", "system-connection-logs.jsonl");
const MAX_LINES = 20_000;

export class SystemConnectionLogRepository {
  private filePath(): string {
    return resolveDataFile(LOG_REL);
  }

  async append(event: Omit<SystemConnectionLogEvent, "id"> & { id?: string }): Promise<SystemConnectionLogEvent> {
    const full: SystemConnectionLogEvent = {
      ...event,
      id: event.id || randomUUID(),
    };
    const file = this.filePath();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.appendFile(file, `${JSON.stringify(full)}\n`, "utf-8");
    await this.trimIfNeeded(file);
    return full;
  }

  async appendMany(
    events: Array<Omit<SystemConnectionLogEvent, "id"> & { id?: string }>,
  ): Promise<SystemConnectionLogEvent[]> {
    if (!events.length) return [];
    const full = events.map((event) => ({
      ...event,
      id: event.id || randomUUID(),
    }));
    const file = this.filePath();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.appendFile(file, full.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf-8");
    await this.trimIfNeeded(file);
    return full;
  }

  async listAll(): Promise<SystemConnectionLogEvent[]> {
    const file = this.filePath();
    try {
      const raw = await fs.readFile(file, "utf-8");
      const rows: SystemConnectionLogEvent[] = [];
      for (const line of raw.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed) as SystemConnectionLogEvent;
          if (parsed?.ts && parsed?.status && parsed?.motivo) rows.push(parsed);
        } catch {
          // linha corrompida
        }
      }
      return rows;
    } catch {
      return [];
    }
  }

  private async trimIfNeeded(file: string): Promise<void> {
    try {
      const raw = await fs.readFile(file, "utf-8");
      const lines = raw.split("\n").filter((line) => line.trim());
      if (lines.length <= MAX_LINES) return;
      const kept = lines.slice(lines.length - MAX_LINES);
      const tmp = `${file}.tmp`;
      await fs.writeFile(tmp, `${kept.join("\n")}\n`, "utf-8");
      await fs.rename(tmp, file);
    } catch {
      // ignore trim errors
    }
  }
}

export const systemConnectionLogRepository = new SystemConnectionLogRepository();
