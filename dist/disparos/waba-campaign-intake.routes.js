"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWabaCampaignIntakeRoutes = void 0;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const multer_1 = __importDefault(require("multer"));
const waba_auth_service_1 = require("../auth/waba-auth.service");
const waba_disparos_credits_service_1 = require("../billing/waba-disparos-credits.service");
const waba_master_disparos_policy_service_1 = require("../users/waba-master-disparos-policy.service");
const waba_subscriber_segment_1 = require("../subscribers/waba-subscriber-segment");
const waba_campaign_intake_repository_1 = require("./waba-campaign-intake.repository");
const waba_dispatches_api_kind_1 = require("./waba-dispatches-api-kind");
const waba_campaign_intake_oficial_dedupe_1 = require("./waba-campaign-intake-oficial-dedupe");
const waba_campaign_spreadsheet_util_1 = require("./waba-campaign-spreadsheet.util");
const waba_campaign_report_read_overrides_1 = require("./waba-campaign-report-read-overrides");
const waba_campaign_laboratorio_attended_1 = require("./waba-campaign-laboratorio-attended");
const waba_campaign_performance_metrics_1 = require("./waba-campaign-performance-metrics");
const waba_campaign_report_timeline_1 = require("./waba-campaign-report-timeline");
const waba_operacional_campaign_notify_service_1 = require("../mail/waba-operacional-campaign-notify.service");
const waba_campaign_supplier_assignment_service_1 = require("../services/waba-campaign-supplier-assignment.service");
const waba_disparos_dashboard_service_1 = require("./waba-disparos-dashboard.service");
const waba_subscriber_repository_1 = require("../subscribers/waba-subscriber.repository");
const waba_campaign_intake_status_1 = require("./waba-campaign-intake-status");
const waba_campaign_intake_idempotency_1 = require("./waba-campaign-intake-idempotency");
const waba_campaign_intake_constants_1 = require("./waba-campaign-intake.constants");
const waba_campaign_intake_media_1 = require("./waba-campaign-intake-media");
const intakeRepository = new waba_campaign_intake_repository_1.WabaCampaignIntakeRepository();
const disparosCreditsService = new waba_disparos_credits_service_1.WabaDisparosCreditsService();
const masterPolicyService = new waba_master_disparos_policy_service_1.WabaMasterDisparosPolicyService();
const subscriberRepository = new waba_subscriber_repository_1.WabaSubscriberRepository();
const UPLOAD_MAX_BYTES = Math.max(5, Number(process.env.CAMPAIGN_UPLOAD_MAX_MB || 100)) * 1024 * 1024;
const uploadIntake = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: UPLOAD_MAX_BYTES },
});
const resolveRequestAuth = (req) => {
    const token = (0, waba_auth_service_1.readWabaSessionCookie)(req.headers.cookie);
    const session = (0, waba_auth_service_1.verifyWabaSessionToken)(token);
    if (!session)
        return { email: "", role: "guest" };
    return {
        email: session.email.trim().toLowerCase(),
        role: (0, waba_auth_service_1.resolveSessionRole)(session),
    };
};
const normalizeDdd = (value) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length !== 2)
        return "";
    const n = Number(digits);
    if (!Number.isFinite(n) || n < 11 || n > 99)
        return "";
    return digits;
};
const normalizeStoredStatus = (status) => (0, waba_campaign_intake_status_1.normalizeCampaignIntakeStatus)(status);
const toDisplayStatus = (status, laboratorioAttended = false) => (0, waba_campaign_intake_status_1.toCampaignIntakeDisplayStatus)(status, "subscriber", { laboratorioAttended });
const parseRequestedPlannedSendCount = (body) => {
    const raw = body.plannedSendCount;
    if (raw === undefined || raw === null || String(raw).trim() === "")
        return null;
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n < 1)
        return null;
    return n;
};
const resolvePlannedSendCount = (ownerEmail, importedLineCount, requestedSendCount, apiKind) => {
    const unlimitedCredits = masterPolicyService.hasUnlimitedCredits(ownerEmail);
    if (requestedSendCount === null) {
        return {
            plannedSendCount: 0,
            isMaster: unlimitedCredits,
            error: "Informe a quantidade de envios desejada.",
        };
    }
    if (requestedSendCount < waba_campaign_intake_constants_1.WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT) {
        return {
            plannedSendCount: 0,
            isMaster: unlimitedCredits,
            error: `A campanha deve ter no mínimo ${waba_campaign_intake_constants_1.WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT} envios.`,
        };
    }
    if (requestedSendCount > importedLineCount) {
        return {
            plannedSendCount: 0,
            isMaster: unlimitedCredits,
            error: `O arquivo contém apenas ${importedLineCount} linha(s). Reduza a quantidade ou importe mais contatos.`,
        };
    }
    if (unlimitedCredits) {
        return { plannedSendCount: requestedSendCount, isMaster: true };
    }
    const remaining = disparosCreditsService.getRemainingShipmentsForApi(ownerEmail, apiKind);
    const apiLabel = apiKind === "alternativa" ? "API Alternativa" : "API Oficial";
    if (remaining < 1) {
        return {
            plannedSendCount: 0,
            isMaster: false,
            error: `Você não possui envios disponíveis no plano ${apiLabel}. Contrate um pacote antes de gerar a campanha.`,
        };
    }
    if (requestedSendCount > remaining) {
        return {
            plannedSendCount: 0,
            isMaster: false,
            error: `No plano ${apiLabel}, você possui apenas ${remaining} envio(s) disponível(is).`,
        };
    }
    return { plannedSendCount: requestedSendCount, isMaster: false };
};
const resolveReportedSentCount = (intake) => {
    const status = normalizeStoredStatus(intake.status);
    if (status !== "completed" || !intake.performanceReport)
        return 0;
    const sent = Math.round(Number(intake.performanceReport.sent ?? NaN));
    if (!Number.isFinite(sent) || sent < 0)
        return 0;
    return sent;
};
const toPublicIntake = (intake) => {
    const storedStatus = normalizeStoredStatus(intake.status);
    const holdInProgress = (0, waba_campaign_report_read_overrides_1.campaignHoldsSubscriberInProgress)(intake.campaignName, intake.createdAt, intake.id);
    const status = holdInProgress ? "in_progress" : storedStatus;
    const importedLineCount = Math.max(0, Math.round(Number(intake.importedLineCount ?? 0)));
    const plannedSendCount = Math.max(0, Math.round(Number(intake.plannedSendCount ?? 0)));
    const apiKind = (0, waba_dispatches_api_kind_1.resolveIntakeApiKindFromIntake)(intake);
    const laboratorioAttended = (0, waba_campaign_laboratorio_attended_1.campaignAttendedByLaboratorioStaff)(intake);
    return {
        id: intake.id,
        name: intake.campaignName,
        campaignName: intake.campaignName,
        createdAt: intake.createdAt,
        updatedAt: intake.updatedAt,
        status,
        displayStatus: toDisplayStatus(status, laboratorioAttended && !holdInProgress),
        regionDdd: intake.regionDdd,
        importedLineCount,
        plannedSendCount,
        apiKind,
        planTypeLabel: waba_dispatches_api_kind_1.WABA_DISPATCHES_API_LABELS[apiKind],
        /** Envios confirmados no relatório do operacional (somente campanhas finalizadas). */
        sentCount: holdInProgress ? 0 : resolveReportedSentCount(intake),
        hasErrorReport: status === "error_reported",
        laboratorioAttended,
        reportSource: holdInProgress ? null : intake.performanceReport?.source || null,
        source: "intake",
    };
};
const parseClientRequestId = (body) => {
    const raw = String(body.clientRequestId ?? body.idempotencyKey ?? "").trim();
    if (!raw || raw.length > 128)
        return "";
    if (!/^[a-zA-Z0-9:_-]+$/.test(raw))
        return "";
    return raw;
};
const findDuplicateCampaignIntake = (ownerEmail, clientRequestId, submissionFingerprint, withinMs) => {
    if (clientRequestId) {
        const byRequestId = intakeRepository.findByOwnerAndClientRequestId(ownerEmail, clientRequestId);
        if (byRequestId)
            return byRequestId;
    }
    if (submissionFingerprint) {
        const byFingerprint = intakeRepository.findRecentByOwnerAndSubmissionFingerprint(ownerEmail, submissionFingerprint, withinMs);
        if (byFingerprint)
            return byFingerprint;
    }
    return null;
};
const buildIntakeSuccessPayload = (intake, options = {}) => {
    const plannedSendCount = Math.max(0, Math.round(Number(intake.plannedSendCount ?? 0)));
    const importedLineCount = Math.max(0, Math.round(Number(intake.importedLineCount ?? 0)));
    const duplicatesRemoved = Math.max(0, Math.round(Number(options.duplicatesRemoved || 0)));
    const importedLabel = duplicatesRemoved > 0 ? "contatos únicos" : "linhas importadas";
    let importSummary = plannedSendCount < importedLineCount
        ? `Quantidade de ${importedLabel}: ${importedLineCount}. Quantidade de envios: ${plannedSendCount} envios (limite do seu pacote contratado).`
        : `Quantidade de ${importedLabel}: ${importedLineCount}. Quantidade de envios: ${plannedSendCount} envios.`;
    if (duplicatesRemoved > 0) {
        importSummary += ` ${duplicatesRemoved} telefone(s) duplicado(s) foram excluídos (1 envio por número).`;
    }
    return {
        ok: true,
        deduplicated: Boolean(options.deduplicated),
        ...toPublicIntake(intake),
        duplicatesRemoved,
        operacionalNotify: options.operacionalNotify,
        message: options.deduplicated
            ? "Campanha já havia sido registrada. Não foi criada duplicata."
            : "Nosso time está trabalhando em sua campanha, em breve retornaremos com os indicadores de performance.",
        importSummary,
    };
};
const finalizeIntakeAfterCreate = (intake) => {
    const current = new waba_campaign_supplier_assignment_service_1.WabaCampaignSupplierAssignmentService().ensureInitialAssignment(intake);
    (0, waba_operacional_campaign_notify_service_1.scheduleOperacionalStaffNotifyOnCampaignAssigned)(current);
    return current;
};
const parseResponseLink = (body) => {
    const raw = String(body.responseLink ?? "").trim();
    if (!raw)
        return null;
    try {
        const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
        if (url.protocol !== "http:" && url.protocol !== "https:")
            return null;
        return url.toString();
    }
    catch {
        return null;
    }
};
const listAvailableApiKindsForEmail = (ownerEmail) => {
    const email = ownerEmail.trim().toLowerCase();
    const kinds = [];
    const betsOnlyOficial = (0, waba_subscriber_segment_1.isBetsSubscriberEmail)(email);
    for (const kind of ["oficial", "alternativa"]) {
        if (betsOnlyOficial && kind === "alternativa")
            continue;
        if (disparosCreditsService.getRemainingShipmentsForApi(email, kind) > 0) {
            kinds.push(kind);
        }
    }
    return kinds;
};
const parseRequestedApiKind = (body, ownerEmail) => {
    const email = ownerEmail.trim().toLowerCase();
    const requested = (0, waba_dispatches_api_kind_1.normalizeDispatchesApiKind)(body.apiKind);
    if ((0, waba_subscriber_segment_1.isBetsSubscriberEmail)(email) && requested === "alternativa") {
        return {
            apiKind: "oficial",
            error: "Assinantes do segmento Bets geram campanhas apenas na API Oficial.",
        };
    }
    if (masterPolicyService.hasUnlimitedCredits(email)) {
        return { apiKind: requested === "alternativa" ? "alternativa" : "oficial" };
    }
    const available = listAvailableApiKindsForEmail(email);
    if (!available.length) {
        return {
            apiKind: requested === "alternativa" ? "alternativa" : "oficial",
            error: "Você não possui saldo em nenhum plano. Contrate envios antes de gerar a campanha.",
        };
    }
    // Plano explícito no wizard (ex.: API Oficial) — honra quando há saldo nesse plano.
    if (requested && available.includes(requested)) {
        return { apiKind: requested };
    }
    if (available.length === 1) {
        return { apiKind: available[0] };
    }
    if (requested && !available.includes(requested)) {
        const apiLabel = requested === "alternativa" ? "API Alternativa" : "API Oficial";
        return {
            apiKind: requested,
            error: `Você não possui envios disponíveis no plano ${apiLabel}. Contrate um pacote antes de gerar a campanha.`,
        };
    }
    return {
        apiKind: available[0],
        error: "Selecione o plano de envio (API Oficial ou API Alternativa).",
    };
};
const parseTextOptions = (body) => {
    const options = [
        String(body.textOption1 ?? "").trim(),
        String(body.textOption2 ?? "").trim(),
        String(body.textOption3 ?? "").trim(),
    ];
    if (options.some((text) => text.length < 8))
        return null;
    return options;
};
const parseWhatsappName = (body) => {
    const name = String(body.whatsappName ?? "").trim();
    if (name.length < 2 || name.length > 80)
        return "";
    return name;
};
const handleCampaignIntakeUpload = (req, res, next) => {
    uploadIntake.fields([
        { name: "image", maxCount: 1 },
        { name: "whatsappLogo", maxCount: 1 },
        { name: "spreadsheet", maxCount: 1 },
    ])(req, res, (err) => {
        if (!err) {
            next();
            return;
        }
        const limitErr = err instanceof multer_1.default.MulterError && err.code === "LIMIT_FILE_SIZE";
        const msg = limitErr
            ? `Arquivo acima do limite de ${Math.round(UPLOAD_MAX_BYTES / 1024 / 1024)}MB.`
            : err.message || "Falha no upload dos arquivos da campanha.";
        return res.status(400).json({ error: msg });
    });
};
const registerWabaCampaignIntakeRoutes = (app) => {
    app.post("/disparos/campanhas/intake", handleCampaignIntakeUpload, async (req, res) => {
        try {
            const auth = resolveRequestAuth(req);
            if (!auth.email) {
                return res.status(401).json({ error: "Faça login para enviar a campanha." });
            }
            const body = req.body;
            const clientRequestId = parseClientRequestId(body);
            const campaignName = String(body.campaignName ?? "").trim();
            const regionDdd = normalizeDdd(String(body.regionDdd ?? ""));
            const whatsappName = parseWhatsappName(body);
            const textOptions = parseTextOptions(body);
            const responseLink = parseResponseLink(body);
            if (campaignName.length < 2) {
                return res.status(400).json({ error: "Informe o nome da campanha." });
            }
            if (!regionDdd) {
                return res.status(400).json({ error: "Informe um DDD válido (2 dígitos)." });
            }
            if (!whatsappName) {
                return res.status(400).json({
                    error: "Informe o nome no WhatsApp (entre 2 e 80 caracteres).",
                });
            }
            if (!textOptions) {
                return res.status(400).json({ error: "Preencha as 3 opções de texto (mínimo 8 caracteres cada)." });
            }
            if (!responseLink) {
                return res.status(400).json({ error: "Informe um link de resposta válido (http ou https)." });
            }
            const files = req.files;
            const imageFile = files?.image?.[0];
            const whatsappLogoFile = files?.whatsappLogo?.[0];
            const spreadsheetFile = files?.spreadsheet?.[0];
            if (!imageFile) {
                return res.status(400).json({
                    error: "Envie a imagem (PNG ou JPG, 1080×1080) ou o vídeo MP4 da campanha.",
                });
            }
            if (!whatsappLogoFile) {
                return res.status(400).json({ error: "Envie a logo do WhatsApp (500×500 px)." });
            }
            if (!spreadsheetFile) {
                return res.status(400).json({ error: "Envie o arquivo Excel ou TXT com a lista de leads." });
            }
            const mediaKind = (0, waba_campaign_intake_media_1.parseCampaignMediaKind)(body.mediaKind);
            const mediaCheck = (0, waba_campaign_intake_media_1.validateCampaignIntakeMedia)({
                kind: mediaKind,
                buffer: imageFile.buffer,
                mime: imageFile.mimetype,
                fileName: imageFile.originalname,
            });
            if (!mediaCheck.ok) {
                return res.status(400).json({ error: mediaCheck.error });
            }
            const logoMime = String(whatsappLogoFile.mimetype || "").toLowerCase();
            if (!logoMime.startsWith("image/")) {
                return res.status(400).json({ error: "A logo do WhatsApp deve ser PNG ou JPG." });
            }
            const sheetName = String(spreadsheetFile.originalname || "").toLowerCase();
            if (!(0, waba_campaign_spreadsheet_util_1.isCampaignLeadsFileName)(sheetName)) {
                return res.status(400).json({
                    error: "A lista de clientes deve ser Excel (.xlsx ou .xls) ou TXT (.txt).",
                });
            }
            const { apiKind, error: apiKindError } = parseRequestedApiKind(body, auth.email);
            if (apiKindError) {
                return res.status(400).json({ error: apiKindError });
            }
            let importedLineCount = 0;
            let leadsBufferForTrim = spreadsheetFile.buffer;
            let phoneDuplicatesRemoved = 0;
            let officialUniqueSheet = null;
            try {
                if (apiKind === "oficial") {
                    const deduped = (0, waba_campaign_intake_oficial_dedupe_1.parseOfficialCampaignLeadsUnique)(spreadsheetFile.buffer, sheetName);
                    importedLineCount = deduped.uniqueCount;
                    officialUniqueSheet = deduped.sheet;
                    phoneDuplicatesRemoved = deduped.duplicatesRemoved;
                }
                else {
                    importedLineCount = (0, waba_campaign_spreadsheet_util_1.countLeadsImportedRows)(spreadsheetFile.buffer, sheetName);
                }
            }
            catch {
                return res.status(400).json({ error: "Não foi possível ler o arquivo de leads." });
            }
            if (importedLineCount < 1) {
                return res.status(400).json({ error: "O arquivo não contém linhas de leads." });
            }
            if (importedLineCount < waba_campaign_intake_constants_1.WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT) {
                return res.status(400).json({
                    error: apiKind === "oficial"
                        ? `O arquivo precisa ter no mínimo ${waba_campaign_intake_constants_1.WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT} contatos únicos para gerar a campanha.`
                        : `O arquivo precisa ter no mínimo ${waba_campaign_intake_constants_1.WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT} contatos para gerar a campanha.`,
                });
            }
            const requestedSendCount = parseRequestedPlannedSendCount(body);
            const { plannedSendCount, isMaster, error: plannedSendError } = resolvePlannedSendCount(auth.email, importedLineCount, requestedSendCount, apiKind);
            if (plannedSendError) {
                return res.status(400).json({ error: plannedSendError });
            }
            const submissionFingerprint = (0, waba_campaign_intake_idempotency_1.buildCampaignIntakeSubmissionFingerprint)({
                campaignName,
                regionDdd,
                whatsappName,
                plannedSendCount,
                apiKind,
                imageByteLength: imageFile.buffer.length,
                whatsappLogoByteLength: whatsappLogoFile.buffer.length,
                spreadsheetByteLength: spreadsheetFile.buffer.length,
            });
            const duplicateWindowMs = (0, waba_campaign_intake_idempotency_1.resolveCampaignIntakeDuplicateWindowMs)();
            const submissionLockKey = clientRequestId
                ? `${auth.email}:${clientRequestId}`
                : `${auth.email}:fp:${submissionFingerprint}`;
            let trimmedSpreadsheetBuffer;
            try {
                trimmedSpreadsheetBuffer = officialUniqueSheet
                    ? (0, waba_campaign_intake_oficial_dedupe_1.writeOfficialCampaignLeadsFile)(officialUniqueSheet, sheetName, plannedSendCount)
                    : (0, waba_campaign_spreadsheet_util_1.trimLeadsBufferToRowCount)(leadsBufferForTrim, plannedSendCount, sheetName);
            }
            catch {
                return res.status(400).json({ error: "Não foi possível preparar o arquivo de leads para envio." });
            }
            const intakeResult = await (0, waba_campaign_intake_idempotency_1.withCampaignIntakeSubmissionLock)(submissionLockKey, async () => {
                const duplicate = findDuplicateCampaignIntake(auth.email, clientRequestId, submissionFingerprint, duplicateWindowMs);
                if (duplicate) {
                    return { deduplicated: true, intake: duplicate };
                }
                const now = new Date().toISOString();
                const intakeId = (0, node_crypto_1.randomUUID)();
                const storageDir = (0, waba_campaign_intake_repository_1.resolveCampaignIntakeStorageDir)(intakeId);
                const imageExt = mediaCheck.extension;
                const logoExt = logoMime.includes("png") ? ".png" : ".jpg";
                const imageStoredPath = node_path_1.default.join(storageDir, mediaKind === "video" ? `campaign-media${imageExt}` : `campaign-image${imageExt}`);
                const whatsappLogoStoredPath = node_path_1.default.join(storageDir, `whatsapp-logo${logoExt}`);
                const originalLeadsName = spreadsheetFile.originalname ||
                    ((0, waba_campaign_spreadsheet_util_1.isCampaignLeadsTxtFileName)(sheetName) ? "leads.txt" : "leads.xlsx");
                const spreadsheetStoredPath = node_path_1.default.join(storageDir, originalLeadsName);
                const trimmedExt = (0, waba_campaign_spreadsheet_util_1.isCampaignLeadsTxtFileName)(sheetName) ? "txt" : "xlsx";
                const spreadsheetTrimmedFileName = `leads-${plannedSendCount}-envios.${trimmedExt}`;
                const spreadsheetTrimmedPath = node_path_1.default.join(storageDir, spreadsheetTrimmedFileName);
                try {
                    (0, node_fs_1.writeFileSync)(imageStoredPath, imageFile.buffer);
                    (0, node_fs_1.writeFileSync)(whatsappLogoStoredPath, whatsappLogoFile.buffer);
                    (0, node_fs_1.writeFileSync)(spreadsheetStoredPath, spreadsheetFile.buffer);
                    (0, node_fs_1.writeFileSync)(spreadsheetTrimmedPath, trimmedSpreadsheetBuffer);
                }
                catch {
                    throw Object.assign(new Error("Não foi possível gravar os arquivos da campanha no servidor. Tente novamente."), {
                        statusCode: 500,
                    });
                }
                const intake = intakeRepository.create({
                    id: intakeId,
                    ownerEmail: auth.email,
                    campaignName,
                    regionDdd,
                    whatsappName,
                    whatsappLogoFileName: whatsappLogoFile.originalname || `whatsapp-logo${logoExt}`,
                    whatsappLogoStoredPath,
                    textOptions,
                    responseLink,
                    campaignMediaKind: mediaKind,
                    imageFileName: imageFile.originalname || `campaign-media${imageExt}`,
                    imageStoredPath,
                    spreadsheetFileName: spreadsheetFile.originalname || originalLeadsName,
                    spreadsheetStoredPath,
                    spreadsheetTrimmedPath,
                    spreadsheetTrimmedFileName,
                    importedLineCount,
                    plannedSendCount,
                    apiKind,
                    status: "generated",
                    clientRequestId: clientRequestId || undefined,
                    submissionFingerprint,
                    createdAt: now,
                    updatedAt: now,
                });
                let persisted = intake;
                if (!isMaster && plannedSendCount > 0) {
                    const creditFunding = disparosCreditsService.consumeShipments(auth.email, plannedSendCount, apiKind);
                    persisted =
                        intakeRepository.updateById(intake.id, {
                            creditFunding,
                            updatedAt: new Date().toISOString(),
                        }) ?? intake;
                }
                const finalized = finalizeIntakeAfterCreate(persisted);
                return { deduplicated: false, intake: finalized };
            });
            if (intakeResult.deduplicated) {
                console.info(`[disparos/campanhas/intake] dedupe ${auth.email} ` +
                    `(clientRequestId=${clientRequestId || "-"}, intake=${intakeResult.intake.id}).`);
                return res
                    .status(200)
                    .json(buildIntakeSuccessPayload(intakeResult.intake, {
                    deduplicated: true,
                    duplicatesRemoved: phoneDuplicatesRemoved,
                }));
            }
            return res.status(201).json(buildIntakeSuccessPayload(intakeResult.intake, { duplicatesRemoved: phoneDuplicatesRemoved }));
        }
        catch (error) {
            const statusCode = Number(error?.statusCode || 0);
            if (statusCode >= 400 && statusCode < 600) {
                return res.status(statusCode).json({ error: error.message });
            }
            console.error("[disparos/campanhas/intake] erro:", error);
            return res.status(500).json({
                error: "Erro interno ao processar a campanha. Tente novamente em instantes.",
            });
        }
    });
    app.get("/disparos/campanhas/intake", (req, res) => {
        try {
            const auth = resolveRequestAuth(req);
            if (!auth.email) {
                return res.status(401).json({ error: "Faça login para listar suas campanhas." });
            }
            const items = intakeRepository.listByEmail(auth.email).map(toPublicIntake);
            res.setHeader("Cache-Control", "no-store");
            return res.status(200).json({ items });
        }
        catch (error) {
            console.error("[disparos/campanhas/intake] list erro:", error);
            return res.status(500).json({ error: "Erro ao carregar campanhas geradas. Tente novamente." });
        }
    });
    app.get("/disparos/campanhas/intake/:id/relatorio", (req, res) => {
        const auth = resolveRequestAuth(req);
        if (!auth.email) {
            return res.status(401).json({ error: "Faça login para ver o relatório." });
        }
        const intake = intakeRepository.getById(req.params.id);
        if (!intake || intake.ownerEmail !== auth.email) {
            return res.status(404).json({ error: "Campanha não encontrada." });
        }
        const holdInProgress = (0, waba_campaign_report_read_overrides_1.campaignHoldsSubscriberInProgress)(intake.campaignName, intake.createdAt, intake.id);
        const status = holdInProgress ? "in_progress" : normalizeStoredStatus(intake.status);
        if (status === "error_reported") {
            return res.status(400).json({
                error: "Esta campanha foi finalizada com erro reportado. Consulte o motivo na lista de campanhas.",
            });
        }
        if (status !== "completed") {
            return res.status(400).json({
                error: "O relatório fica disponível quando a campanha estiver com status Finalizado.",
            });
        }
        const report = (0, waba_campaign_report_read_overrides_1.applyCampaignReportReadOverride)(intake.campaignName, intake.createdAt, intake.performanceReport);
        const showClicks = report?.source === "meta_lab" &&
            !(0, waba_campaign_report_read_overrides_1.campaignReportHidesClicks)(intake.campaignName, intake.createdAt, report);
        const metrics = report
            ? (0, waba_campaign_performance_metrics_1.computeCampaignPerformanceMetrics)({
                totalLeads: report.totalLeads,
                sent: report.sent,
                delivered: report.delivered,
                read: report.read,
                failed: report.failed,
                clicks: showClicks ? report.clicks : 0,
            })
            : null;
        const indicators = report
            ? {
                totalLeads: report.totalLeads,
                enviados: report.sent,
                entregues: report.delivered,
                lidos: report.read,
                falhados: report.failed,
                ...(showClicks
                    ? {
                        cliques: metrics?.clicks ?? 0,
                        taxaCliques: metrics?.clickRate ?? 0,
                    }
                    : {}),
            }
            : {
                totalLeads: 0,
                enviados: 0,
                entregues: 0,
                lidos: 0,
                falhados: 0,
            };
        return res.status(200).json({
            campaignName: intake.campaignName,
            createdAt: intake.createdAt,
            completedAt: intake.updatedAt,
            displayStatus: toDisplayStatus(status, (0, waba_campaign_laboratorio_attended_1.campaignAttendedByLaboratorioStaff)(intake)),
            regionDdd: intake.regionDdd,
            source: report?.source || "manual",
            showClicks,
            timeline: (0, waba_campaign_report_timeline_1.collectIntakeReportTimeline)(intake),
            indicators,
            message: report
                ? showClicks
                    ? "Indicadores gerados automaticamente com dados da Meta."
                    : "Indicadores de performance da campanha."
                : "Indicadores de performance serão atualizados pela equipe assim que a consolidação estiver concluída.",
        });
    });
    app.get("/disparos/campanhas/intake/:id/erro", (req, res) => {
        const auth = resolveRequestAuth(req);
        if (!auth.email) {
            return res.status(401).json({ error: "Faça login para ver o motivo do erro." });
        }
        const intake = intakeRepository.getById(req.params.id);
        if (!intake || intake.ownerEmail !== auth.email) {
            return res.status(404).json({ error: "Campanha não encontrada." });
        }
        const status = normalizeStoredStatus(intake.status);
        if (status !== "error_reported" || !intake.errorReport) {
            return res.status(400).json({ error: "Esta campanha não possui erro reportado." });
        }
        return res.status(200).json({
            campaignId: intake.id,
            campaignName: intake.campaignName,
            displayStatus: toDisplayStatus(status),
            justification: intake.errorReport.justification,
            reportedAt: intake.errorReport.reportedAt,
        });
    });
    app.get("/disparos/dashboard/overview", (req, res) => {
        const auth = resolveRequestAuth(req);
        if (!auth.email) {
            return res.status(401).json({ error: "Faça login para ver seu dashboard de disparos." });
        }
        const overview = auth.role === "master"
            ? (0, waba_disparos_dashboard_service_1.buildMasterSubscribersDisparosDashboardOverview)(auth.email, intakeRepository.listAll(), subscriberRepository.list().map((subscriber) => ({
                email: subscriber.email,
                fullName: subscriber.fullName,
            })))
            : (0, waba_disparos_dashboard_service_1.buildDisparosDashboardOverview)(auth.email, intakeRepository.listByEmail(auth.email));
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json(overview);
    });
};
exports.registerWabaCampaignIntakeRoutes = registerWabaCampaignIntakeRoutes;
