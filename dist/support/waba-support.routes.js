"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWabaSupportRoutes = void 0;
const multer_1 = __importDefault(require("multer"));
const waba_auth_service_1 = require("../auth/waba-auth.service");
const waba_system_user_service_1 = require("../users/waba-system-user.service");
const waba_support_ticket_service_1 = require("./waba-support-ticket.service");
const supportTicketService = new waba_support_ticket_service_1.WabaSupportTicketService();
const UPLOAD_MAX_BYTES = 50 * 1024 * 1024;
const uploadSupportAttachments = (0, multer_1.default)({
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
const rejectUnlessSubscriber = (req, res) => {
    const auth = resolveRequestAuth(req);
    if (!auth.email) {
        res.status(401).json({ error: "Faça login para abrir um chamado de suporte." });
        return null;
    }
    if ((0, waba_system_user_service_1.isStaffRole)(auth.role)) {
        res.status(403).json({ error: "O suporte por chamado é exclusivo para assinantes." });
        return null;
    }
    return auth.email;
};
const registerWabaSupportRoutes = (app) => {
    app.post("/support/tickets/open", (req, res) => {
        const ownerEmail = rejectUnlessSubscriber(req, res);
        if (!ownerEmail)
            return;
        try {
            const ticket = supportTicketService.openDraft(ownerEmail);
            return res.status(201).json({
                ticket: {
                    id: ticket.id,
                    displayId: ticket.displayId,
                    status: ticket.status,
                },
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Não foi possível abrir o chamado.";
            return res.status(500).json({ error: message });
        }
    });
    app.post("/support/tickets/:ticketId/submit", (req, res, next) => {
        uploadSupportAttachments.array("attachments", 8)(req, res, (err) => {
            if (err) {
                const limitErr = err instanceof multer_1.default.MulterError && err.code === "LIMIT_FILE_SIZE";
                return res.status(400).json({
                    error: limitErr
                        ? "Cada anexo deve ter no máximo 50 MB."
                        : err.message || "Falha no upload dos anexos.",
                });
            }
            next();
        });
    }, (req, res) => {
        const ownerEmail = rejectUnlessSubscriber(req, res);
        if (!ownerEmail)
            return;
        const ticketId = String(req.params.ticketId || "").trim();
        if (!ticketId) {
            return res.status(400).json({ error: "Chamado inválido." });
        }
        const body = req.body;
        const description = String(body.description ?? "");
        try {
            const ticket = supportTicketService.submitDraft(ownerEmail, ticketId, description, Array.isArray(req.files) ? req.files : []);
            return res.status(200).json({
                ticket: {
                    id: ticket.id,
                    displayId: ticket.displayId,
                    status: ticket.status,
                    submittedAt: ticket.submittedAt,
                },
                message: "Chamado enviado com sucesso. Nossa equipe entrará em contato em breve.",
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Não foi possível enviar o chamado.";
            const status = message.includes("não encontrado") ? 404 : 400;
            return res.status(status).json({ error: message });
        }
    });
};
exports.registerWabaSupportRoutes = registerWabaSupportRoutes;
