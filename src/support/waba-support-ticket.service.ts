import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Express } from "express";
import { WabaSubscriberRepository } from "../subscribers/waba-subscriber.repository";
import {
  resolveSupportTicketStorageDir,
  WabaSupportTicketRepository,
  type WabaSupportAttachmentKind,
  type WabaSupportTicket,
  type WabaSupportTicketAttachment,
} from "./waba-support-ticket.repository";

const ticketRepository = new WabaSupportTicketRepository();
const subscriberRepository = new WabaSubscriberRepository();

const MAX_ATTACHMENTS = 8;
const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const MIN_DESCRIPTION_LENGTH = 10;

export const buildSupportTicketTitle = (description: string): string => {
  const line = String(description || "")
    .trim()
    .split(/\r?\n/)
    .map((part) => part.trim())
    .find(Boolean);
  if (!line) return "Chamado sem título";
  if (line.length <= 80) return line;
  return `${line.slice(0, 77)}...`;
};

export const resolveSupportTicketTitle = (ticket: WabaSupportTicket): string => {
  const explicit = String(ticket.title || "").trim();
  if (explicit) return explicit;
  return buildSupportTicketTitle(ticket.description);
};

const sanitizeFileName = (value: string): string => {
  const base = path.basename(String(value || "arquivo").trim()) || "arquivo";
  return base.replace(/[^\w.\-()+\s]/g, "_").slice(0, 120);
};

const buildDisplayId = (): string => {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `CHM-${y}${m}${d}-${suffix}`;
};

const resolveAttachmentKind = (
  mimeType: string,
  fileName: string,
): WabaSupportAttachmentKind | null => {
  const mime = String(mimeType || "").trim().toLowerCase();
  const lowerName = String(fileName || "").trim().toLowerCase();

  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("image/")) return "image";
  if (
    mime.startsWith("text/") ||
    mime === "application/pdf" ||
    mime === "application/msword" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".pdf") ||
    lowerName.endsWith(".doc") ||
    lowerName.endsWith(".docx")
  ) {
    return "text";
  }
  return null;
};

const resolveOwnerName = (email: string): string => {
  const subscriber = subscriberRepository.getByEmail(email);
  return String(subscriber?.fullName || email).trim() || email;
};

export class WabaSupportTicketService {
  constructor(private readonly repository = ticketRepository) {}

  openDraft(ownerEmail: string): WabaSupportTicket {
    const normalizedEmail = ownerEmail.trim().toLowerCase();
    const now = new Date().toISOString();
    const ticket: WabaSupportTicket = {
      id: randomUUID(),
      displayId: buildDisplayId(),
      ownerEmail: normalizedEmail,
      ownerName: resolveOwnerName(normalizedEmail),
      status: "draft",
      title: "",
      description: "",
      masterResponse: "",
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };
    return this.repository.create(ticket);
  }

  submitDraft(
    ownerEmail: string,
    ticketId: string,
    description: string,
    files: Express.Multer.File[],
  ): WabaSupportTicket {
    const normalizedEmail = ownerEmail.trim().toLowerCase();
    const ticket = this.repository.getById(ticketId);
    if (!ticket) throw new Error("Chamado não encontrado.");
    if (ticket.ownerEmail !== normalizedEmail) {
      throw new Error("Você não tem permissão para enviar este chamado.");
    }
    if (ticket.status !== "draft") {
      throw new Error("Este chamado já foi enviado.");
    }

    const normalizedDescription = String(description || "").trim();
    if (normalizedDescription.length < MIN_DESCRIPTION_LENGTH) {
      throw new Error(`Descreva o problema com pelo menos ${MIN_DESCRIPTION_LENGTH} caracteres.`);
    }

    const incomingFiles = Array.isArray(files) ? files : [];
    if (incomingFiles.length > MAX_ATTACHMENTS) {
      throw new Error(`Envie no máximo ${MAX_ATTACHMENTS} anexos por chamado.`);
    }

    const attachments: WabaSupportTicketAttachment[] = [];
    const ticketDir = path.join(resolveSupportTicketStorageDir(), ticket.id, "attachments");
    if (!existsSync(ticketDir)) mkdirSync(ticketDir, { recursive: true });

    for (const file of incomingFiles) {
      const sizeBytes = Number(file.size || file.buffer?.length || 0);
      if (!Number.isFinite(sizeBytes) || sizeBytes < 1) {
        throw new Error("Um dos anexos está vazio.");
      }
      if (sizeBytes > MAX_ATTACHMENT_BYTES) {
        throw new Error("Cada anexo deve ter no máximo 50 MB.");
      }

      const fileName = sanitizeFileName(file.originalname || "arquivo");
      const kind = resolveAttachmentKind(file.mimetype, fileName);
      if (!kind) {
        throw new Error(
          "Anexos permitidos: imagem, áudio, vídeo ou arquivos de texto (txt, pdf, doc, docx).",
        );
      }

      const attachmentId = randomUUID();
      const storageFileName = `${attachmentId}-${fileName}`;
      const storagePath = path.join(ticketDir, storageFileName);
      writeFileSync(storagePath, file.buffer);

      attachments.push({
        id: attachmentId,
        kind,
        fileName,
        mimeType: String(file.mimetype || "application/octet-stream"),
        sizeBytes,
        storagePath: path.relative(resolveSupportTicketStorageDir(), storagePath).replace(/\\/g, "/"),
        createdAt: new Date().toISOString(),
      });
    }

    const now = new Date().toISOString();
    const updated: WabaSupportTicket = {
      ...ticket,
      ownerName: resolveOwnerName(normalizedEmail),
      status: "open",
      title: buildSupportTicketTitle(normalizedDescription),
      description: normalizedDescription,
      masterResponse: "",
      attachments,
      updatedAt: now,
      submittedAt: now,
    };
    return this.repository.update(updated);
  }

  listSubmittedTickets(bucket: "open" | "closed"): WabaSupportTicket[] {
    const submitted = this.repository
      .list()
      .filter((ticket) => ticket.status === "open" || ticket.status === "closed");
    return submitted
      .filter((ticket) => (bucket === "open" ? ticket.status === "open" : ticket.status === "closed"))
      .sort(
        (a, b) =>
          new Date(b.submittedAt || b.updatedAt).getTime() -
          new Date(a.submittedAt || a.updatedAt).getTime(),
      );
  }

  getSubmittedTicket(ticketId: string): WabaSupportTicket | null {
    const ticket = this.repository.getById(ticketId);
    if (!ticket || ticket.status === "draft") return null;
    return ticket;
  }

  resolveAttachmentAbsolutePath(ticket: WabaSupportTicket, attachmentId: string): string | null {
    const attachment = ticket.attachments.find((item) => item.id === attachmentId);
    if (!attachment) return null;
    const absolute = path.join(resolveSupportTicketStorageDir(), attachment.storagePath);
    if (!existsSync(absolute)) return null;
    return absolute;
  }

  updateByMaster(
    masterEmail: string,
    ticketId: string,
    input: { masterResponse?: string; status?: "open" | "closed" },
  ): WabaSupportTicket {
    const ticket = this.getSubmittedTicket(ticketId);
    if (!ticket) throw new Error("Chamado não encontrado.");

    const nextStatus = input.status === "closed" ? "closed" : input.status === "open" ? "open" : ticket.status;
    if (ticket.status === "closed" && nextStatus === "open") {
      throw new Error("Chamados finalizados não podem ser reabertos por aqui.");
    }

    const masterResponse =
      input.masterResponse !== undefined
        ? String(input.masterResponse).trim()
        : String(ticket.masterResponse || "").trim();
    const now = new Date().toISOString();
    const closingNow = nextStatus === "closed" && ticket.status !== "closed";

    const updated: WabaSupportTicket = {
      ...ticket,
      title: resolveSupportTicketTitle(ticket),
      status: nextStatus,
      masterResponse,
      masterRespondedAt:
        masterResponse && masterResponse !== String(ticket.masterResponse || "").trim()
          ? now
          : ticket.masterRespondedAt,
      closedAt: closingNow ? now : ticket.closedAt,
      closedByEmail: closingNow ? masterEmail.trim().toLowerCase() : ticket.closedByEmail,
      updatedAt: now,
    };
    return this.repository.update(updated);
  }
}
