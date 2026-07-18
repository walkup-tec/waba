import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { resolveDataDir } from "../data-path";
import { PRODUCTION_PERSISTENCE_CATALOG } from "../services/production-data-persistence.service";

const EXTRA_DATA_FILES = [
  "evo-instances-cache.json",
  "instance-usage.json",
  "whatsapp-profile-names.json",
  "waba-master-menu-seen.json",
  "aquecedor-instance-message-stats.json",
] as const;

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;

export type WabaDataSnapshotFile = {
  file: string;
  sizeBytes: number;
  updatedAt: string | null;
  truncated: boolean;
  content: unknown;
};

export type WabaDataSnapshot = {
  generatedAt: string;
  dataDir: string;
  fileCount: number;
  totalBytes: number;
  files: WabaDataSnapshotFile[];
  skipped: Array<{ file: string; reason: string }>;
};

function safeReadJson(filePath: string): { ok: true; value: unknown } | { ok: false; reason: string } {
  try {
    const raw = readFileSync(filePath, "utf8");
    return { ok: true, value: JSON.parse(raw) };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Falha ao ler JSON.",
    };
  }
}

function listCandidateFiles(dataDir: string): string[] {
  const wanted = new Set<string>([
    ...PRODUCTION_PERSISTENCE_CATALOG.map((row) => row.file),
    ...EXTRA_DATA_FILES,
  ]);
  try {
    for (const name of readdirSync(dataDir)) {
      if (!name.endsWith(".json")) continue;
      if (name.endsWith(".tmp")) continue;
      if (name.startsWith(".")) continue;
      wanted.add(name);
    }
  } catch {
    /* data dir ausente */
  }
  return [...wanted].sort((a, b) => a.localeCompare(b));
}

/** Snapshot dos JSON em /app/data para espelhar produção → V02 local (somente master). */
export function buildWabaDataSnapshot(): WabaDataSnapshot {
  const dataDir = resolveDataDir();
  const files: WabaDataSnapshotFile[] = [];
  const skipped: Array<{ file: string; reason: string }> = [];
  let totalBytes = 0;

  for (const file of listCandidateFiles(dataDir)) {
    const filePath = path.join(dataDir, file);
    if (!existsSync(filePath)) {
      skipped.push({ file, reason: "ausente" });
      continue;
    }
    let sizeBytes = 0;
    let updatedAt: string | null = null;
    try {
      const st = statSync(filePath);
      sizeBytes = st.size;
      updatedAt = st.mtime.toISOString();
    } catch {
      skipped.push({ file, reason: "stat falhou" });
      continue;
    }
    if (sizeBytes > MAX_FILE_BYTES) {
      skipped.push({ file, reason: `arquivo maior que ${MAX_FILE_BYTES} bytes` });
      continue;
    }
    if (totalBytes + sizeBytes > MAX_TOTAL_BYTES) {
      skipped.push({ file, reason: "limite total do snapshot atingido" });
      continue;
    }
    const parsed = safeReadJson(filePath);
    if (!parsed.ok) {
      skipped.push({ file, reason: parsed.reason });
      continue;
    }
    totalBytes += sizeBytes;
    files.push({
      file,
      sizeBytes,
      updatedAt,
      truncated: false,
      content: parsed.value,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    dataDir,
    fileCount: files.length,
    totalBytes,
    files,
    skipped,
  };
}
