"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWabaDataSnapshot = buildWabaDataSnapshot;
const node_fs_1 = require("node:fs");
const path_1 = require("node:path");
const data_path_1 = require("../data-path");
const production_data_persistence_service_1 = require("../services/production-data-persistence.service");
const EXTRA_DATA_FILES = [
    "evo-instances-cache.json",
    "instance-usage.json",
    "whatsapp-profile-names.json",
    "waba-master-menu-seen.json",
    "aquecedor-instance-message-stats.json",
];
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
function safeReadJson(filePath) {
    try {
        const raw = (0, node_fs_1.readFileSync)(filePath, "utf8");
        return { ok: true, value: JSON.parse(raw) };
    }
    catch (error) {
        return {
            ok: false,
            reason: error instanceof Error ? error.message : "Falha ao ler JSON.",
        };
    }
}
function listCandidateFiles(dataDir) {
    const wanted = new Set([
        ...production_data_persistence_service_1.PRODUCTION_PERSISTENCE_CATALOG.map((row) => row.file),
        ...EXTRA_DATA_FILES,
    ]);
    try {
        for (const name of (0, node_fs_1.readdirSync)(dataDir)) {
            if (!name.endsWith(".json"))
                continue;
            if (name.endsWith(".tmp"))
                continue;
            if (name.startsWith("."))
                continue;
            wanted.add(name);
        }
    }
    catch {
        /* data dir ausente */
    }
    return [...wanted].sort((a, b) => a.localeCompare(b));
}
/** Snapshot dos JSON em /app/data para espelhar produção → V02 local (somente master). */
function buildWabaDataSnapshot() {
    const dataDir = (0, data_path_1.resolveDataDir)();
    const files = [];
    const skipped = [];
    let totalBytes = 0;
    for (const file of listCandidateFiles(dataDir)) {
        const filePath = (0, path_1.join)(dataDir, file);
        if (!(0, node_fs_1.existsSync)(filePath)) {
            skipped.push({ file, reason: "ausente" });
            continue;
        }
        let sizeBytes = 0;
        let updatedAt = null;
        try {
            const st = (0, node_fs_1.statSync)(filePath);
            sizeBytes = st.size;
            updatedAt = st.mtime.toISOString();
        }
        catch {
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
