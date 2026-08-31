import type {
  WabaSupportTicket,
  WabaSupportTicketAttachment,
} from "../support/waba-support-ticket.repository";
import {
  resolveSupportTicketTitle,
  WabaSupportTicketService,
} from "../support/waba-support-ticket.service";
import { BASE_PATH } from "../base-path";
import { notifySupportTicketClosedEmail } from "../mail/waba-mail-delivery";

const supportTicketService = new WabaSupportTicketService();

export type WabaAdminSupportTicketAttachmentView = {
  id: string;
  kind: WabaSupportTicketAttachment["kind"];
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
};

export type WabaAdminSupportTicketListItem = {
  id: string;
  displayId: string;
  title: string;
  ownerEmail: string;
  ownerName: string;
  status: "open" | "closed";
  statusLabel: string;
  openedAt: string;
  closedAt: string | null;
  isCloseOverdue: boolean;
  closeDeadlineAt: string;
  attachments: WabaAdminSupportTicketAttachmentView[];
};

export type WabaAdminSupportTicketDetail = WabaAdminSupportTicketListItem & {
  description: string;
  masterResponse: string;
  masterRespondedAt: string | null;
  submittedAt: string | null;
};

const mapStatusLabel = (status: WabaSupportTicket["status"]): string => {
  if (status === "closed") return "Finalizado";
  if (status === "open") return "Em aberto";
  return "Rascunho";
};

export const SUPPORT_TICKET_CLOSE_DEADLINE_MS = 24 * 60 * 60 * 1000;

const resolveTicketOpenedAt = (ticket: WabaSupportTicket): string =>
  String(ticket.submittedAt || ticket.createdAt || "").trim();

const resolveTicketCloseDeadlineAt = (ticket: WabaSupportTicket): string => {
  const openedMs = new Date(resolveTicketOpenedAt(ticket)).getTime();
  if (Number.isNaN(openedMs)) return "";
  return new Date(openedMs + SUPPORT_TICKET_CLOSE_DEADLINE_MS).toISOString();
};

const isSupportTicketCloseOverdue = (ticket: WabaSupportTicket, status: "open" | "closed"): boolean => {
  if (status !== "open") return false;
  const openedMs = new Date(resolveTicketOpenedAt(ticket)).getTime();
  if (Number.isNaN(openedMs)) return false;
  return Date.now() > openedMs + SUPPORT_TICKET_CLOSE_DEADLINE_MS;
};

const mapAttachment = (
  ticketId: string,
  attachment: WabaSupportTicketAttachment,
): WabaAdminSupportTicketAttachmentView => ({
  id: attachment.id,
  kind: attachment.kind,
  fileName: attachment.fileName,
  mimeType: attachment.mimeType,
  sizeBytes: attachment.sizeBytes,
  url: `${BASE_PATH}/admin/support/tickets/${encodeURIComponent(ticketId)}/attachments/${encodeURIComponent(attachment.id)}`,
});

const mapTicketListItem = (ticket: WabaSupportTicket): WabaAdminSupportTicketListItem => {
  const status = ticket.status === "closed" ? "closed" : "open";
  const openedAt = resolveTicketOpenedAt(ticket) || ticket.createdAt;
  return {
    id: ticket.id,
    displayId: ticket.displayId,
    title: resolveSupportTicketTitle(ticket),
    ownerEmail: ticket.ownerEmail,
    ownerName: ticket.ownerName,
    status,
    statusLabel: mapStatusLabel(ticket.status),
    openedAt,
    closedAt: ticket.closedAt || null,
    isCloseOverdue: isSupportTicketCloseOverdue(ticket, status),
    closeDeadlineAt: resolveTicketCloseDeadlineAt(ticket),
    attachments: ticket.attachments.map((attachment) => mapAttachment(ticket.id, attachment)),
  };
};

export class WabaAdminSupportService {
  constructor(private readonly ticketService = supportTicketService) {}

  listTickets(bucket: "open" | "closed") {
    const items = this.ticketService.listSubmittedTickets(bucket).map(mapTicketListItem);
    return {
      bucket,
      items,
      total: items.length,
    };
  }

  getTicket(ticketId: string): WabaAdminSupportTicketDetail | null {
    const ticket = this.ticketService.getSubmittedTicket(ticketId);
    if (!ticket) return null;
    const base = mapTicketListItem(ticket);
    return {
      ...base,
      description: ticket.description,
      masterResponse: String(ticket.masterResponse || ""),
      masterRespondedAt: ticket.masterRespondedAt || null,
      submittedAt: ticket.submittedAt || null,
    };
  }

  updateTicket(
    masterEmail: string,
    ticketId: string,
    input: { masterResponse?: string; status?: "open" | "closed" },
  ): WabaAdminSupportTicketDetail {
    const before = this.ticketService.getSubmittedTicket(ticketId);
    const updated = this.ticketService.updateByMaster(masterEmail, ticketId, input);
    const detail = this.getTicket(updated.id);
    if (!detail) throw new Error("Chamado não encontrado após atualização.");

    const closingNow = before?.status !== "closed" && detail.status === "closed";
    if (closingNow) {
      notifySupportTicketClosedEmail({
        ownerEmail: detail.ownerEmail,
        ownerName: detail.ownerName,
        displayId: detail.displayId,
        ticketTitle: detail.title,
        masterResponse: detail.masterResponse,
      });
    }

    return detail;
  }

  resolveAttachmentFile(ticketId: string, attachmentId: string) {
    const ticket = this.ticketService.getSubmittedTicket(ticketId);
    if (!ticket) return null;
    const attachment = ticket.attachments.find((item) => item.id === attachmentId);
    if (!attachment) return null;
    const absolutePath = this.ticketService.resolveAttachmentAbsolutePath(ticket, attachmentId);
    if (!absolutePath) return null;
    return { attachment, absolutePath };
  }
}
