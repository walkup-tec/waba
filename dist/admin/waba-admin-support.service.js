"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaAdminSupportService = exports.SUPPORT_TICKET_CLOSE_DEADLINE_MS = void 0;
const waba_support_ticket_service_1 = require("../support/waba-support-ticket.service");
const base_path_1 = require("../base-path");
const waba_mail_delivery_1 = require("../mail/waba-mail-delivery");
const supportTicketService = new waba_support_ticket_service_1.WabaSupportTicketService();
const mapStatusLabel = (status) => {
    if (status === "closed")
        return "Finalizado";
    if (status === "open")
        return "Em aberto";
    return "Rascunho";
};
exports.SUPPORT_TICKET_CLOSE_DEADLINE_MS = 24 * 60 * 60 * 1000;
const resolveTicketOpenedAt = (ticket) => String(ticket.submittedAt || ticket.createdAt || "").trim();
const resolveTicketCloseDeadlineAt = (ticket) => {
    const openedMs = new Date(resolveTicketOpenedAt(ticket)).getTime();
    if (Number.isNaN(openedMs))
        return "";
    return new Date(openedMs + exports.SUPPORT_TICKET_CLOSE_DEADLINE_MS).toISOString();
};
const isSupportTicketCloseOverdue = (ticket, status) => {
    if (status !== "open")
        return false;
    const openedMs = new Date(resolveTicketOpenedAt(ticket)).getTime();
    if (Number.isNaN(openedMs))
        return false;
    return Date.now() > openedMs + exports.SUPPORT_TICKET_CLOSE_DEADLINE_MS;
};
const mapAttachment = (ticketId, attachment) => ({
    id: attachment.id,
    kind: attachment.kind,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    url: `${base_path_1.BASE_PATH}/admin/support/tickets/${encodeURIComponent(ticketId)}/attachments/${encodeURIComponent(attachment.id)}`,
});
const mapTicketListItem = (ticket) => {
    const status = ticket.status === "closed" ? "closed" : "open";
    const openedAt = resolveTicketOpenedAt(ticket) || ticket.createdAt;
    return {
        id: ticket.id,
        displayId: ticket.displayId,
        title: (0, waba_support_ticket_service_1.resolveSupportTicketTitle)(ticket),
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
class WabaAdminSupportService {
    constructor(ticketService = supportTicketService) {
        this.ticketService = ticketService;
    }
    listTickets(bucket) {
        const items = this.ticketService.listSubmittedTickets(bucket).map(mapTicketListItem);
        return {
            bucket,
            items,
            total: items.length,
        };
    }
    getTicket(ticketId) {
        const ticket = this.ticketService.getSubmittedTicket(ticketId);
        if (!ticket)
            return null;
        const base = mapTicketListItem(ticket);
        return {
            ...base,
            description: ticket.description,
            masterResponse: String(ticket.masterResponse || ""),
            masterRespondedAt: ticket.masterRespondedAt || null,
            submittedAt: ticket.submittedAt || null,
        };
    }
    updateTicket(masterEmail, ticketId, input) {
        const before = this.ticketService.getSubmittedTicket(ticketId);
        const updated = this.ticketService.updateByMaster(masterEmail, ticketId, input);
        const detail = this.getTicket(updated.id);
        if (!detail)
            throw new Error("Chamado não encontrado após atualização.");
        const closingNow = before?.status !== "closed" && detail.status === "closed";
        if (closingNow) {
            (0, waba_mail_delivery_1.notifySupportTicketClosedEmail)({
                ownerEmail: detail.ownerEmail,
                ownerName: detail.ownerName,
                displayId: detail.displayId,
                ticketTitle: detail.title,
                masterResponse: detail.masterResponse,
            });
        }
        return detail;
    }
    resolveAttachmentFile(ticketId, attachmentId) {
        const ticket = this.ticketService.getSubmittedTicket(ticketId);
        if (!ticket)
            return null;
        const attachment = ticket.attachments.find((item) => item.id === attachmentId);
        if (!attachment)
            return null;
        const absolutePath = this.ticketService.resolveAttachmentAbsolutePath(ticket, attachmentId);
        if (!absolutePath)
            return null;
        return { attachment, absolutePath };
    }
}
exports.WabaAdminSupportService = WabaAdminSupportService;
