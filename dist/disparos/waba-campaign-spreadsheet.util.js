"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCampaignLeadsTxtFileName = exports.isCampaignLeadsFileName = exports.CAMPAIGN_LEADS_ACCEPTED_EXTENSIONS = void 0;
exports.countTxtImportedRows = countTxtImportedRows;
exports.trimTxtBufferToRowCount = trimTxtBufferToRowCount;
exports.countSpreadsheetImportedRows = countSpreadsheetImportedRows;
exports.trimSpreadsheetBufferToRowCount = trimSpreadsheetBufferToRowCount;
exports.countLeadsImportedRows = countLeadsImportedRows;
exports.trimLeadsBufferToRowCount = trimLeadsBufferToRowCount;
const XLSX = __importStar(require("xlsx"));
/** Extensões aceitas no intake de leads (wizard API Oficial). */
exports.CAMPAIGN_LEADS_ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".txt"];
const isCampaignLeadsFileName = (fileName) => {
    const lower = String(fileName || "").trim().toLowerCase();
    return exports.CAMPAIGN_LEADS_ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
};
exports.isCampaignLeadsFileName = isCampaignLeadsFileName;
const isCampaignLeadsTxtFileName = (fileName) => String(fileName || "").trim().toLowerCase().endsWith(".txt");
exports.isCampaignLeadsTxtFileName = isCampaignLeadsTxtFileName;
/** Conta linhas não vazias de um TXT (um contato por linha). */
function countTxtImportedRows(buffer) {
    const text = buffer.toString("utf8");
    if (!text.trim())
        return 0;
    return text
        .split(/\r\n|\n|\r/)
        .map((line) => line.trim())
        .filter(Boolean).length;
}
/** Mantém as primeiras `maxRows` linhas não vazias do TXT. */
function trimTxtBufferToRowCount(buffer, maxRows) {
    const rowLimit = Math.max(0, Math.round(Number(maxRows) || 0));
    const text = buffer.toString("utf8");
    const lines = text
        .split(/\r\n|\n|\r/)
        .map((line) => line.trim())
        .filter(Boolean);
    const trimmed = rowLimit > 0 ? lines.slice(0, rowLimit) : [];
    return Buffer.from(`${trimmed.join("\n")}${trimmed.length ? "\n" : ""}`, "utf8");
}
/** Conta linhas de dados da primeira aba (mesma regra do preview no painel). */
function countSpreadsheetImportedRows(buffer) {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName)
        return 0;
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    return rows.length;
}
/** Mantém somente as primeiras `maxRows` linhas de dados da primeira aba. */
function trimSpreadsheetBufferToRowCount(buffer, maxRows) {
    const rowLimit = Math.max(0, Math.round(Number(maxRows) || 0));
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheetName = wb.SheetNames[0] || "Leads";
    const sheet = wb.Sheets[sheetName];
    const rows = sheet
        ? XLSX.utils.sheet_to_json(sheet, { defval: "" })
        : [];
    const trimmedRows = rowLimit > 0 ? rows.slice(0, rowLimit) : [];
    const nextSheet = XLSX.utils.json_to_sheet(trimmedRows);
    const nextWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(nextWorkbook, nextSheet, sheetName);
    return Buffer.from(XLSX.write(nextWorkbook, { type: "buffer", bookType: "xlsx" }));
}
/** Conta leads conforme extensão do arquivo (.xlsx/.xls ou .txt). */
function countLeadsImportedRows(buffer, fileName) {
    if ((0, exports.isCampaignLeadsTxtFileName)(fileName)) {
        return countTxtImportedRows(buffer);
    }
    return countSpreadsheetImportedRows(buffer);
}
/** Corta o arquivo de leads ao limite de envios, preservando o tipo (Excel→xlsx / TXT→txt). */
function trimLeadsBufferToRowCount(buffer, maxRows, fileName) {
    if ((0, exports.isCampaignLeadsTxtFileName)(fileName)) {
        return trimTxtBufferToRowCount(buffer, maxRows);
    }
    return trimSpreadsheetBufferToRowCount(buffer, maxRows);
}
