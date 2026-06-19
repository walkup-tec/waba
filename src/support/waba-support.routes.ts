import type { Express, Request, Response } from "express";
import multer from "multer";
import { readWabaSessionCookie, resolveSessionRole, verifyWabaSessionToken } from "../auth/waba-auth.service";
import { isStaffRole } from "../users/waba-system-user.service";
import { WabaSupportTicketService } from "./waba-support-ticket.service";

const supportTicketService = new WabaSupportTicketService();

const UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

const uploadSupportAttachments = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_BYTES },
});

const resolveRequestAuth = (req: Request) => {
  const token = readWabaSessionCookie(req.headers.cookie);
  const session = verifyWabaSessionToken(token);
  if (!session) return { email: "", role: "guest" as const };
  return {
    email: session.email.trim().toLowerCase(),
    role: resolveSessionRole(session),
  };
};

const rejectUnlessSubscriber = (req: Request, res: Response): string | null => {
  const auth = resolveRequestAuth(req);
  if (!auth.email) {
    res.status(401).json({ error: "Faça login para abrir um chamado de suporte." });
    return null;
  }
  if (isStaffRole(auth.role)) {
    res.status(403).json({ error: "O suporte por chamado é exclusivo para assinantes." });
    return null;
  }
  return auth.email;
};

export const registerWabaSupportRoutes = (app: Express) => {
  app.post("/support/tickets/open", (req, res) => {
    const ownerEmail = rejectUnlessSubscriber(req, res);
    if (!ownerEmail) return;

    try {
      const ticket = supportTicketService.openDraft(ownerEmail);
      return res.status(201).json({
        ticket: {
          id: ticket.id,
          displayId: ticket.displayId,
          status: ticket.status,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível abrir o chamado.";
      return res.status(500).json({ error: message });
    }
  });

  app.post(
    "/support/tickets/:ticketId/submit",
    (req, res, next) => {
      uploadSupportAttachments.array("attachments", 8)(req, res, (err) => {
        if (err) {
          const limitErr = err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE";
          return res.status(400).json({
            error: limitErr
              ? "Cada anexo deve ter no máximo 50 MB."
              : err.message || "Falha no upload dos anexos.",
          });
        }
        next();
      });
    },
    (req, res) => {
      const ownerEmail = rejectUnlessSubscriber(req, res);
      if (!ownerEmail) return;

      const ticketId = String(req.params.ticketId || "").trim();
      if (!ticketId) {
        return res.status(400).json({ error: "Chamado inválido." });
      }

      const body = req.body as Record<string, unknown>;
      const description = String(body.description ?? "");

      try {
        const ticket = supportTicketService.submitDraft(
          ownerEmail,
          ticketId,
          description,
          Array.isArray(req.files) ? req.files : [],
        );
        return res.status(200).json({
          ticket: {
            id: ticket.id,
            displayId: ticket.displayId,
            status: ticket.status,
            submittedAt: ticket.submittedAt,
          },
          message: "Chamado enviado com sucesso. Nossa equipe entrará em contato em breve.",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Não foi possível enviar o chamado.";
        const status = message.includes("não encontrado") ? 404 : 400;
        return res.status(status).json({ error: message });
      }
    },
  );
};
