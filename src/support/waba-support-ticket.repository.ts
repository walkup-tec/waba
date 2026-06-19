import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataDir, resolveDataFile } from "../data-path";

export type WabaSupportTicketStatus = "draft" | "open" | "closed";

export type WabaSupportAttachmentKind = "audio" | "video" | "text" | "image";

export type WabaSupportTicketAttachment = {
  id: string;
  kind: WabaSupportAttachmentKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  createdAt: string;
};

export type WabaSupportTicket = {
  id: string;
  displayId: string;
  ownerEmail: string;
  ownerName: string;
  status: WabaSupportTicketStatus;
  title: string;
  description: string;
  masterResponse: string;
  attachments: WabaSupportTicketAttachment[];
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  masterRespondedAt?: string;
  closedAt?: string;
  closedByEmail?: string;
};

type Store = {
  version: 1;
  tickets: WabaSupportTicket[];
};

const FILE_NAME = "waba-support-tickets.json";

const emptyStore = (): Store => ({ version: 1, tickets: [] });

export const resolveSupportTicketStorageDir = (): string =>
  path.join(resolveDataDir(), "support-tickets");

export class WabaSupportTicketRepository {
  private readStore(): Store {
    const filePath = resolveDataFile(FILE_NAME);
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (!existsSync(filePath)) return emptyStore();
    try {
      const raw = readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as Store;
      if (parsed?.version !== 1 || !Array.isArray(parsed.tickets)) return emptyStore();
      return parsed;
    } catch {
      return emptyStore();
    }
  }

  private writeStore(store: Store) {
    const filePath = resolveDataFile(FILE_NAME);
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const tmp = `${filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
    writeFileSync(filePath, readFileSync(tmp));
  }

  list(): WabaSupportTicket[] {
    return this.readStore().tickets;
  }

  getById(id: string): WabaSupportTicket | null {
    const normalized = String(id || "").trim();
    if (!normalized) return null;
    return this.list().find((ticket) => ticket.id === normalized) ?? null;
  }

  create(ticket: WabaSupportTicket): WabaSupportTicket {
    const store = this.readStore();
    if (store.tickets.some((item) => item.id === ticket.id || item.displayId === ticket.displayId)) {
      throw new Error("Chamado já existe.");
    }
    store.tickets.push(ticket);
    this.writeStore(store);
    return ticket;
  }

  update(ticket: WabaSupportTicket): WabaSupportTicket {
    const store = this.readStore();
    const index = store.tickets.findIndex((item) => item.id === ticket.id);
    if (index < 0) throw new Error("Chamado não encontrado.");
    store.tickets[index] = ticket;
    this.writeStore(store);
    return ticket;
  }
}
