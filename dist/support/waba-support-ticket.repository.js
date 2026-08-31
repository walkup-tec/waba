"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaSupportTicketRepository = exports.resolveSupportTicketStorageDir = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const data_path_1 = require("../data-path");
const FILE_NAME = "waba-support-tickets.json";
const emptyStore = () => ({ version: 1, tickets: [] });
const resolveSupportTicketStorageDir = () => node_path_1.default.join((0, data_path_1.resolveDataDir)(), "support-tickets");
exports.resolveSupportTicketStorageDir = resolveSupportTicketStorageDir;
class WabaSupportTicketRepository {
    readStore() {
        const filePath = (0, data_path_1.resolveDataFile)(FILE_NAME);
        const dir = node_path_1.default.dirname(filePath);
        if (!(0, node_fs_1.existsSync)(dir))
            (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        if (!(0, node_fs_1.existsSync)(filePath))
            return emptyStore();
        try {
            const raw = (0, node_fs_1.readFileSync)(filePath, "utf8");
            const parsed = JSON.parse(raw);
            if (parsed?.version !== 1 || !Array.isArray(parsed.tickets))
                return emptyStore();
            return parsed;
        }
        catch {
            return emptyStore();
        }
    }
    writeStore(store) {
        const filePath = (0, data_path_1.resolveDataFile)(FILE_NAME);
        const dir = node_path_1.default.dirname(filePath);
        if (!(0, node_fs_1.existsSync)(dir))
            (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        const tmp = `${filePath}.tmp`;
        (0, node_fs_1.writeFileSync)(tmp, JSON.stringify(store, null, 2), "utf8");
        (0, node_fs_1.writeFileSync)(filePath, (0, node_fs_1.readFileSync)(tmp));
    }
    list() {
        return this.readStore().tickets;
    }
    getById(id) {
        const normalized = String(id || "").trim();
        if (!normalized)
            return null;
        return this.list().find((ticket) => ticket.id === normalized) ?? null;
    }
    create(ticket) {
        const store = this.readStore();
        if (store.tickets.some((item) => item.id === ticket.id || item.displayId === ticket.displayId)) {
            throw new Error("Chamado já existe.");
        }
        store.tickets.push(ticket);
        this.writeStore(store);
        return ticket;
    }
    update(ticket) {
        const store = this.readStore();
        const index = store.tickets.findIndex((item) => item.id === ticket.id);
        if (index < 0)
            throw new Error("Chamado não encontrado.");
        store.tickets[index] = ticket;
        this.writeStore(store);
        return ticket;
    }
}
exports.WabaSupportTicketRepository = WabaSupportTicketRepository;
