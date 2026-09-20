"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OfficialCampaignCopyError = exports.OFFICIAL_CAMPAIGN_EDIT_STATUSES = exports.OFFICIAL_CAMPAIGN_DUPLICATE_STATUSES = void 0;
exports.isOfficialCampaignIntake = isOfficialCampaignIntake;
exports.canDuplicateOfficialCampaign = canDuplicateOfficialCampaign;
exports.canEditOfficialCampaign = canEditOfficialCampaign;
exports.assertCanDuplicateOfficialCampaign = assertCanDuplicateOfficialCampaign;
exports.assertCanEditOfficialCampaign = assertCanEditOfficialCampaign;
exports.buildOfficialCampaignCopyName = buildOfficialCampaignCopyName;
exports.copyOfficialCampaignIntakeFiles = copyOfficialCampaignIntakeFiles;
exports.buildOfficialCampaignDuplicate = buildOfficialCampaignDuplicate;
exports.toOfficialCampaignEditDetail = toOfficialCampaignEditDetail;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const data_path_1 = require("../data-path");
const waba_dispatches_api_kind_1 = require("./waba-dispatches-api-kind");
const waba_campaign_intake_status_1 = require("./waba-campaign-intake-status");
exports.OFFICIAL_CAMPAIGN_DUPLICATE_STATUSES = ["generated", "error_reported"];
exports.OFFICIAL_CAMPAIGN_EDIT_STATUSES = ["generated"];
class OfficialCampaignCopyError extends Error {
    constructor(code, message, statusCode = 400) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
    }
}
exports.OfficialCampaignCopyError = OfficialCampaignCopyError;
const rewritePath = (value, sourceId, nextId) => {
    const current = String(value || "").trim();
    if (!current)
        return current;
    return current.split(sourceId).join(nextId);
};
function isOfficialCampaignIntake(intake) {
    if (!intake)
        return false;
    return (0, waba_dispatches_api_kind_1.resolveIntakeApiKindFromIntake)(intake) === "oficial";
}
function canDuplicateOfficialCampaign(intake, ownerEmail) {
    if (!intake)
        return false;
    if (intake.ownerEmail !== ownerEmail.trim().toLowerCase())
        return false;
    if (!isOfficialCampaignIntake(intake))
        return false;
    const status = (0, waba_campaign_intake_status_1.normalizeCampaignIntakeStatus)(intake.status);
    return status === "generated" || status === "error_reported";
}
function canEditOfficialCampaign(intake, ownerEmail) {
    if (!intake)
        return false;
    if (intake.ownerEmail !== ownerEmail.trim().toLowerCase())
        return false;
    if (!isOfficialCampaignIntake(intake))
        return false;
    return (0, waba_campaign_intake_status_1.normalizeCampaignIntakeStatus)(intake.status) === "generated";
}
function assertCanDuplicateOfficialCampaign(intake, ownerEmail) {
    if (!intake) {
        throw new OfficialCampaignCopyError("not_found", "Campanha não encontrada.", 404);
    }
    if (intake.ownerEmail !== ownerEmail.trim().toLowerCase()) {
        throw new OfficialCampaignCopyError("forbidden", "Campanha não encontrada.", 404);
    }
    if (!isOfficialCampaignIntake(intake)) {
        throw new OfficialCampaignCopyError("not_oficial", "Só é possível duplicar campanhas da API Oficial.");
    }
    if (!canDuplicateOfficialCampaign(intake, ownerEmail)) {
        throw new OfficialCampaignCopyError("status_blocked", "Só é possível duplicar campanhas com status Gerada ou Erro Reportado.");
    }
    return intake;
}
function assertCanEditOfficialCampaign(intake, ownerEmail) {
    if (!intake) {
        throw new OfficialCampaignCopyError("not_found", "Campanha não encontrada.", 404);
    }
    if (intake.ownerEmail !== ownerEmail.trim().toLowerCase()) {
        throw new OfficialCampaignCopyError("forbidden", "Campanha não encontrada.", 404);
    }
    if (!isOfficialCampaignIntake(intake)) {
        throw new OfficialCampaignCopyError("not_oficial", "Só é possível editar campanhas da API Oficial.");
    }
    if (!canEditOfficialCampaign(intake, ownerEmail)) {
        throw new OfficialCampaignCopyError("status_blocked", "Só é possível editar campanhas com status Gerada.");
    }
    return intake;
}
function buildOfficialCampaignCopyName(name) {
    const base = String(name || "").trim() || "Campanha";
    const match = base.match(/^(.*)\s+\(c[oó]pia(?:\s+(\d+))?\)$/i);
    if (!match)
        return `${base} (cópia)`;
    const stem = String(match[1] || "").trim() || "Campanha";
    const next = match[2] ? Number(match[2]) + 1 : 2;
    return `${stem} (cópia ${Number.isFinite(next) ? next : 2})`;
}
function copyOfficialCampaignIntakeFiles(source, nextId) {
    const dataDir = (0, data_path_1.resolveDataDir)();
    const srcDir = node_path_1.default.join(dataDir, "campaign-intakes", source.id);
    const destDir = node_path_1.default.join(dataDir, "campaign-intakes", nextId);
    (0, node_fs_1.mkdirSync)(destDir, { recursive: true });
    if ((0, node_fs_1.existsSync)(srcDir)) {
        for (const name of (0, node_fs_1.readdirSync)(srcDir)) {
            const from = node_path_1.default.join(srcDir, name);
            if ((0, node_fs_1.statSync)(from).isFile())
                (0, node_fs_1.copyFileSync)(from, node_path_1.default.join(destDir, name));
        }
    }
    const copyIfOutside = (value) => {
        const current = String(value || "").trim();
        if (!current || !(0, node_fs_1.existsSync)(current))
            return rewritePath(current, source.id, nextId);
        const rewritten = rewritePath(current, source.id, nextId);
        if (rewritten && rewritten !== current) {
            (0, node_fs_1.mkdirSync)(node_path_1.default.dirname(rewritten), { recursive: true });
            if (!(0, node_fs_1.existsSync)(rewritten))
                (0, node_fs_1.copyFileSync)(current, rewritten);
            return rewritten;
        }
        return current;
    };
    return {
        imageStoredPath: copyIfOutside(source.imageStoredPath),
        whatsappLogoStoredPath: copyIfOutside(source.whatsappLogoStoredPath),
        spreadsheetStoredPath: copyIfOutside(source.spreadsheetStoredPath),
        spreadsheetTrimmedPath: copyIfOutside(source.spreadsheetTrimmedPath),
    };
}
function buildOfficialCampaignDuplicate(source, options = {}) {
    const now = (options.now || new Date()).toISOString();
    const nextId = options.nextId || (0, node_crypto_1.randomUUID)();
    const files = copyOfficialCampaignIntakeFiles(source, nextId);
    const clone = {
        ...source,
        id: nextId,
        campaignName: buildOfficialCampaignCopyName(source.campaignName),
        imageStoredPath: files.imageStoredPath,
        whatsappLogoStoredPath: files.whatsappLogoStoredPath,
        spreadsheetStoredPath: files.spreadsheetStoredPath,
        spreadsheetTrimmedPath: files.spreadsheetTrimmedPath,
        apiKind: "oficial",
        status: "generated",
        clientRequestId: `duplicate:${source.id}:${nextId}`,
        submissionFingerprint: `duplicate:${source.id}:${nextId}`,
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
    delete clone.responseShortUrl;
    delete clone.responseShortSlug;
    return clone;
}
function toOfficialCampaignEditDetail(intake) {
    return {
        id: intake.id,
        name: intake.campaignName,
        campaignName: intake.campaignName,
        regionDdd: intake.regionDdd,
        whatsappName: intake.whatsappName || "",
        textOptions: intake.textOptions,
        responseLink: intake.responseLink || "",
        campaignMediaKind: intake.campaignMediaKind === "video" ? "video" : "image",
        imageFileName: intake.imageFileName || "",
        whatsappLogoFileName: intake.whatsappLogoFileName || "",
        spreadsheetFileName: intake.spreadsheetFileName || "",
        importedLineCount: Math.max(0, Math.round(Number(intake.importedLineCount || 0))),
        plannedSendCount: Math.max(0, Math.round(Number(intake.plannedSendCount || 0))),
        scheduledSendAt: intake.scheduledSendAt || "",
        status: (0, waba_campaign_intake_status_1.normalizeCampaignIntakeStatus)(intake.status),
        apiKind: (0, waba_dispatches_api_kind_1.resolveIntakeApiKindFromIntake)(intake),
        canEdit: canEditOfficialCampaign(intake, intake.ownerEmail),
        canDuplicate: canDuplicateOfficialCampaign(intake, intake.ownerEmail),
    };
}
