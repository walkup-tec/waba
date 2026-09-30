"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PELLI_REOPEN_TEXT = exports.PELLI_REOPEN_IMAGE_STORED_NAME = exports.PELLI_REOPEN_IMAGE_FILE_NAME = exports.PELLI_REOPEN_LEADS_FILE_NAME = exports.PELLI_REOPEN_LEADS_ASSET_NAME = exports.PELLI_REOPEN_PLANNED_SEND_COUNT = exports.PELLI_REOPEN_OPERACIONAL_EMAIL = exports.PELLI_REOPEN_CAMPAIGN_NAME = void 0;
exports.isPelliAgendaPessoalCampaignName = isPelliAgendaPessoalCampaignName;
exports.resolvePelliReopenLeadsPath = resolvePelliReopenLeadsPath;
exports.resolvePelliReopenImagePath = resolvePelliReopenImagePath;
exports.applyPelliReopenToAifocus = applyPelliReopenToAifocus;
exports.runPelliReopenAifocusOneshot = runPelliReopenAifocusOneshot;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const load_env_1 = require("../load-env");
const waba_campaign_intake_repository_1 = require("./waba-campaign-intake.repository");
const waba_campaign_intake_oficial_dedupe_1 = require("./waba-campaign-intake-oficial-dedupe");
const waba_campaign_intake_media_1 = require("./waba-campaign-intake-media");
const meta_whatsapp_broadcast_store_1 = require("../integrations/meta-whatsapp/meta-whatsapp-broadcast.store");
const waba_system_user_service_1 = require("../users/waba-system-user.service");
const waba_financeiro_split_service_1 = require("../billing/waba-financeiro-split.service");
exports.PELLI_REOPEN_CAMPAIGN_NAME = "Primeiro disparo - agenda pessoal Pelli";
exports.PELLI_REOPEN_OPERACIONAL_EMAIL = "aifocusdev@gmail.com";
exports.PELLI_REOPEN_PLANNED_SEND_COUNT = 13922;
exports.PELLI_REOPEN_LEADS_ASSET_NAME = "pelli-leads-13922-envios.xlsx";
exports.PELLI_REOPEN_LEADS_FILE_NAME = "leads-13922-envios.xlsx";
exports.PELLI_REOPEN_IMAGE_FILE_NAME = "pelli-agora-e-outra-historia.png";
exports.PELLI_REOPEN_IMAGE_STORED_NAME = "campaign-image.png";
exports.PELLI_REOPEN_TEXT = `Olá!
Trazendo atualizações importantes: 
Nessa reta final está liberado o seu pedido de voto para todo mundo que conhece e acredita nesse projeto para o Rio!
Falta pouco para o grande dia, e cada conversa agora define o nosso futuro.
Pense em dez pessoas agora e compartilhe nossos materiais para elas. É de conversa em conversa que a nossa força se multiplica.
No dia 04/10, digite 40004 para confirmar esse projeto de renovação, educação e compromisso com o Rio! 🚀

Vamos juntos!
Renato Pellizzari | 40004

Clique em "Mais Informações" e verifique as atualizações aqui na nossa comunidade.`;
const normalizeName = (value) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
function isPelliAgendaPessoalCampaignName(campaignName) {
    return normalizeName(campaignName) === normalizeName(exports.PELLI_REOPEN_CAMPAIGN_NAME);
}
function resolvePelliAssetPath(fileName) {
    const candidates = [
        node_path_1.default.join(__dirname, "assets", fileName),
        node_path_1.default.join(process.cwd(), "src", "disparos", "assets", fileName),
        node_path_1.default.join(process.cwd(), "dist", "disparos", "assets", fileName),
    ];
    return candidates.find((item) => (0, node_fs_1.existsSync)(item)) || candidates[0];
}
function resolvePelliReopenLeadsPath() {
    return resolvePelliAssetPath(exports.PELLI_REOPEN_LEADS_ASSET_NAME);
}
function resolvePelliReopenImagePath() {
    return resolvePelliAssetPath("pelli-campaign-image.png");
}
function findPelliIntake(repository) {
    const named = repository.listAll().filter((row) => isPelliAgendaPessoalCampaignName(row.campaignName));
    if (!named.length)
        return null;
    named.sort((a, b) => Date.parse(String(b.updatedAt || b.createdAt || "")) -
        Date.parse(String(a.updatedAt || a.createdAt || "")));
    return named[0] || null;
}
function alreadyReopened(intake, uniqueCount, text) {
    const assigned = normalizeEmail(intake.assignedOperacionalEmail || "");
    const status = String(intake.status || "").trim();
    const firstText = String(intake.textOptions?.[0] || "");
    if (assigned !== exports.PELLI_REOPEN_OPERACIONAL_EMAIL)
        return false;
    if (status !== "generated")
        return false;
    if (intake.performanceReport)
        return false;
    if (intake.startedAt)
        return false;
    if (firstText !== text)
        return false;
    if (Math.round(Number(intake.plannedSendCount || 0)) !== uniqueCount)
        return false;
    return true;
}
function hasPelliCampaignImage(intake) {
    if (String(intake.imageFileName || "").trim() !== exports.PELLI_REOPEN_IMAGE_FILE_NAME)
        return false;
    if (String(intake.campaignMediaKind || "image") === "video")
        return false;
    return (0, node_fs_1.existsSync)(String(intake.imageStoredPath || "").trim());
}
function replacePelliCampaignImage(repository, intake, imagePath, updatedAt) {
    if (hasPelliCampaignImage(intake)) {
        return { ok: true, skipped: true, message: "Imagem da Pelli já estava atualizada" };
    }
    if (!(0, node_fs_1.existsSync)(imagePath)) {
        return { ok: false, message: `Imagem da Pelli ausente: ${imagePath}` };
    }
    const buffer = (0, node_fs_1.readFileSync)(imagePath);
    const mediaCheck = (0, waba_campaign_intake_media_1.validateCampaignIntakeMedia)({
        kind: "image",
        buffer,
        mime: "image/png",
        fileName: exports.PELLI_REOPEN_IMAGE_FILE_NAME,
    });
    if (!mediaCheck.ok) {
        return { ok: false, message: mediaCheck.error };
    }
    const storageDir = (0, waba_campaign_intake_repository_1.resolveCampaignIntakeStorageDir)(intake.id);
    (0, node_fs_1.mkdirSync)(storageDir, { recursive: true });
    const imageStoredPath = node_path_1.default.join(storageDir, exports.PELLI_REOPEN_IMAGE_STORED_NAME);
    (0, node_fs_1.writeFileSync)(imageStoredPath, buffer);
    const updated = repository.updateById(intake.id, {
        campaignMediaKind: "image",
        imageFileName: exports.PELLI_REOPEN_IMAGE_FILE_NAME,
        imageStoredPath,
        updatedAt,
    });
    if (!updated) {
        return { ok: false, message: "Não foi possível gravar a imagem da Pelli." };
    }
    return { ok: true, applied: true, message: `Imagem da Pelli atualizada (${intake.id})` };
}
function resolveSupplierId(intake, operacionalEmail) {
    const apiKind = String(intake.apiKind || "oficial").trim() || "oficial";
    try {
        const split = new waba_financeiro_split_service_1.WabaFinanceiroSplitService();
        const suppliers = Array.isArray(split.getConfig().suppliers) ? split.getConfig().suppliers : [];
        const hit = suppliers.find((row) => normalizeEmail(row.systemUserEmail) === operacionalEmail &&
            String(row.apiKind || "") === apiKind) || suppliers.find((row) => normalizeEmail(row.systemUserEmail) === operacionalEmail);
        if (hit?.id)
            return String(hit.id);
    }
    catch {
        /* config ausente no teste local */
    }
    return `manual-aifocusdev-gmail-com-${apiKind}-outros`;
}
function applyPelliReopenToAifocus(deps = {}) {
    const repository = deps.intakeRepository || new waba_campaign_intake_repository_1.WabaCampaignIntakeRepository();
    const systemUserService = deps.systemUserService || new waba_system_user_service_1.WabaSystemUserService();
    const now = deps.now || (() => new Date().toISOString());
    const leadsPath = String(deps.leadsPath || resolvePelliReopenLeadsPath()).trim();
    const imagePath = String(deps.imagePath || resolvePelliReopenImagePath()).trim();
    const text = exports.PELLI_REOPEN_TEXT;
    const textOptions = [text, text, text];
    const intake = findPelliIntake(repository);
    if (!intake) {
        return { ok: false, message: "Campanha Primeiro disparo - agenda pessoal Pelli não encontrada." };
    }
    const operacional = systemUserService.getByEmail(exports.PELLI_REOPEN_OPERACIONAL_EMAIL);
    if (!operacional || operacional.role !== "operacional") {
        return {
            ok: false,
            campaignId: intake.id,
            message: `Operacional ${exports.PELLI_REOPEN_OPERACIONAL_EMAIL} não encontrado.`,
        };
    }
    if (!(0, node_fs_1.existsSync)(leadsPath)) {
        return { ok: false, campaignId: intake.id, message: `Planilha da Pelli ausente: ${leadsPath}` };
    }
    const originalBuffer = (0, node_fs_1.readFileSync)(leadsPath);
    const deduped = (0, waba_campaign_intake_oficial_dedupe_1.dedupeOfficialCampaignLeadsFile)(originalBuffer, exports.PELLI_REOPEN_LEADS_FILE_NAME, exports.PELLI_REOPEN_PLANNED_SEND_COUNT);
    const uniqueCount = Math.min(Math.max(0, Math.round(Number(deduped.uniqueCount || 0))), exports.PELLI_REOPEN_PLANNED_SEND_COUNT);
    if (uniqueCount < 1) {
        return { ok: false, campaignId: intake.id, message: "A planilha da Pelli não tem telefones únicos." };
    }
    if (alreadyReopened(intake, uniqueCount, text)) {
        const image = replacePelliCampaignImage(repository, intake, imagePath, now());
        if (!image.ok) {
            return { ok: false, campaignId: intake.id, uniqueCount, plannedSendCount: uniqueCount, message: image.message };
        }
        if (image.applied) {
            return {
                ok: true,
                applied: true,
                campaignId: intake.id,
                uniqueCount,
                plannedSendCount: uniqueCount,
                message: image.message,
            };
        }
        return {
            ok: true,
            skipped: true,
            campaignId: intake.id,
            uniqueCount,
            plannedSendCount: uniqueCount,
            message: `Pelli já está na fila de ${exports.PELLI_REOPEN_OPERACIONAL_EMAIL} aguardando configuração (${intake.id})`,
        };
    }
    const storageDir = (0, waba_campaign_intake_repository_1.resolveCampaignIntakeStorageDir)(intake.id);
    (0, node_fs_1.mkdirSync)(storageDir, { recursive: true });
    const spreadsheetStoredPath = node_path_1.default.join(storageDir, exports.PELLI_REOPEN_LEADS_FILE_NAME);
    const trimmedName = `leads-${uniqueCount}-envios.xlsx`;
    const spreadsheetTrimmedPath = node_path_1.default.join(storageDir, trimmedName);
    (0, node_fs_1.copyFileSync)(leadsPath, spreadsheetStoredPath);
    (0, node_fs_1.writeFileSync)(spreadsheetTrimmedPath, deduped.buffer);
    const assignedAt = now();
    const image = replacePelliCampaignImage(repository, intake, imagePath, assignedAt);
    if (!image.ok) {
        return { ok: false, campaignId: intake.id, message: image.message };
    }
    const current = repository.getById(intake.id) || intake;
    const supplierId = resolveSupplierId(intake, exports.PELLI_REOPEN_OPERACIONAL_EMAIL);
    const history = Array.isArray(intake.assignmentHistory) ? intake.assignmentHistory.slice() : [];
    history.push({
        at: assignedAt,
        supplierId,
        operacionalEmail: exports.PELLI_REOPEN_OPERACIONAL_EMAIL,
        reason: "manual_master",
    });
    const patch = {
        status: "generated",
        assignedOperacionalEmail: exports.PELLI_REOPEN_OPERACIONAL_EMAIL,
        assignedSupplierId: supplierId,
        assignedAt,
        assignmentHistory: history,
        textOptions,
        campaignMediaKind: "image",
        imageFileName: current.imageFileName || exports.PELLI_REOPEN_IMAGE_FILE_NAME,
        imageStoredPath: current.imageStoredPath,
        spreadsheetFileName: exports.PELLI_REOPEN_LEADS_FILE_NAME,
        spreadsheetStoredPath,
        spreadsheetTrimmedFileName: trimmedName,
        spreadsheetTrimmedPath,
        importedLineCount: uniqueCount,
        plannedSendCount: uniqueCount,
        updatedAt: assignedAt,
        performanceReport: undefined,
        startedAt: undefined,
        startedByEmail: undefined,
        errorReport: undefined,
        payoutApproval: undefined,
        bmInoperanteRegisteredAt: undefined,
        masterOverdueAlertSentAt: undefined,
        scheduledSendAt: undefined,
    };
    const updated = repository.updateById(intake.id, patch);
    if (!updated) {
        return { ok: false, campaignId: intake.id, message: "Não foi possível gravar a campanha Pelli." };
    }
    if (deps.voidBroadcast !== false) {
        try {
            const broadcast = (0, meta_whatsapp_broadcast_store_1.findBroadcastByIntakeCampaignId)(intake.id);
            if (broadcast?.id)
                (0, meta_whatsapp_broadcast_store_1.voidBroadcastCampaignForRetry)(broadcast.id);
        }
        catch {
            /* disparo Cloud ausente não bloqueia a fila */
        }
    }
    return {
        ok: true,
        applied: true,
        campaignId: intake.id,
        uniqueCount,
        plannedSendCount: uniqueCount,
        message: `Pelli reaberta na fila de ${exports.PELLI_REOPEN_OPERACIONAL_EMAIL} com ${uniqueCount} envios (${intake.id})`,
    };
}
function runPelliReopenAifocusOneshot(deps = {}) {
    const env = String(process.env.WABA_ENV || load_env_1.WABA_ENV || "").trim().toLowerCase();
    if (!deps.forceLocal && (env === "v01" || env === "v02" || env === "v03")) {
        return { ok: true, skipped: true, message: "oneshot ignorado em ambiente local" };
    }
    try {
        return applyPelliReopenToAifocus(deps);
    }
    catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : "Falha ao reabrir a campanha Pelli",
        };
    }
}
