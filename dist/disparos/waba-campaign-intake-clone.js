"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPT_IN_PTX_SOURCE_ID = exports.OPT_IN_PTX_CLONE_REQUEST_ID = void 0;
exports.cloneCampaignIntakeWithPlannedSends = cloneCampaignIntakeWithPlannedSends;
exports.runOptInPtx1000CloneOneshot = runOptInPtx1000CloneOneshot;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const data_path_1 = require("../data-path");
const load_env_1 = require("../load-env");
const waba_campaign_spreadsheet_util_1 = require("./waba-campaign-spreadsheet.util");
const waba_campaign_intake_repository_1 = require("./waba-campaign-intake.repository");
exports.OPT_IN_PTX_CLONE_REQUEST_ID = "opt-in-ptx-1000-20260909";
exports.OPT_IN_PTX_SOURCE_ID = "66c69911-9c2f-42a2-7aeab1b15466";
const normalizeName = (value) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
const rewritePath = (value, sourceId, nextId) => {
    const current = String(value || "").trim();
    if (!current)
        return current;
    return current.split(sourceId).join(nextId);
};
const findSourceIntake = (repository, sourceId, campaignName) => {
    const byId = sourceId ? repository.getById(sourceId) : null;
    if (byId)
        return byId;
    const target = normalizeName(campaignName);
    if (!target)
        return null;
    const named = repository.listAll().filter((row) => {
        const name = normalizeName(row.campaignName);
        return name === target || name.includes(target);
    });
    const withCount = named.filter((row) => Math.round(Number(row.plannedSendCount || 0)) === 2996);
    return withCount[0] || named[0] || null;
};
function cloneCampaignIntakeWithPlannedSends(input) {
    const repository = new waba_campaign_intake_repository_1.WabaCampaignIntakeRepository();
    const requestId = String(input.requestId || "").trim();
    const planned = Math.max(1, Math.round(Number(input.plannedSendCount || 0)));
    if (!requestId)
        throw new Error("requestId obrigatório para clonar campanha.");
    const existing = repository.listAll().find((row) => String(row.clientRequestId || "").trim() === `clone:${requestId}`);
    if (existing) {
        return { ok: true, skipped: true, intake: existing };
    }
    const source = findSourceIntake(repository, String(input.sourceId || "").trim(), String(input.campaignName || "").trim());
    if (!source) {
        throw new Error("Campanha origem não encontrada para clonar.");
    }
    const newId = (0, node_crypto_1.randomUUID)();
    const dataDir = (0, data_path_1.resolveDataDir)();
    const srcDir = node_path_1.default.join(dataDir, "campaign-intakes", source.id);
    const destDir = node_path_1.default.join(dataDir, "campaign-intakes", newId);
    (0, node_fs_1.mkdirSync)(destDir, { recursive: true });
    if ((0, node_fs_1.existsSync)(srcDir)) {
        for (const name of (0, node_fs_1.readdirSync)(srcDir)) {
            const from = node_path_1.default.join(srcDir, name);
            if ((0, node_fs_1.statSync)(from).isFile())
                (0, node_fs_1.copyFileSync)(from, node_path_1.default.join(destDir, name));
        }
    }
    const leadsSrc = source.spreadsheetStoredPath && (0, node_fs_1.existsSync)(source.spreadsheetStoredPath)
        ? source.spreadsheetStoredPath
        : source.spreadsheetTrimmedPath && (0, node_fs_1.existsSync)(source.spreadsheetTrimmedPath)
            ? source.spreadsheetTrimmedPath
            : "";
    const sourceLeadsName = String(source.spreadsheetFileName || leadsSrc || "leads.xlsx");
    const trimmedExt = sourceLeadsName.toLowerCase().endsWith(".txt") ? "txt" : "xlsx";
    const spreadsheetTrimmedFileName = `leads-${planned}-envios.${trimmedExt}`;
    const spreadsheetTrimmedPath = node_path_1.default.join(destDir, spreadsheetTrimmedFileName);
    if (leadsSrc) {
        const buffer = (0, node_fs_1.readFileSync)(leadsSrc);
        (0, node_fs_1.writeFileSync)(spreadsheetTrimmedPath, (0, waba_campaign_spreadsheet_util_1.trimLeadsBufferToRowCount)(buffer, planned, sourceLeadsName));
    }
    const now = new Date().toISOString();
    const clone = {
        ...source,
        id: newId,
        plannedSendCount: planned,
        importedLineCount: planned,
        spreadsheetStoredPath: rewritePath(source.spreadsheetStoredPath, source.id, newId),
        spreadsheetTrimmedPath,
        spreadsheetTrimmedFileName,
        imageStoredPath: rewritePath(source.imageStoredPath, source.id, newId),
        whatsappLogoStoredPath: rewritePath(source.whatsappLogoStoredPath, source.id, newId),
        status: "generated",
        creditFunding: { fromPaid: planned, fromBonus: 0 },
        clientRequestId: `clone:${requestId}`,
        submissionFingerprint: `clone:${requestId}:${planned}`,
        createdAt: now,
        updatedAt: now,
    };
    delete clone.startedAt;
    delete clone.startedByEmail;
    delete clone.performanceReport;
    delete clone.errorReport;
    delete clone.operacionalNotifyAudit;
    delete clone.assignedOperacionalEmail;
    delete clone.assignedSupplierId;
    delete clone.assignedAt;
    delete clone.assignmentHistory;
    delete clone.masterOverdueAlertSentAt;
    delete clone.supplierPayoutSettlementId;
    delete clone.bmInoperanteRegisteredAt;
    delete clone.scheduledSendAt;
    repository.create(clone);
    return { ok: true, skipped: false, intake: clone };
}
function runOptInPtx1000CloneOneshot() {
    const env = String(load_env_1.WABA_ENV || process.env.WABA_ENV || "").trim().toLowerCase();
    if (env === "v01" || env === "v02" || env === "v03") {
        return { ok: true, skipped: true, message: "oneshot ignorado em ambiente local" };
    }
    try {
        const result = cloneCampaignIntakeWithPlannedSends({
            sourceId: exports.OPT_IN_PTX_SOURCE_ID,
            campaignName: "Opt in PTX",
            plannedSendCount: 1000,
            requestId: exports.OPT_IN_PTX_CLONE_REQUEST_ID,
        });
        return {
            ok: true,
            skipped: result.skipped,
            id: result.intake.id,
            message: result.skipped
                ? `Opt in PTX 1000 já existia (${result.intake.id})`
                : `Opt in PTX clonada com 1000 envios (${result.intake.id})`,
        };
    }
    catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : "Falha ao clonar Opt in PTX",
        };
    }
}
