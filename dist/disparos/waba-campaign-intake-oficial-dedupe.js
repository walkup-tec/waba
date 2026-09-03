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
exports.parseOfficialCampaignLeadsUnique = parseOfficialCampaignLeadsUnique;
exports.writeOfficialCampaignLeadsFile = writeOfficialCampaignLeadsFile;
exports.dedupeOfficialCampaignLeadsFile = dedupeOfficialCampaignLeadsFile;
const XLSX = __importStar(require("xlsx"));
const meta_whatsapp_broadcast_leads_1 = require("../integrations/meta-whatsapp/meta-whatsapp-broadcast-leads");
const meta_whatsapp_cloud_recipient_1 = require("../integrations/meta-whatsapp/meta-whatsapp-cloud-recipient");
const waba_campaign_spreadsheet_util_1 = require("./waba-campaign-spreadsheet.util");
function rowDedupeKey(row, phoneColumn) {
    const raw = phoneColumn ? row[phoneColumn] : "";
    const normalized = (0, meta_whatsapp_cloud_recipient_1.normalizeMetaSpreadsheetRecipient)(raw);
    if (normalized.ok)
        return (0, meta_whatsapp_cloud_recipient_1.metaSpreadsheetRecipientDedupeKey)(normalized.waId);
    const digits = String(raw ?? "").replace(/\D/g, "");
    return digits || "";
}
function uniqueOfficialLeadRows(sheet) {
    const phoneColumn = (0, meta_whatsapp_broadcast_leads_1.guessMetaBroadcastPhoneColumn)(sheet.columns);
    const seen = new Set();
    const rows = [];
    let duplicatesRemoved = 0;
    for (const row of sheet.rows) {
        const key = rowDedupeKey(row, phoneColumn);
        if (!key)
            continue;
        if (seen.has(key)) {
            duplicatesRemoved += 1;
            continue;
        }
        seen.add(key);
        rows.push(row);
    }
    return { rows, duplicatesRemoved };
}
function writeOfficialLeadsSheet(sheet, fileName) {
    if ((0, waba_campaign_spreadsheet_util_1.isCampaignLeadsTxtFileName)(fileName)) {
        if (sheet.columns.length <= 1) {
            const column = sheet.columns[0] || "telefone";
            const lines = sheet.rows.map((row) => String(row[column] ?? "").trim()).filter(Boolean);
            return Buffer.from(lines.length ? `${lines.join("\n")}\n` : "", "utf8");
        }
        const header = sheet.columns.join(";");
        const lines = sheet.rows.map((row) => sheet.columns.map((column) => String(row[column] ?? "").trim()).join(";"));
        return Buffer.from(`${[header, ...lines].join("\n")}\n`, "utf8");
    }
    const nextSheet = XLSX.utils.json_to_sheet(sheet.rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, nextSheet, "Leads");
    return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}
/** API Oficial: 1 telefone por campanha (mesmo número com/sem 9º dígito). */
function parseOfficialCampaignLeadsUnique(buffer, fileName) {
    const sheet = (0, meta_whatsapp_broadcast_leads_1.readMetaBroadcastSheet)(buffer, fileName);
    const unique = uniqueOfficialLeadRows(sheet);
    return {
        sheet: { columns: sheet.columns, rows: unique.rows },
        uniqueCount: unique.rows.length,
        duplicatesRemoved: unique.duplicatesRemoved,
    };
}
function writeOfficialCampaignLeadsFile(sheet, fileName, maxRows) {
    const limit = Math.max(0, Math.round(Number(maxRows) || 0));
    const rows = limit > 0 ? sheet.rows.slice(0, limit) : sheet.rows;
    return writeOfficialLeadsSheet({ columns: sheet.columns, rows }, fileName);
}
function dedupeOfficialCampaignLeadsFile(buffer, fileName, maxRows) {
    const unique = parseOfficialCampaignLeadsUnique(buffer, fileName);
    return {
        buffer: writeOfficialCampaignLeadsFile(unique.sheet, fileName, maxRows),
        uniqueCount: unique.uniqueCount,
        duplicatesRemoved: unique.duplicatesRemoved,
    };
}
